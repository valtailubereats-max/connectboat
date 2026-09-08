import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { timingSafeEqual } from 'node:crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is missing.');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

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

function getValidConfiguredPrice(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }
  return numericValue;
}

async function verifyAdminRequest(req: Request, db: any) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      ok: false as const,
      status: 401,
      code: 'AUTH_TOKEN_MISSING',
      message: 'Authentication required.'
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
      message: 'Invalid or expired Firebase authentication token.'
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
      email
    };
  }

  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (role !== 'admin') {
    return {
      ok: false as const,
      status: 403,
      code: 'ADMIN_ACCESS_REQUIRED',
      message: 'Administrator access required.'
    };
  }

  return {
    ok: true as const,
    uid: decodedToken.uid,
    email
  };
}


function passwordsMatch(received: string, expected: string) {
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function resolveRefundRecipientEmail(db: any, adData: any) {
  const directCandidates = [
    adData.contactEmail,
    adData.sellerEmail,
    adData.userEmail,
    adData.ownerEmail,
    adData.email,
    adData.submittedByEmail,
  ];

  for (const candidate of directCandidates) {
    if (
      typeof candidate === 'string' &&
      candidate.trim() &&
      candidate.includes('@')
    ) {
      return candidate.trim().toLowerCase();
    }
  }

  const ownerUidCandidates = [
    adData.sellerId,
    adData.userId,
    adData.ownerId,
    adData.createdBy,
    adData.submittedByUserId,
  ];

  for (const uidCandidate of ownerUidCandidates) {
    if (typeof uidCandidate !== 'string' || !uidCandidate.trim()) continue;

    const uid = uidCandidate.trim();

    for (const collectionName of ['users', 'profiles']) {
      try {
        const snapshot = await db.collection(collectionName).doc(uid).get();
        if (!snapshot.exists) continue;

        const data = snapshot.data() || {};
        for (const emailField of ['email', 'userEmail', 'contactEmail']) {
          const value = data[emailField];
          if (
            typeof value === 'string' &&
            value.trim() &&
            value.includes('@')
          ) {
            return value.trim().toLowerCase();
          }
        }
      } catch (error) {
        console.warn(
          `[Finance Refund Email] Could not read ${collectionName}/${uid}:`,
          error
        );
      }
    }

    try {
      const authUser = await getAuth(getApp()).getUser(uid);
      if (
        typeof authUser.email === 'string' &&
        authUser.email.trim() &&
        authUser.email.includes('@')
      ) {
        return authUser.email.trim().toLowerCase();
      }
    } catch (error) {
      console.warn(
        `[Finance Refund Email] Could not resolve Firebase Auth email for ${uid}:`,
        error
      );
    }
  }

  return '';
}

async function sendRefundEmailDirect(
  recipientEmail: string,
  data: {
    customerName?: string;
    listingTitle?: string;
    amountRefunded: number;
    currency?: string;
    refundId: string;
    paymentIntentId: string;
    refundDate: Date;
  }
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY environment variable is not configured on the server.'
    );
  }

  const fromEmail =
    process.env.EMAIL_FROM ||
    'ConnectBoat <no-reply@connectboat.co.uk>';

  const replyTo =
    process.env.EMAIL_REPLY_TO ||
    'contato@connectboat.co.uk';

  const currency = (data.currency || 'GBP').toUpperCase();
  const amountFormatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(data.amountRefunded);

  const refundDateFormatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(data.refundDate);

  const safeName = escapeHtml(data.customerName || 'ConnectBoat member');
  const safeListing = escapeHtml(data.listingTitle || 'ConnectBoat listing');
  const safeRefundId = escapeHtml(data.refundId);
  const safePaymentIntentId = escapeHtml(data.paymentIntentId);

  const subject = `ConnectBoat refund confirmed — ${amountFormatted}`;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background:#020617;padding:26px 30px;">
                    <div style="font-size:24px;font-weight:900;color:#ffffff;">⛵ ConnectBoat</div>
                    <div style="margin-top:4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#38bdf8;">UK Boat & Marine Marketplace</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 30px;">
                    <p style="margin:0 0 14px;font-size:17px;font-weight:800;">Hello ${safeName},</p>
                    <p style="margin:0 0 22px;color:#475569;line-height:1.65;">
                      Your ConnectBoat refund has been successfully submitted through Stripe.
                    </p>

                    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:18px;margin-bottom:22px;">
                      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#9f1239;">Refund confirmed</div>
                      <div style="margin-top:6px;font-size:30px;font-weight:900;color:#be123c;">${amountFormatted}</div>
                    </div>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                      <tr>
                        <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;">Listing</td>
                        <td align="right" style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:800;">${safeListing}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;">Refund date</td>
                        <td align="right" style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:800;">${escapeHtml(refundDateFormatted)}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;">Stripe refund ID</td>
                        <td align="right" style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:11px;">${safeRefundId}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 16px;color:#64748b;font-size:12px;font-weight:700;">Payment ID</td>
                        <td align="right" style="padding:13px 16px;font-family:monospace;font-size:11px;">${safePaymentIntentId}</td>
                      </tr>
                    </table>

                    <p style="margin:22px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                      Your bank or card issuer controls when the refund becomes visible in your account. Processing time can vary by bank.
                    </p>

                    <p style="margin:24px 0 0;color:#475569;font-size:13px;">
                      Questions? Reply to this email or contact <strong>${escapeHtml(replyTo)}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientEmail],
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  const responseText = await response.text();
  let responseData: any = {};

  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = {};
  }

  if (!response.ok) {
    throw new Error(
      responseData?.message ||
      responseData?.error ||
      `Resend error ${response.status}: ${responseText.slice(0, 300)}`
    );
  }

  return {
    id: responseData?.id || '',
  };
}


