import type { Request, Response } from 'express';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

const GOOGLE_CLOUD_PROJECT_NUMBER = '784575354074';
const WORKLOAD_IDENTITY_POOL_ID = 'connectboat-vercel-production';
const WORKLOAD_IDENTITY_PROVIDER_ID = 'vercel-connectboat';
const GOOGLE_SERVICE_ACCOUNT =
  'connectboat-analytics-reader@connectboat-analytics.iam.gserviceaccount.com';
const GA4_PROPERTY_ID = '548217388';

const GOOGLE_STS_URL = 'https://sts.googleapis.com/v1/token';
const GOOGLE_IAM_CREDENTIALS_URL =
  `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(
    GOOGLE_SERVICE_ACCOUNT
  )}:generateAccessToken`;
const GA4_RUN_REPORT_URL =
  `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`;

const GOOGLE_WIF_AUDIENCE =
  `//iam.googleapis.com/projects/${GOOGLE_CLOUD_PROJECT_NUMBER}` +
  `/locations/global/workloadIdentityPools/${WORKLOAD_IDENTITY_POOL_ID}` +
  `/providers/${WORKLOAD_IDENTITY_PROVIDER_ID}`;

type AnalyticsRange = '7d' | '30d' | 'all';

type GaMetricHeader = { name?: string };
type GaDimensionHeader = { name?: string };
type GaValue = { value?: string };
type GaRow = {
  dimensionValues?: GaValue[];
  metricValues?: GaValue[];
};
type GaReport = {
  dimensionHeaders?: GaDimensionHeader[];
  metricHeaders?: GaMetricHeader[];
  rows?: GaRow[];
  totals?: GaRow[];
  rowCount?: number;
};

function getAdminDb() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      const decoded = Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    }

    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getFirestore(getApp(), FIRESTORE_DATABASE_ID);
}

async function verifyAdminRequest(req: Request, db: any) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      ok: false as const,
      status: 401,
      code: 'AUTH_TOKEN_MISSING',
      message: 'Authentication required.',
    };
  }

  let decodedToken;

  try {
    decodedToken = await getAuth(getApp()).verifyIdToken(match[1]);
  } catch {
    return {
      ok: false as const,
      status: 401,
      code: 'AUTH_TOKEN_INVALID',
      message: 'Invalid or expired Firebase authentication token.',
    };
  }

  const email =
    typeof decodedToken.email === 'string'
      ? decodedToken.email.trim().toLowerCase()
      : '';

  const explicitAdminEmails = new Set([
    'valtailubereats@gmail.com',
    'valtail@gmail.com',
    'generalsales2021@gmail.com',
  ]);

  if (explicitAdminEmails.has(email)) {
    return {
      ok: true as const,
      uid: decodedToken.uid,
      email,
    };
  }

  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (role !== 'admin') {
    return {
      ok: false as const,
      status: 403,
      code: 'ADMIN_ACCESS_REQUIRED',
      message: 'Administrator access required.',
    };
  }

  return {
    ok: true as const,
    uid: decodedToken.uid,
    email,
  };
}

function getRange(value: unknown): AnalyticsRange {
  if (value === '30d' || value === 'all') return value;
  return '7d';
}

function getDateRange(range: AnalyticsRange) {
  if (range === '30d') {
    return { startDate: '29daysAgo', endDate: 'today' };
  }

  if (range === 'all') {
    return { startDate: '2020-01-01', endDate: 'today' };
  }

  return { startDate: '6daysAgo', endDate: 'today' };
}

function getVercelOidcToken(req: Request): string {
  const rawHeader = req.headers['x-vercel-oidc-token'];
  const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  const envToken = process.env.VERCEL_OIDC_TOKEN;
  if (typeof envToken === 'string' && envToken.trim()) {
    return envToken.trim();
  }

  throw new Error('Vercel OIDC token is missing from this function request.');
}

async function readJsonOrText(response: globalThis.Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function exchangeVercelTokenForGoogleFederatedToken(subjectToken: string) {
  const response = await fetch(GOOGLE_STS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audience: GOOGLE_WIF_AUDIENCE,
      grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken,
    }),
  });

  const payload = await readJsonOrText(response);

  if (!response.ok) {
    console.error('[Admin Analytics] Google STS exchange failed:', payload);
    throw new Error(`Google STS token exchange failed (${response.status}).`);
  }

  const accessToken =
    payload && typeof payload === 'object' && typeof payload.access_token === 'string'
      ? payload.access_token
      : '';

  if (!accessToken) {
    throw new Error('Google STS response did not include an access token.');
  }

  return accessToken;
}

async function impersonateAnalyticsServiceAccount(federatedAccessToken: string) {
  const response = await fetch(GOOGLE_IAM_CREDENTIALS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${federatedAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scope: ['https://www.googleapis.com/auth/analytics.readonly'],
      lifetime: '3600s',
    }),
  });

  const payload = await readJsonOrText(response);

  if (!response.ok) {
    console.error('[Admin Analytics] Service account impersonation failed:', payload);
    throw new Error(`Google service account impersonation failed (${response.status}).`);
  }

  const accessToken =
    payload && typeof payload === 'object' && typeof payload.accessToken === 'string'
      ? payload.accessToken
      : '';

  if (!accessToken) {
    throw new Error('Google IAM Credentials response did not include an access token.');
  }

  return accessToken;
}

async function runGa4Report(accessToken: string, body: Record<string, unknown>): Promise<GaReport> {
  const response = await fetch(GA4_RUN_REPORT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await readJsonOrText(response);

  if (!response.ok) {
    console.error('[Admin Analytics] GA4 Data API request failed:', payload);
    throw new Error(`Google Analytics Data API request failed (${response.status}).`);
  }

  return (payload || {}) as GaReport;
}

function numericValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metricTotal(report: GaReport, metricName: string): number {
  const metricIndex = (report.metricHeaders || []).findIndex(
    (header) => header.name === metricName
  );

  if (metricIndex < 0) return 0;

  const totalValue = report.totals?.[0]?.metricValues?.[metricIndex]?.value;
  if (totalValue !== undefined) {
    return numericValue(totalValue);
  }

  return (report.rows || []).reduce((sum, row) => {
    return sum + numericValue(row.metricValues?.[metricIndex]?.value);
  }, 0);
}

function dimensionValue(report: GaReport, row: GaRow, dimensionName: string): string {
  const index = (report.dimensionHeaders || []).findIndex(
    (header) => header.name === dimensionName
  );

  if (index < 0) return '';
  return String(row.dimensionValues?.[index]?.value || '').trim();
}

function rowMetricValue(report: GaReport, row: GaRow, metricName: string): number {
  const index = (report.metricHeaders || []).findIndex(
    (header) => header.name === metricName
  );

  if (index < 0) return 0;
  return numericValue(row.metricValues?.[index]?.value);
}

function classifyTrafficSource(source: string, medium: string, channel: string) {
  const sourceLower = source.toLowerCase();
  const mediumLower = medium.toLowerCase();
  const channelLower = channel.toLowerCase();

  if (
    sourceLower.includes('google') &&
    (/(cpc|ppc|paid|paidsearch)/i.test(mediumLower) ||
      channelLower.includes('paid search') ||
      channelLower.includes('cross-network') ||
      channelLower.includes('display'))
  ) {
    return 'Google Ads';
  }

  if (
    sourceLower.includes('google') &&
    (mediumLower.includes('organic') || channelLower.includes('organic search'))
  ) {
    return 'Google Organic';
  }

  if (
    sourceLower === '(direct)' ||
    sourceLower === 'direct' ||
    mediumLower === '(none)' ||
    channelLower === 'direct'
  ) {
    return 'Direct';
  }

  const commonSocialSources = [
    'facebook',
    'instagram',
    'tiktok',
    'linkedin',
    'twitter',
    'x.com',
    'youtube',
    'pinterest',
    'reddit',
  ];

  if (
    channelLower.includes('social') ||
    commonSocialSources.some((name) => sourceLower.includes(name))
  ) {
    return 'Social';
  }

  return 'Other';
}

function buildTrafficSources(report: GaReport) {
  const totals = new Map<string, number>([
    ['Google Ads', 0],
    ['Google Organic', 0],
    ['Direct', 0],
    ['Social', 0],
    ['Other', 0],
  ]);

  for (const row of report.rows || []) {
    const source = dimensionValue(report, row, 'sessionSource');
    const medium = dimensionValue(report, row, 'sessionMedium');
    const channel = dimensionValue(report, row, 'sessionDefaultChannelGroup');
    const sessions = rowMetricValue(report, row, 'sessions');
    const bucket = classifyTrafficSource(source, medium, channel);
    totals.set(bucket, (totals.get(bucket) || 0) + sessions);
  }

  return Array.from(totals.entries()).map(([name, sessions]) => ({
    name,
    sessions,
  }));
}

function buildTopPages(report: GaReport) {
  return (report.rows || []).map((row) => ({
    path: dimensionValue(report, row, 'pagePath') || '/',
    pageViews: rowMetricValue(report, row, 'screenPageViews'),
  }));
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed.',
    });
  }

  try {
    const db = getAdminDb();
    const admin = await verifyAdminRequest(req, db);

    if (!admin.ok) {
      return res.status(admin.status).json({
        success: false,
        code: admin.code,
        message: admin.message,
      });
    }

    const range = getRange(req.query.range);
    const dateRange = getDateRange(range);

    const vercelOidcToken = getVercelOidcToken(req);
    const federatedToken = await exchangeVercelTokenForGoogleFederatedToken(
      vercelOidcToken
    );
    const analyticsAccessToken = await impersonateAnalyticsServiceAccount(
      federatedToken
    );

    const [summaryReport, trafficReport, topPagesReport] = await Promise.all([
      runGa4Report(analyticsAccessToken, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'newUsers' },
        ],
        metricAggregations: ['TOTAL'],
      }),
      runGa4Report(analyticsAccessToken, {
        dateRanges: [dateRange],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
          { name: 'sessionDefaultChannelGroup' },
        ],
        metrics: [{ name: 'sessions' }],
        limit: '10000',
      }),
      runGa4Report(analyticsAccessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [
          {
            metric: { metricName: 'screenPageViews' },
            desc: true,
          },
        ],
        limit: '10',
      }),
    ]);

    const summary = {
      visitors: metricTotal(summaryReport, 'activeUsers'),
      pageViews: metricTotal(summaryReport, 'screenPageViews'),
      sessions: metricTotal(summaryReport, 'sessions'),
      newUsers: metricTotal(summaryReport, 'newUsers'),
    };

    return res.status(200).json({
      success: true,
      range,
      dateRange,
      source: 'GA4',
      propertyId: GA4_PROPERTY_ID,
      summary,
      trafficSources: buildTrafficSources(trafficReport),
      topPages: buildTopPages(topPagesReport),
    });
  } catch (error) {
    console.error('[Admin Analytics] Request failed:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown analytics error.';

    return res.status(500).json({
      success: false,
      code: 'ANALYTICS_UNAVAILABLE',
      message,
    });
  }
}