// --- GA4 analytics via Vercel OIDC / Google Workload Identity Federation ---
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

function buildOtherTrafficBreakdown(report: GaReport) {
  return (report.rows || [])
    .map((row) => {
      const source = dimensionValue(report, row, 'sessionSource') || '(not set)';
      const medium = dimensionValue(report, row, 'sessionMedium') || '(not set)';
      const channel = dimensionValue(report, row, 'sessionDefaultChannelGroup') || '(not set)';
      const sessions = rowMetricValue(report, row, 'sessions');
      const bucket = classifyTrafficSource(source, medium, channel);

      return { source, medium, channel, sessions, bucket };
    })
    .filter((item) => item.bucket === 'Other' && item.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20)
    .map(({ source, medium, channel, sessions }) => ({
      source,
      medium,
      channel,
      sessions,
    }));
}

function buildTopPages(report: GaReport) {
  return (report.rows || []).map((row) => ({
    path: dimensionValue(report, row, 'pagePath') || '/',
    pageViews: rowMetricValue(report, row, 'screenPageViews'),
  }));
}


export default async function createAssistedPaymentHandler(
  req: Request,
  res: Response
) {
  const mode = typeof req.query.mode === 'string' ? req.query.mode : '';

  // /api/admin/analytics is rewritten to this existing function so we do not
  // create a 13th Vercel Function on the Hobby plan.
  if (mode === 'analytics') {
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

      return res.status(200).json({
        success: true,
        range,
        dateRange,
        source: 'GA4',
        propertyId: GA4_PROPERTY_ID,
        summary: {
          visitors: metricTotal(summaryReport, 'activeUsers'),
          pageViews: metricTotal(summaryReport, 'screenPageViews'),
          sessions: metricTotal(summaryReport, 'sessions'),
          newUsers: metricTotal(summaryReport, 'newUsers'),
        },
        trafficSources: buildTrafficSources(trafficReport),
        otherTrafficBreakdown: buildOtherTrafficBreakdown(trafficReport),
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

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    const { action, adId, plan, successUrl, cancelUrl } = req.body || {};

    // Reuse this existing Serverless Function for the Finance password gate so
    // the Vercel Hobby project stays within its 12-function limit.
    if (action === 'verifyFinanceAccess') {
      const configuredPassword = process.env.FINANCE_ACCESS_PASSWORD;

      if (!configuredPassword) {
        return res.status(503).json({
          success: false,
          error: 'FINANCE_PASSWORD_NOT_CONFIGURED',
          errorMessage: 'Financial access password is not configured on the server.',
        });
      }

      const db = getAdminDb();
      const adminCheck = await verifyAdminRequest(req, db);

      if (!adminCheck.ok) {
        return res.status(adminCheck.status).json({
          success: false,
          error: adminCheck.code,
          errorMessage: adminCheck.message,
        });
      }

      const ownerEmails = new Set([
        'valtailubereats@gmail.com',
        'valtail@gmail.com',
        'generalsales2021@gmail.com',
      ]);

      const isOwner = ownerEmails.has(
        (adminCheck.email || '').trim().toLowerCase()
      );

      if (!isOwner) {
        const userDoc = await db.collection('users').doc(adminCheck.uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};

        if (userData.role !== 'admin' || userData.financeAccess !== true) {
          return res.status(403).json({
            success: false,
            error: 'FINANCE_ACCESS_DENIED',
            errorMessage: 'Financial access has not been granted to this administrator.',
          });
        }
      }

      const password =
        typeof req.body?.password === 'string' ? req.body.password : '';

      if (!password || !passwordsMatch(password, configuredPassword)) {
        return res.status(403).json({
          success: false,
          error: 'INVALID_FINANCE_PASSWORD',
          errorMessage: 'Incorrect financial access password.',
        });
      }

      return res.status(200).json({
        success: true,
      });
    }


    if (action === 'rejectAndRefundMarineEvent') {
      const eventId =
        typeof req.body?.eventId === 'string'
          ? req.body.eventId.trim()
          : '';

      if (!eventId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_EVENT_ID',
          errorMessage: 'A valid Marine Event ID is required.',
        });
      }

      const db = getAdminDb();
      const adminCheck = await verifyAdminRequest(req, db);

      if (!adminCheck.ok) {
        return res.status(adminCheck.status).json({
          success: false,
          error: adminCheck.code,
          errorMessage: adminCheck.message,
        });
      }

      const eventRef = db.collection('marineEvents').doc(eventId);
      const eventSnapshot = await eventRef.get();

      if (!eventSnapshot.exists) {
        return res.status(404).json({
          success: false,
          error: 'EVENT_NOT_FOUND',
          errorMessage: 'The Marine Event could not be found.',
        });
      }

      const eventData = eventSnapshot.data() || {};
      const eventPlan = String(eventData.plan || 'standard').toLowerCase();

      if (eventPlan !== 'featured' && eventPlan !== 'premium') {
        return res.status(409).json({
          success: false,
          error: 'EVENT_PLAN_NOT_PAID',
          errorMessage: 'Only paid Featured or Premium Marine Events use the automatic Stripe refund flow.',
        });
      }

      if (eventData.paymentStatus !== 'paid') {
        return res.status(409).json({
          success: false,
          error: 'EVENT_NOT_PAID',
          errorMessage: 'This Marine Event does not have a confirmed Stripe payment to refund.',
        });
      }

      if (eventData.approvalStatus !== 'pending') {
        return res.status(409).json({
          success: false,
          error: 'EVENT_NOT_PENDING_APPROVAL',
          errorMessage: 'Only Marine Events still waiting for approval can be rejected through this refund flow.',
        });
      }

      const amountPaid = Number(eventData.amountPaid || eventData.pricePaid || 0);
      const amountRefunded = Number(eventData.amountRefunded || 0);
      const remainingAmount = Math.max(0, amountPaid - amountRefunded);

      const paymentIntentId =
        typeof eventData.stripePaymentIntentId === 'string'
          ? eventData.stripePaymentIntentId.trim()
          : '';

      if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
        return res.status(409).json({
          success: false,
          error: 'PAYMENT_AMOUNT_UNAVAILABLE',
          errorMessage: 'The original Marine Event payment amount is unavailable.',
        });
      }

      if (remainingAmount <= 0.0001) {
        return res.status(409).json({
          success: false,
          error: 'ALREADY_FULLY_REFUNDED',
          errorMessage: 'This Marine Event has already been fully refunded.',
        });
      }

      if (!paymentIntentId) {
        return res.status(409).json({
          success: false,
          error: 'PAYMENT_INTENT_UNAVAILABLE',
          errorMessage: 'Stripe Payment Intent is unavailable for this Marine Event.',
        });
      }

      const stripe = getStripe();
      const amountCents = Math.round(remainingAmount * 100);

      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: amountCents,
          metadata: {
            source: 'connectboat_marine_event_rejection',
            eventId,
            refundedBy: adminCheck.email || adminCheck.uid,
          },
        },
        {
          idempotencyKey:
            `connectboat-marine-event-refund-${eventId}-${Math.round(amountRefunded * 100)}-${amountCents}`,
        }
      );

      const actualRefundAmount = refund.amount / 100;
      const newRefundedTotal = Math.min(
        amountPaid,
        Math.round((amountRefunded + actualRefundAmount) * 100) / 100
      );

      const refundDate = new Date();

      await eventRef.update({
        approvalStatus: 'rejected',
        status: 'rejected',
        active: false,
        awaitingAdminApproval: false,
        refundRequired: false,
        refundStatus: 'refunded',
        amountRefunded: newRefundedTotal,
        refundedAt: refundDate,
        stripeRefundId: refund.id,
        stripeRefundStatus: refund.status || 'unknown',
        paymentStatus: 'refunded',
        updatedAt: refundDate,
      });

      let refundEmailSent = false;
      let refundEmailRecipient = '';
      let refundEmailError = '';

      try {
        refundEmailRecipient = await resolveRefundRecipientEmail(db, eventData);

        if (refundEmailRecipient) {
          await sendRefundEmailDirect(
            refundEmailRecipient,
            {
              customerName:
                eventData.submittedByName ||
                eventData.organizerName ||
                '',
              listingTitle:
                eventData.title ||
                eventId,
              amountRefunded: actualRefundAmount,
              currency: eventData.currency || 'GBP',
              refundId: refund.id,
              paymentIntentId,
              refundDate,
            }
          );

          refundEmailSent = true;

          await eventRef.update({
            refundEmailSent: true,
            refundEmailSentAt: new Date(),
            refundEmailRecipient,
            refundEmailError: '',
          });
        }
      } catch (emailError: any) {
        refundEmailError =
          emailError?.message ||
          'Refund completed, but the confirmation email could not be sent.';

        console.error(
          `[Marine Event Refund Email] Refund ${refund.id} completed but email failed:`,
          emailError
        );

        await eventRef.update({
          refundEmailSent: false,
          refundEmailRecipient,
          refundEmailError: refundEmailError.slice(0, 1000),
        });
      }

      return res.status(200).json({
        success: true,
        eventId,
        refundId: refund.id,
        stripeRefundStatus: refund.status || 'unknown',
        amountRefunded: actualRefundAmount,
        totalRefunded: newRefundedTotal,
        refundEmailSent,
        refundEmailRecipient,
        refundEmailError,
      });
    }

    if (action === 'refundFinancePayment') {
      const configuredPassword = process.env.FINANCE_ACCESS_PASSWORD;

      if (!configuredPassword) {
        return res.status(503).json({
          success: false,
          error: 'FINANCE_PASSWORD_NOT_CONFIGURED',
          errorMessage: 'Financial access password is not configured on the server.',
        });
      }

      if (!adId || typeof adId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'MISSING_AD_ID',
          errorMessage: 'A valid listing ID is required.',
        });
      }

      const db = getAdminDb();
      const adminCheck = await verifyAdminRequest(req, db);

      if (!adminCheck.ok) {
        return res.status(adminCheck.status).json({
          success: false,
          error: adminCheck.code,
          errorMessage: adminCheck.message,
        });
      }

      const ownerEmails = new Set([
        'valtailubereats@gmail.com',
        'valtail@gmail.com',
        'generalsales2021@gmail.com',
      ]);
      const isOwner = ownerEmails.has((adminCheck.email || '').trim().toLowerCase());

      if (!isOwner) {
        const userDoc = await db.collection('users').doc(adminCheck.uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};
        if (userData.role !== 'admin' || userData.financeAccess !== true) {
          return res.status(403).json({
            success: false,
            error: 'FINANCE_ACCESS_DENIED',
            errorMessage: 'Financial access has not been granted to this administrator.',
          });
        }
      }

      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!password || !passwordsMatch(password, configuredPassword)) {
        return res.status(403).json({
          success: false,
          error: 'INVALID_FINANCE_PASSWORD',
          errorMessage: 'Incorrect financial access password.',
        });
      }

      const adRef = db.collection('ads').doc(adId);
      const adSnapshot = await adRef.get();
      if (!adSnapshot.exists) {
        return res.status(404).json({
          success: false,
          error: 'AD_NOT_FOUND',
          errorMessage: 'The listing could not be found.',
        });
      }

      const adData = adSnapshot.data() || {};
      const amountPaid = Number(adData.amountPaid || 0);
      const amountRefunded = Number(adData.amountRefunded || 0);
      const remainingAmount = Math.max(0, amountPaid - amountRefunded);
      const paymentIntentId = typeof adData.stripePaymentIntentId === 'string'
        ? adData.stripePaymentIntentId.trim()
        : '';

      if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
        return res.status(409).json({
          success: false,
          error: 'PAYMENT_AMOUNT_UNAVAILABLE',
          errorMessage: 'This transaction does not have a captured historical payment amount.',
        });
      }

      if (remainingAmount <= 0.0001) {
        return res.status(409).json({
          success: false,
          error: 'ALREADY_FULLY_REFUNDED',
          errorMessage: 'This transaction has already been fully refunded.',
        });
      }

      if (!paymentIntentId) {
        return res.status(409).json({
          success: false,
          error: 'PAYMENT_INTENT_UNAVAILABLE',
          errorMessage: 'Stripe Payment Intent is unavailable for this transaction.',
        });
      }

      const amountCents = Math.round(remainingAmount * 100);
      const stripe = getStripe();
      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: amountCents,
          metadata: {
            source: 'connectboat_finance_dashboard',
            adId,
            refundedBy: adminCheck.email || adminCheck.uid,
          },
        },
        {
          idempotencyKey: `connectboat-finance-refund-${adId}-${Math.round(amountRefunded * 100)}-${amountCents}`,
        }
      );

      const actualRefundAmount = refund.amount / 100;
      const newRefundedTotal = Math.min(
        amountPaid,
        Math.round((amountRefunded + actualRefundAmount) * 100) / 100
      );
      const fullyRefunded = newRefundedTotal >= amountPaid - 0.0001;

      const refundDate = new Date();

      await adRef.update({
        amountRefunded: newRefundedTotal,
        refundStatus: fullyRefunded ? 'refunded' : 'partially_refunded',
        refundedAt: refundDate,
        stripeRefundId: refund.id,
        stripeRefundStatus: refund.status || 'unknown',
        paymentStatus: fullyRefunded ? 'refunded' : 'partially_refunded',
        refundEmailSent: false,
        refundEmailRecipient: '',
        refundEmailResendId: '',
        refundEmailError: '',
      });

      let refundEmailSent = false;
      let refundEmailRecipient = '';
      let refundEmailResendId = '';
      let refundEmailError = '';

      try {
        refundEmailRecipient = await resolveRefundRecipientEmail(db, adData);

        if (!refundEmailRecipient) {
          throw new Error(
            'Customer email could not be resolved from the listing or user account.'
          );
        }

        const emailResult = await sendRefundEmailDirect(
          refundEmailRecipient,
          {
            customerName:
              adData.sellerName ||
              adData.userName ||
              adData.ownerName ||
              adData.contactName ||
              '',
            listingTitle: adData.title || adId,
            amountRefunded: actualRefundAmount,
            currency: adData.currency || 'GBP',
            refundId: refund.id,
            paymentIntentId,
            refundDate,
          }
        );

        refundEmailSent = true;
        refundEmailResendId = emailResult.id || '';

        await adRef.update({
          refundEmailSent: true,
          refundEmailSentAt: new Date(),
          refundEmailRecipient,
          refundEmailResendId,
          refundEmailError: '',
        });
      } catch (emailError: any) {
        refundEmailError =
          emailError?.message ||
          'Refund completed, but the confirmation email could not be sent.';

        console.error(
          `[Finance Refund Email] Refund ${refund.id} completed but email failed:`,
          emailError
        );

        await adRef.update({
          refundEmailSent: false,
          refundEmailRecipient,
          refundEmailError: refundEmailError.slice(0, 1000),
        });
      }

      return res.status(200).json({
        success: true,
        refundId: refund.id,
        stripeRefundStatus: refund.status || 'unknown',
        amountRefunded: actualRefundAmount,
        totalRefunded: newRefundedTotal,
        fullyRefunded,
        refundEmailSent,
        refundEmailRecipient,
        refundEmailResendId,
        refundEmailError,
      });
    }

    if (
      action === 'listFinanceExpenses' ||
      action === 'addFinanceExpense' ||
      action === 'deleteFinanceExpense' ||
      action === 'getFinancePeriod' ||
      action === 'startNewFinancePeriod'
    ) {
      const configuredPassword = process.env.FINANCE_ACCESS_PASSWORD;

      if (!configuredPassword) {
        return res.status(503).json({
          success: false,
          error: 'FINANCE_PASSWORD_NOT_CONFIGURED',
          errorMessage: 'Financial access password is not configured on the server.',
        });
      }

      const db = getAdminDb();
      const adminCheck = await verifyAdminRequest(req, db);

      if (!adminCheck.ok) {
        return res.status(adminCheck.status).json({
          success: false,
          error: adminCheck.code,
          errorMessage: adminCheck.message,
        });
      }

      const ownerEmails = new Set([
        'valtailubereats@gmail.com',
        'valtail@gmail.com',
        'generalsales2021@gmail.com',
      ]);

      const isOwner = ownerEmails.has(
        (adminCheck.email || '').trim().toLowerCase()
      );

      if (!isOwner) {
        const userDoc = await db.collection('users').doc(adminCheck.uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};

        if (userData.role !== 'admin' || userData.financeAccess !== true) {
          return res.status(403).json({
            success: false,
            error: 'FINANCE_ACCESS_DENIED',
            errorMessage: 'Financial access has not been granted to this administrator.',
          });
        }
      }

      const password =
        typeof req.body?.password === 'string' ? req.body.password : '';

      if (!password || !passwordsMatch(password, configuredPassword)) {
        return res.status(403).json({
          success: false,
          error: 'INVALID_FINANCE_PASSWORD',
          errorMessage: 'Incorrect financial access password.',
        });
      }

      const expensesCollection = db.collection('financeExpenses');

      const financeConfigRef = db.collection('systemSettings').doc('finance');

      if (action === 'getFinancePeriod') {
        const configSnapshot = await financeConfigRef.get();
        const config = configSnapshot.exists ? (configSnapshot.data() || {}) : {};
        return res.status(200).json({
          success: true,
          periodStart: typeof config.periodStart === 'string' ? config.periodStart : '',
        });
      }

      if (action === 'startNewFinancePeriod') {
        const periodStart = new Date().toISOString();
        await financeConfigRef.set({
          periodStart,
          periodStartedAt: new Date(),
          periodStartedByUid: adminCheck.uid,
          periodStartedByEmail: adminCheck.email || '',
        }, { merge: true });
        return res.status(200).json({ success: true, periodStart });
      }

      if (action === 'listFinanceExpenses') {
        const snapshot = await expensesCollection.get();
        const expenses = snapshot.docs
          .map((docSnapshot: any) => ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          }))
          .sort((a: any, b: any) =>
            String(b.expenseDate || '').localeCompare(String(a.expenseDate || ''))
          );

        return res.status(200).json({
          success: true,
          expenses,
        });
      }

      if (action === 'addFinanceExpense') {
        const expenseDate =
          typeof req.body?.expenseDate === 'string'
            ? req.body.expenseDate.trim()
            : '';
        const category =
          typeof req.body?.category === 'string'
            ? req.body.category.trim()
            : '';
        const description =
          typeof req.body?.description === 'string'
            ? req.body.description.trim()
            : '';
        const amount = Number(req.body?.amount);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_EXPENSE_DATE',
            errorMessage: 'A valid expense date is required.',
          });
        }

        if (!category || !description) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_EXPENSE_DETAILS',
            errorMessage: 'Expense category and description are required.',
          });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_EXPENSE_AMOUNT',
            errorMessage: 'Expense amount must be greater than zero.',
          });
        }

        const roundedAmount = Math.round(amount * 100) / 100;
        const expenseRef = expensesCollection.doc();

        await expenseRef.set({
          expenseDate,
          category,
          description,
          amount: roundedAmount,
          currency: 'GBP',
          createdAt: new Date(),
          createdByUid: adminCheck.uid,
          createdByEmail: adminCheck.email || '',
        });

        return res.status(200).json({
          success: true,
          expense: {
            id: expenseRef.id,
            expenseDate,
            category,
            description,
            amount: roundedAmount,
            currency: 'GBP',
          },
        });
      }

      const expenseId =
        typeof req.body?.expenseId === 'string'
          ? req.body.expenseId.trim()
          : '';

      if (!expenseId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_EXPENSE_ID',
          errorMessage: 'Expense ID is required.',
        });
      }

      const expenseRef = expensesCollection.doc(expenseId);
      const expenseSnapshot = await expenseRef.get();

      if (!expenseSnapshot.exists) {
        return res.status(404).json({
          success: false,
          error: 'EXPENSE_NOT_FOUND',
          errorMessage: 'The expense could not be found.',
        });
      }

      await expenseRef.delete();

      return res.status(200).json({
        success: true,
        expenseId,
      });
    }

    if (!adId || typeof adId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AD_ID',
        errorMessage: 'A valid listing ID is required.',
      });
    }

    const normalizedPlan =
      typeof plan === 'string' ? plan.trim().toLowerCase() : '';

    const allowedPlans = new Set([
      'standard',
      'featured',
      'premium'
    ]);

    if (!allowedPlans.has(normalizedPlan)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PLAN',
        errorMessage: 'Plan must be standard, featured, or premium.',
      });
    }

    const db = getAdminDb();

    const adminCheck = await verifyAdminRequest(req, db);

    if (!adminCheck.ok) {
      return res.status(adminCheck.status).json({
        success: false,
        error: adminCheck.code,
        errorMessage: adminCheck.message,
      });
    }

    const adSnapshot = await db.collection('ads').doc(adId).get();

    if (!adSnapshot.exists) {
      return res.status(404).json({
        success: false,
        error: 'AD_NOT_FOUND',
        errorMessage: 'The listing could not be found.',
      });
    }

    const adData = adSnapshot.data() || {};

    const paymentStatus =
      typeof adData.paymentStatus === 'string'
        ? adData.paymentStatus.toLowerCase()
        : '';

    const isAlreadyPaid = Boolean(
      adData.paidAt ||
      adData.paymentCompletedAt ||
      paymentStatus === 'paid' ||
      paymentStatus === 'completed'
    );

    if (isAlreadyPaid) {
      return res.status(409).json({
        success: false,
        error: 'AD_ALREADY_PAID',
        errorMessage: 'This listing is already marked as paid.',
      });
    }

    const settingsSnapshot = await db
      .collection('settings')
      .doc('global')
      .get();

    const settingsData = settingsSnapshot.exists
      ? settingsSnapshot.data()
      : {};

    const configuredPlanPrices = settingsData?.planPrices || {};

    const planPrices = {
      standard: getValidConfiguredPrice(
        configuredPlanPrices.standard,
        4.99
      ),
      featured: getValidConfiguredPrice(
        configuredPlanPrices.featured,
        7.99
      ),
      premium: getValidConfiguredPrice(
        configuredPlanPrices.premium,
        12.99
      ),
    };

    const amount =
      planPrices[normalizedPlan as keyof typeof planPrices];

    const amountCents = Math.round(amount * 100);

    const productNames = {
      standard: 'ConnectBoat - Standard Listing',
      featured: 'ConnectBoat - Featured Listing',
      premium: 'ConnectBoat - Premium Featured Listing',
    };

    const productDescriptions = {
      standard:
        `30-day active listing (£${amount.toFixed(2)}) for listing #${adId}`,
      featured:
        `30-day homepage highlight & featured badge (£${amount.toFixed(2)}) for listing #${adId}`,
      premium:
        `30-day top priority exposure & premium badge (£${amount.toFixed(2)}) for listing #${adId}`,
    };

    const origin =
      req.headers.origin || 'https://connectboat.co.uk';

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',

      line_items: [
        {
          price_data: {
            currency: 'gbp',

            product_data: {
              name:
                productNames[
                  normalizedPlan as keyof typeof productNames
                ],

              description:
                productDescriptions[
                  normalizedPlan as keyof typeof productDescriptions
                ],
            },

            unit_amount: amountCents,
          },

          quantity: 1,
        },
      ],

      managed_payments: {
        enabled: false,
      } as any,

      metadata: {
        itemType: 'ad_listing',
        adId,
        plan: normalizedPlan,
        paymentFlow: 'admin_assisted',
        createdByAdminUid: adminCheck.uid,
      },

      success_url:
        typeof successUrl === 'string' && successUrl
          ? successUrl
          : `${origin}/?assisted_payment=success&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        typeof cancelUrl === 'string' && cancelUrl
          ? cancelUrl
          : `${origin}/?assisted_payment=cancelled`,
    });

    if (!session.url) {
      throw new Error(
        'Stripe did not return a Checkout URL.'
      );
    }

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
      adId,
      plan: normalizedPlan,
      amount,
      currency: 'gbp',
    });

  } catch (err: any) {
    console.error(
      '[Admin Assisted Payment Error]:',
      err
    );

    return res.status(500).json({
      success: false,
      error: 'ASSISTED_PAYMENT_ERROR',
      errorMessage:
        err?.message ||
        'Error creating assisted Stripe Checkout.',
    });
  }
}
