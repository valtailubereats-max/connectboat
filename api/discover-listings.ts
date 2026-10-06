import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

console.log('[discover-listings] MODULE_LOAD: Module initialized successfully');

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

let adminDbInstance: any = null;

function getAdminDb() {
  const firebaseAdmin = (admin as any).default || admin;

  if (!adminDbInstance) {
    const apps = firebaseAdmin.apps || [];

    if (!apps.length) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

      if (serviceAccountJson) {
        try {
          let serviceAccount: any;

          try {
            serviceAccount = JSON.parse(serviceAccountJson);
          } catch {
            const decoded = Buffer.from(serviceAccountJson, 'base64').toString('utf-8');
            serviceAccount = JSON.parse(decoded);
          }

          if (typeof serviceAccount.private_key === 'string') {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          }

          firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
            projectId: PROJECT_ID,
          });
        } catch (e: any) {
          console.error(
            `[discover-listings getAdminDb] Service Account init failed: ${e?.message || e}. Falling back to default app init.`
          );
          firebaseAdmin.initializeApp({ projectId: PROJECT_ID });
        }
      } else {
        firebaseAdmin.initializeApp({ projectId: PROJECT_ID });
      }
    }

    adminDbInstance = firebaseAdmin.firestore();

    if (DATABASE_ID) {
      try {
        adminDbInstance.settings({ databaseId: DATABASE_ID });
      } catch {
        // Firestore settings may already have been applied.
      }
    }
  }

  return adminDbInstance;
}


// British Marine discovery is intentionally kept inside this existing API file.
// Every executable file under /api becomes a Vercel Function, and the Hobby
// deployment is already at its 12-function limit.
const BRITISH_MARINE_ROOT = 'https://www.britishmarine.co.uk';
const BRITISH_MARINE_INDEXES = [
  `${BRITISH_MARINE_ROOT}/membership/events`,
  `${BRITISH_MARINE_ROOT}/membership/events-and-courses`,
];
const BRITISH_MARINE_COLLECTION = 'externalEventCandidates';
const BRITISH_MARINE_MAX_EVENTS = 12;
const BRITISH_MARINE_TIMEOUT_MS = 9000;

const BRITISH_MARINE_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const BRITISH_MARINE_UK_HINTS = [
  'Southampton', 'Portsmouth', 'Plymouth', 'Poole', 'Cowes', 'London',
  'Farnborough', 'Basingstoke', 'Lymington', 'Bedfordshire', 'Birmingham',
  'Bristol', 'Liverpool', 'Manchester', 'Glasgow', 'Edinburgh', 'Cardiff',
  'Belfast', 'Brighton', 'Bournemouth', 'Hampshire', 'Dorset', 'Essex',
  'Kent', 'Suffolk', 'Norfolk', 'Cornwall', 'Devon', 'Solent', 'Argyll',
  'Luss', 'Loch Lomond', 'Cranfield', 'Bedford', 'York', 'Ipswich',
];

function decodeBritishMarineHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&#(\d+);/g, (_, number) => String.fromCharCode(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCharCode(parseInt(number, 16)));
}

function britishMarineTextFromHtml(html: string) {
  return decodeBritishMarineHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function cleanBritishMarineText(value: unknown) {
  return typeof value === 'string'
    ? decodeBritishMarineHtml(value).replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeBritishMarineText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalizeBritishMarineUrl(value: string) {
  try {
    const url = new URL(value, BRITISH_MARINE_ROOT);
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';

    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.startsWith('utm_')
        || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(normalizedKey)
      ) {
        url.searchParams.delete(key);
      }
    }

    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

async function fetchBritishMarineHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRITISH_MARINE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ConnectBoat Events Discovery/1.0 (+https://connectboat.co.uk)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export function extractBritishMarineEventLinks(html: string) {
  const links = new Set<string>();

  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const canonicalUrl = canonicalizeBritishMarineUrl(match[1]);
    if (!canonicalUrl) continue;

    const parsed = new URL(canonicalUrl);
    if (parsed.hostname !== 'britishmarine.co.uk') continue;

    const path = parsed.pathname.replace(/\/$/, '');
    const prefix = ['/membership/events/', '/membership/events-and-courses/']
      .find((candidate) => path.startsWith(candidate));
    if (!prefix) continue;

    const slug = path.slice(prefix.length);
    if (!slug || slug.includes('/')) continue;

    parsed.search = '';
    links.add(parsed.toString().replace(/\/$/, ''));
  }

  return [...links];
}

function britishMarineIsoDate(day: number, month: string, year: number) {
  const monthNumber = BRITISH_MARINE_MONTHS[month.toLowerCase()];
  return monthNumber
    ? `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : '';
}

export function extractBritishMarineDates(text: string) {
  const monthPattern = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const fullRange = text.match(new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\s+(20\\d{2})\\s*[–—-]\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\s+(20\\d{2})\\b`,
    'i',
  ));
  if (fullRange) {
    return {
      startDate: britishMarineIsoDate(Number(fullRange[1]), fullRange[2], Number(fullRange[3])),
      endDate: britishMarineIsoDate(Number(fullRange[4]), fullRange[5], Number(fullRange[6])),
    };
  }

  const sameMonthRange = text.match(new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*[–—-]\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\s+(20\\d{2})\\b`,
    'i',
  ));
  if (sameMonthRange) {
    return {
      startDate: britishMarineIsoDate(Number(sameMonthRange[1]), sameMonthRange[3], Number(sameMonthRange[4])),
      endDate: britishMarineIsoDate(Number(sameMonthRange[2]), sameMonthRange[3], Number(sameMonthRange[4])),
    };
  }

  const singleDate = text.match(new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\s+(20\\d{2})\\b`,
    'i',
  ));
  if (singleDate) {
    const value = britishMarineIsoDate(Number(singleDate[1]), singleDate[2], Number(singleDate[3]));
    return { startDate: value, endDate: value };
  }

  return { startDate: '', endDate: '' };
}

export function extractBritishMarineLocation(text: string, title: string) {
  const labelledLocation = cleanBritishMarineText(
    text.match(
      /(?:^|\n)(?:Where|Location|Venue)\s*:?\s*([^\n]{0,220})/i,
    )?.[1] || '',
  );

  // Trust only the event's labelled location. Searching the whole page can
  // pick up British Marine's Southampton footer address and make overseas
  // events look like UK events.
  const postcodeMatch = labelledLocation.match(
    /\b(?:GIR ?0AA|(?:[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}))\b/i,
  );
  const city = BRITISH_MARINE_UK_HINTS.find(
    (hint) => new RegExp(`\\b${hint}\\b`, 'i').test(labelledLocation),
  ) || '';
  const isUk = Boolean(city)
    || /\b(?:United Kingdom|Great Britain|England|Scotland|Wales|Northern Ireland|UK)\b/i.test(labelledLocation)
    || Boolean(postcodeMatch);

  return {
    isUk,
    city,
    venue: labelledLocation,
    country: isUk ? 'United Kingdom' : '',
  };
}

function isRelevantBritishMarineEvent(title: string) {
  if (
    /\b(committee|board meeting|council meeting|agm|webinar|course|training|workshop|christmas lunch|annual dinner|awards dinner|member drop-in|social media)\b/i.test(title)
  ) {
    return false;
  }

  return /\b(boat show|yacht show|trade show|seawork|metstrade|regatta|marine|boating|marina|superyacht|watersports|sailing|passenger boat|exhibition|expo|festival|conference)\b/i.test(title);
}

function getBritishMarineCategory(title: string) {
  if (/\b(regatta|race|racing|sailing championship)\b/i.test(title)) return 'Regattas';
  if (/\bfestival\b/i.test(title)) return 'Festivals';
  if (/\b(boat show|yacht show|trade show|exhibition|expo|seawork|metstrade)\b/i.test(title)) {
    return 'Boat Shows';
  }
  return 'Marine Events';
}

function getBritishMarineTitle(html: string) {
  // British Marine detail pages can place promotional H2 headings before the
  // actual event content. The document <title> is much more reliable and
  // normally follows "Event Name :: British Marine".
  const documentTitle = cleanBritishMarineText(
    britishMarineTextFromHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''),
  )
    .replace(/\s*::\s*British Marine.*$/i, '')
    .trim();

  if (
    documentTitle
    && !/^British Marine$/i.test(documentTitle)
    && !/^Events?(?: and Courses)?$/i.test(documentTitle)
  ) {
    return documentTitle;
  }

  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1];

  return heading
    ? cleanBritishMarineText(britishMarineTextFromHtml(heading))
    : documentTitle;
}

async function parseBritishMarineEvent(url: string) {
  const html = await fetchBritishMarineHtml(url);
  const text = britishMarineTextFromHtml(html);
  const title = getBritishMarineTitle(html);
  const dateRange = extractBritishMarineDates(text);
  const location = extractBritishMarineLocation(text, title);
  const externalId = new URL(url).pathname.replace(/\/$/, '').split('/').pop() || '';

  return {
    title,
    ...dateRange,
    ...location,
    category: getBritishMarineCategory(title),
    website: url,
    ticketUrl: '',
    sourceUrl: url,
    externalId,
    isRelevant: isRelevantBritishMarineEvent(title),
  };
}

export function getBritishMarineCandidateId(
  externalId: string,
  sourceUrl: string,
  dedupeKey: string,
) {
  return `bm_${createHash('sha256')
    .update(externalId || sourceUrl || dedupeKey)
    .digest('hex')
    .slice(0, 20)}`;
}

async function verifyDiscoveryStaff(req: any) {
  const firebaseAdmin = (admin as any).default || admin;
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = typeof authHeader === 'string'
    ? authHeader.match(/^Bearer\s+(.+)$/i)
    : null;

  if (!match) {
    const error: any = new Error('Autenticação necessária. Faça login como administrador ou moderador.');
    error.statusCode = 401;
    error.code = 'UNAUTHENTICATED';
    throw error;
  }

  // Initialize Firebase Admin before verifyIdToken().
  const db = getAdminDb();

  let decodedToken: any;
  try {
    decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
  } catch (verifyError) {
    console.error('[discover-listings] Firebase token verification failed:', verifyError);

    const error: any = new Error('Token de autenticação Firebase inválido ou expirado.');
    error.statusCode = 401;
    error.code = 'INVALID_AUTH_TOKEN';
    throw error;
  }

  const email = typeof decodedToken.email === 'string'
    ? decodedToken.email.trim().toLowerCase()
    : '';

  const explicitAdminEmails = new Set([
    'valtailubereats@gmail.com',
    'valtail@gmail.com',
    'generalsales2021@gmail.com',
  ]);

  if (explicitAdminEmails.has(email)) {
    return {
      uid: decodedToken.uid,
      email,
      role: 'admin',
    };
  }

  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (role !== 'admin' && role !== 'moderator') {
    const error: any = new Error(
      'Acesso negado. Apenas administradores ou moderadores podem realizar a descoberta de anúncios.'
    );
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  return {
    uid: decodedToken.uid,
    email,
    role,
  };
}


async function discoverBritishMarineEvents(req: any, res: any) {
  if (res && typeof res.setHeader === 'function' && !res.headersSent) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
  }

  if (req?.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  try {
    const staff = await verifyDiscoveryStaff(req);
    if (staff.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Administrator access required.',
      });
    }

    const db = getAdminDb();
    const indexResults = await Promise.allSettled(
      BRITISH_MARINE_INDEXES.map(fetchBritishMarineHtml),
    );
    const links = new Set<string>();
    const errors: string[] = [];

    indexResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        extractBritishMarineEventLinks(result.value).forEach((url) => links.add(url));
      } else {
        errors.push(
          `${BRITISH_MARINE_INDEXES[index]}: ${result.reason instanceof Error ? result.reason.message : 'Source error'}`,
        );
      }
    });

    const selectedLinks = [...links].slice(0, BRITISH_MARINE_MAX_EVENTS);
    if (!selectedLinks.length) {
      return res.status(502).json({
        success: false,
        error: 'British Marine returned no event links. The source page structure may have changed.',
      });
    }

    const [existingCandidates, approvedBritishMarineEvents] = await Promise.all([
      db.collection(BRITISH_MARINE_COLLECTION).get(),
      db.collection('marineEvents').where('sourceName', '==', 'British Marine').get(),
    ]);
    const dedupeKeys = new Set<string>();
    const sourceUrls = new Set<string>();
    const britishMarineExternalIds = new Set<string>();

    const rememberKnownEvent = (event: any) => {
      if (event.dedupeKey) dedupeKeys.add(String(event.dedupeKey));
      if (event.title && event.startDate && event.city) {
        dedupeKeys.add([
          normalizeBritishMarineText(String(event.title)),
          String(event.startDate),
          normalizeBritishMarineText(String(event.city)),
        ].join('|'));
      }
      if (event.sourceUrl) {
        sourceUrls.add(canonicalizeBritishMarineUrl(String(event.sourceUrl)));
      }
      if (event.sourceName === 'British Marine' && event.externalId) {
        britishMarineExternalIds.add(String(event.externalId));
      }
    };

    existingCandidates.docs.forEach((snapshot: any) => rememberKnownEvent(snapshot.data() || {}));
    approvedBritishMarineEvents.docs.forEach((snapshot: any) => rememberKnownEvent(snapshot.data() || {}));

    const report = {
      checked: selectedLinks.length,
      eligible: 0,
      created: 0,
      existing: 0,
      skippedPast: 0,
      skippedNonUk: 0,
      skippedIrrelevant: 0,
      skippedIncomplete: 0,
    };
    const today = new Date().toISOString().slice(0, 10);
    const firebaseAdmin = (admin as any).default || admin;

    for (let index = 0; index < selectedLinks.length; index += 3) {
      const batch = selectedLinks.slice(index, index + 3);
      const results = await Promise.allSettled(batch.map(parseBritishMarineEvent));

      for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
        const result = results[resultIndex];
        if (result.status === 'rejected') {
          errors.push(
            `${batch[resultIndex]}: ${result.reason instanceof Error ? result.reason.message : 'Detail error'}`,
          );
          continue;
        }

        const event = result.value;
        if (!event.title || !event.startDate || !event.city) {
          report.skippedIncomplete += 1;
          continue;
        }
        if (!event.isUk) {
          report.skippedNonUk += 1;
          continue;
        }
        if (!event.isRelevant) {
          report.skippedIrrelevant += 1;
          continue;
        }
        if ((event.endDate || event.startDate) < today) {
          report.skippedPast += 1;
          continue;
        }

        report.eligible += 1;
        const dedupeKey = [
          normalizeBritishMarineText(event.title),
          event.startDate,
          normalizeBritishMarineText(event.city),
        ].join('|');
        const sourceUrl = canonicalizeBritishMarineUrl(event.sourceUrl);

        if (
          dedupeKeys.has(dedupeKey)
          || sourceUrls.has(sourceUrl)
          || britishMarineExternalIds.has(event.externalId)
        ) {
          report.existing += 1;
          continue;
        }

        const candidateId = getBritishMarineCandidateId(
          event.externalId,
          sourceUrl,
          dedupeKey,
        );
        const candidateRef = db.collection(BRITISH_MARINE_COLLECTION).doc(candidateId);
        const now = firebaseAdmin.firestore.FieldValue.serverTimestamp();

        try {
          await candidateRef.create({
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            country: event.country,
            city: event.city,
            venue: event.venue,
            category: event.category,
            website: event.website,
            ticketUrl: event.ticketUrl,
            source: 'imported',
            sourceName: 'British Marine',
            sourceUrl: event.sourceUrl,
            externalId: event.externalId,
            externalSources: [{
              sourceName: 'British Marine',
              sourceUrl: event.sourceUrl,
              externalId: event.externalId,
            }],
            reviewStatus: 'pending',
            dedupeKey,
            normalizedTitle: normalizeBritishMarineText(event.title),
            normalizedCity: normalizeBritishMarineText(event.city),
            normalizedVenue: normalizeBritishMarineText(event.venue),
            canonicalWebsite: canonicalizeBritishMarineUrl(event.website),
            possibleDuplicateOf: '',
            duplicateConfidence: 0,
            firstFoundAt: now,
            lastCheckedAt: now,
            lastSeenAt: now,
            adminEditedFields: [],
            createdBy: staff.uid,
            createdAt: now,
            updatedAt: now,
          });
        } catch (error: any) {
          if (error?.code === 6 || error?.code === '6' || error?.code === 'already-exists') {
            report.existing += 1;
            dedupeKeys.add(dedupeKey);
            sourceUrls.add(sourceUrl);
            britishMarineExternalIds.add(event.externalId);
            continue;
          }
          throw error;
        }

        dedupeKeys.add(dedupeKey);
        sourceUrls.add(sourceUrl);
        britishMarineExternalIds.add(event.externalId);
        report.created += 1;
      }
    }

    return res.status(200).json({
      success: true,
      source: 'British Marine',
      ...report,
      errors: errors.slice(0, 5),
    });
  } catch (error: any) {
    console.error('[discover-british-marine-events]', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.message || 'Could not check British Marine events.',
    });
  }
}


// ==========================================
// INLINED HELPER UTILITIES (Self-contained for Vercel Serverless Runtime)
// ==========================================

export const decodeHtmlEntities = (str: string): string => {
  if (!str) return '';
  let temp = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&pound;/g, '£')
    .replace(/&euro;/g, '€')
    .replace(/&#36;/g, '$')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  try {
    temp = temp.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch (e) {
    // ignore
  }
  return temp;
};

export const cleanTitle = (title: string): string => {
  if (!title) return '';
  let temp = decodeHtmlEntities(title)
    .replace(/\s*-\s*à venda\s*-\s*.*$/gi, '')
    .replace(/\s*-\s*OLX\s*Portugal.*$/gi, '')
    .replace(/\s*-\s*OLX.*$/gi, '')
    .replace(/\s*[|]\s*Gumtree.*$/gi, '')
    .replace(/\s*-\s*Gumtree.*$/gi, '')
    .replace(/\s*in\s+[^|]+[|]\s*Gumtree.*$/gi, '')
    .replace(/\s*-\s*Boats\s*and\s*Outboards.*$/gi, '')
    .replace(/\s*-\s*Apollo\s*Duck.*$/gi, '')
    .replace(/\s*-\s*YachtWorld.*$/gi, '')
    .replace(/\s*-\s*Rightboat.*$/gi, '')
    .replace(/\s*-\s*TheYachtMarket.*$/gi, '')
    .replace(/\s*-\s*Boatshop24.*$/gi, '')
    .replace(/\s*-\s*Boat24.*$/gi, '')
    .replace(/\s*-\s*Boats\.com.*$/gi, '')
    .replace(/\|.*$/gi, '')
    .trim();

  // Remove emojis
  temp = temp.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  
  // Replace duplicated spaces
  temp = temp.replace(/\s+/g, ' ');

  return temp.trim();
};

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
  'ref',
  'source',
  '_ga',
  '_gl',
  'mc_cid',
  'mc_eid'
]);

export function normalizeListingUrl(rawUrl: string, baseUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  
  let decoded = decodeHtmlEntities(rawUrl.trim());
  if (decoded.startsWith('javascript:') || decoded.startsWith('mailto:') || decoded.startsWith('tel:')) {
    return '';
  }

  let parsed: URL;
  try {
    if (baseUrl && !decoded.startsWith('http://') && !decoded.startsWith('https://')) {
      parsed = new URL(decoded, baseUrl);
    } else {
      parsed = new URL(decoded);
    }
  } catch {
    return '';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '';
  }

  // Force HTTPS
  parsed.protocol = 'https:';

  // Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.hostname.endsWith('.')) {
    parsed.hostname = parsed.hostname.slice(0, -1);
  }

  // Remove tracking parameters
  const searchParams = new URLSearchParams(parsed.search);
  const keysToDelete: string[] = [];
  searchParams.forEach((_, key) => {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(k => searchParams.delete(k));
  parsed.search = searchParams.toString();

  // Remove fragment
  parsed.hash = '';

  let finalUrl = parsed.toString();
  // Strip trailing slash for consistency (unless it's just origin e.g. https://domain.com/)
  if (parsed.pathname !== '/' && finalUrl.endsWith('/')) {
    finalUrl = finalUrl.slice(0, -1);
  }

  return finalUrl;
}

export function extractExternalId(url: string, marketplaceId: string): string | undefined {
  if (!url) return undefined;
  
  const norm = normalizeListingUrl(url);
  if (!norm) return undefined;

  try {
    const parsed = new URL(norm);
    const path = parsed.pathname;

    if (marketplaceId === 'apolloduck') {
      const match = path.match(/\/boat\/[^\/]+\/(\d+)\/?$/i) || path.match(/\/(\d+)\/?$/);
      if (match) return match[1];
    }

    if (marketplaceId === 'boatsandoutboards') {
      const match = path.match(/-(\d{5,})\/?$/i) || path.match(/\/(\d{5,})\/?$/i);
      if (match) return match[1];
    }
  } catch {
    // ignore
  }

  return undefined;
}

export type SearchPageValidationResult = {
  isValid: boolean;
  errorCode?: 
    | 'INVALID_URL'
    | 'UNSUPPORTED_MARKETPLACE'
    | 'INDIVIDUAL_LISTING_URL'
    | 'NOT_A_RESULTS_PAGE'
    | 'UNAUTHORIZED';
  errorMessage?: string;
  marketplaceId?: 'apolloduck' | 'boatsandoutboards';
  marketplaceName?: string;
  normalizedUrl?: string;
};

export function validateSearchPageUrl(urlInput: string): SearchPageValidationResult {
  if (!urlInput || typeof urlInput !== 'string' || !urlInput.trim()) {
    return {
      isValid: false,
      errorCode: 'INVALID_URL',
      errorMessage: 'Please enter a valid URL.'
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlInput.trim());
  } catch {
    return {
      isValid: false,
      errorCode: 'INVALID_URL',
      errorMessage: 'The provided URL is invalid. Please check the syntax.'
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      errorCode: 'INVALID_URL',
      errorMessage: 'Only HTTP or HTTPS protocol URLs are supported.'
    };
  }

  let hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith('www.')) hostname = hostname.slice(4);

  let marketplaceId: 'apolloduck' | 'boatsandoutboards' | null = null;
  let marketplaceName = '';

  if (hostname === 'apolloduck.com' || hostname.endsWith('.apolloduck.com') ||
      hostname === 'apolloduck.co.uk' || hostname.endsWith('.apolloduck.co.uk') ||
      hostname === 'apolloduck.ie' || hostname.endsWith('.apolloduck.ie')) {
    marketplaceId = 'apolloduck';
    marketplaceName = 'Apollo Duck';
  } else if (hostname === 'boatsandoutboards.co.uk' || hostname.endsWith('.boatsandoutboards.co.uk')) {
    marketplaceId = 'boatsandoutboards';
    marketplaceName = 'Boats and Outboards';
  }

  if (!marketplaceId) {
    return {
      isValid: false,
      errorCode: 'UNSUPPORTED_MARKETPLACE',
      errorMessage: 'Marketplace not supported for Search Results Import. Only Apollo Duck and Boats and Outboards are allowed in this version.'
    };
  }

  const normalizedUrl = normalizeListingUrl(urlInput);
  const path = parsed.pathname.toLowerCase();

  if (marketplaceId === 'apolloduck') {
    if (/\/boat\/[^\/]+\/\d+/i.test(path)) {
      return {
        isValid: false,
        errorCode: 'INDIVIDUAL_LISTING_URL',
        errorMessage: 'The provided URL is an individual listing, not a search results page. Please use individual URL import.'
      };
    }
  }

  if (marketplaceId === 'boatsandoutboards') {
    if (/\/boat\/[^\/]*\d{5,}/i.test(path) || /\/boats-for-sale\/[^\/]*\d{5,}\/?$/i.test(path)) {
      return {
        isValid: false,
        errorCode: 'INDIVIDUAL_LISTING_URL',
        errorMessage: 'The provided URL is an individual listing, not a search results page. Please use individual URL import.'
      };
    }
  }

  return {
    isValid: true,
    marketplaceId,
    marketplaceName,
    normalizedUrl
  };
}

export type DiscoveredListing = {
  sourceUrl: string;
  normalizedSourceUrl: string;
  externalId?: string;
  title?: string;
  image?: string;
  priceText?: string;
  locationText?: string;
  alreadyImported: boolean;
  status: 'new' | 'already_imported' | 'invalid_url' | 'ready_for_import';
};

/**
 * Apollo Duck Search Results Page Discovery Adapter
 */
export function discoverApolloDuckListings(html: string, pageUrl: string): DiscoveredListing[] {
  const decodedHtml = decodeHtmlEntities(html);
  const results: DiscoveredListing[] = [];
  const seenUrls = new Set<string>();

  // Pattern 1: Apollo Duck listing URLs usually have /boat/[slug]/[id]
  const linkRegex = /href=["'](\/boat\/[^\/"']+\/(\d+)\/?|https?:\/\/(?:www\.)?apolloduck\.(?:com|co\.uk|ie)\/boat\/[^\/"']+\/(\d+)\/?)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(decodedHtml)) !== null) {
    const rawUrl = match[1];
    const externalId = match[2] || match[3];

    const normalized = normalizeListingUrl(rawUrl, pageUrl);
    if (!normalized || seenUrls.has(normalized)) continue;

    seenUrls.add(normalized);

    // Extract surrounding card HTML context (approx +/- 600 chars)
    const matchIdx = match.index;
    const startIdx = Math.max(0, matchIdx - 300);
    const endIdx = Math.min(decodedHtml.length, matchIdx + 800);
    const snippet = decodedHtml.slice(startIdx, endIdx);

    // Extract image
    let image: string | undefined = undefined;
    const imgMatch = snippet.match(/src=["'](https?:\/\/ics\.apolloduck\.com\/[^"']+)["']/i) ||
                     snippet.match(/srcset=["'](https?:\/\/ics\.apolloduck\.com\/[^"']+)["']/i) ||
                     snippet.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
      const candidateImg = imgMatch[1].split(' ')[0];
      if (candidateImg && !candidateImg.includes('logo') && !candidateImg.includes('icon')) {
        image = candidateImg;
      }
    }

    // Extract Title & Price from caption / snippet
    let title: string | undefined = undefined;
    let priceText: string | undefined = undefined;
    let locationText: string | undefined = undefined;

    // Check _sbcaption or class="BasicTitle"
    const captionMatch = snippet.match(/class=["']_sbcaption["'][^>]*>([\s\S]*?)<\/div>/i);
    const titleClassMatch = snippet.match(/class=["']BasicTitle["'][^>]*>([\s\S]*?)<\/a>/i);

    if (titleClassMatch && titleClassMatch[1]) {
      const rawTitleText = titleClassMatch[1].replace(/<[^>]+>/g, '').trim();
      // Titles often include price e.g. "60ft Liverpool Boats - £97,500"
      const priceInTitle = rawTitleText.match(/(?:£|€|\$|GBP|EUR|USD)\s*[\d,.]+/i);
      if (priceInTitle) {
        priceText = priceInTitle[0];
        title = cleanTitle(rawTitleText.replace(priceInTitle[0], '').replace(/[-|]\s*$/, '').trim());
      } else {
        title = cleanTitle(rawTitleText);
      }
    } else if (captionMatch && captionMatch[1]) {
      const captionText = captionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const priceInCaption = captionText.match(/(?:&pound;|&euro;|£|€|\$|GBP|EUR|USD)\s*[\d,.]+/i) || captionText.match(/\bPOA\b/i);
      if (priceInCaption) {
        priceText = decodeHtmlEntities(priceInCaption[0]);
        const beforePrice = captionText.replace(priceInCaption[0], '').trim();
        title = cleanTitle(beforePrice);
      } else {
        title = cleanTitle(captionText);
      }
    }

    // Fallback title from slug if title is empty
    if (!title) {
      const slugMatch = normalized.match(/\/boat\/([^\/]+)\/\d+/i);
      if (slugMatch) {
        title = cleanTitle(slugMatch[1].replace(/-for-sale$/i, '').replace(/-/g, ' '));
      }
    }

    results.push({
      sourceUrl: normalized,
      normalizedSourceUrl: normalized,
      externalId,
      title: title || 'Apollo Duck Listing',
      image,
      priceText,
      locationText,
      alreadyImported: false,
      status: 'new'
    });
  }

  return results;
}

/**
 * Boats and Outboards Search Results Page Discovery Adapter
 * Supports both direct HTML and Jina Reader Markdown output
 */
export function discoverBoatsAndOutboardsListings(textOrHtml: string, pageUrl: string): DiscoveredListing[] {
  const results: DiscoveredListing[] = [];
  const seenUrls = new Set<string>();

  // Detect target links from direct HTML and reader Markdown. The reader often
  // rewrites Boats & Outboards links as relative paths, so accept both forms.
  const targetUrlRegex = /(?:\]\(|href=["'])((?:https?:\/\/(?:www\.)?boatsandoutboards\.co\.uk)?\/(?:boat|boats-for-sale)\/[^\)\s"']+\d{5,}\/?)/gi;
  let m: RegExpExecArray | null;

  while ((m = targetUrlRegex.exec(textOrHtml)) !== null) {
    const rawUrl = m[1];
    const normalized = normalizeListingUrl(rawUrl, pageUrl);
    if (!normalized || seenUrls.has(normalized)) continue;

    seenUrls.add(normalized);
    const externalId = extractExternalId(normalized, 'boatsandoutboards');

    // Extract context around the match
    const matchIdx = m.index;
    let startIdx = Math.max(0, matchIdx - 600);

    // If there's an outer opening '[' before matchIdx, start from there
    let depth = 0;
    for (let i = matchIdx; i >= startIdx; i--) {
      if (textOrHtml[i] === ']') depth++;
      else if (textOrHtml[i] === '[') {
        depth--;
        if (depth === 0) {
          startIdx = i;
          break;
        }
      }
    }

    const snippet = textOrHtml.slice(startIdx, matchIdx);

    // Extract image URL from snippet
    let image: string | undefined = undefined;
    const imgMatch = snippet.match(/!\[[^\]]*\]\((https?:\/\/[^\)\s"']+)\)/i) ||
                     snippet.match(/(https?:\/\/images\.boatsgroup\.com\/resize\/[^\)\s"']+)/i) ||
                     snippet.match(/src=["'](https?:\/\/[^"']+)["']/i);
    if (imgMatch) {
      image = imgMatch[1];
    }

    // Extract price, location, title from snippet
    let title: string | undefined = undefined;
    let priceText: string | undefined = undefined;
    let locationText: string | undefined = undefined;

    const cleanSnippet = snippet
      .replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
      .replace(/#+/g, '')
      .replace(/[*_]/g, '')
      .replace(/\[/g, '')
      .replace(/\]/g, '')
      .trim();

    const priceMatch = cleanSnippet.match(/(?:£|€|\$|GBP|EUR|USD)\s*[\d,.]+/i) || cleanSnippet.match(/\bPOA\b/i) || cleanSnippet.match(/Request price/i);
    if (priceMatch) {
      priceText = priceMatch[0];
    }

    const locationMatch = cleanSnippet.match(/\|\s*([^|\n]+)$/) || cleanSnippet.match(/\|\s*([^|\n]+)/);
    if (locationMatch) {
      const candidateLoc = locationMatch[1].trim();
      if (!candidateLoc.toLowerCase().includes('in-stock') && !candidateLoc.toLowerCase().includes('featured') && candidateLoc.length < 50) {
        locationText = candidateLoc;
      }
    }

    // Title extraction
    let rawTitle = cleanSnippet;
    if (priceMatch) {
      rawTitle = rawTitle.split(priceMatch[0])[0];
    } else if (locationMatch) {
      rawTitle = rawTitle.split('|')[0];
    }

    rawTitle = rawTitle.replace(/^(?:Featured|New Arrival|In-Stock|Price Drop|↓ Price Drop|\s)+/i, '').trim();

    title = cleanTitle(rawTitle);
    if (!title || title.length < 3) {
      const slugMatch = normalized.match(/\/boat\/(?:[^\/]+-)?([^\/]+)-\d+/i);
      if (slugMatch) {
        title = cleanTitle(slugMatch[1].replace(/-/g, ' '));
      }
    }

    results.push({
      sourceUrl: normalized,
      normalizedSourceUrl: normalized,
      externalId,
      title: title || 'Boats and Outboards Listing',
      image,
      priceText,
      locationText,
      alreadyImported: false,
      status: 'new'
    });
  }

  return results;
}


/**
 * When discovery had to fall back to Gemini URL Context, the listing URLs can
 * be recovered reliably but image CDN URLs may not be exposed by URL Context.
 * For those missing images, fetch only the public OpenGraph image metadata
 * from each individual listing through Microlink. Failure is non-fatal.
 */
async function enrichMissingListingImages(listings: DiscoveredListing[]): Promise<DiscoveredListing[]> {
  const missing = listings.filter(item => !item.image && item.sourceUrl).slice(0, 20);
  if (missing.length === 0) return listings;

  const imageByUrl = new Map<string, string>();
  const concurrency = 5;

  for (let offset = 0; offset < missing.length; offset += concurrency) {
    const batch = missing.slice(offset, offset + concurrency);

    const results = await Promise.allSettled(batch.map(async (item) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);

      try {
        const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(item.sourceUrl)}&prerender=true`;
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });

        if (!response.ok) return null;
        const payload = await response.json();
        const imageUrl = payload?.data?.image?.url;

        if (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl)) {
          return { sourceUrl: item.sourceUrl, imageUrl };
        }

        return null;
      } finally {
        clearTimeout(timeout);
      }
    }));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        imageByUrl.set(result.value.sourceUrl, result.value.imageUrl);
      }
    }
  }

  return listings.map(item => ({
    ...item,
    image: item.image || imageByUrl.get(item.sourceUrl)
  }));
}

export type FetchResult = {
  htmlOrText: string;
  fetchSource: 'direct' | 'jina' | 'gemini-url-context' | 'gemini-google-search';
  status: number;
  errorCode?: 'FETCH_TIMEOUT' | 'DNS_ERROR' | 'TLS_ERROR' | 'PAGE_ACCESS_DENIED' | 'FALLBACK_FAILED' | 'EMPTY_RESPONSE';
  errorDetails?: string;
  fallbackAttempted: boolean;
};

/**
 * Resilient Page Fetcher with Jina Reader Fallback
 * Timeouts are strictly bounded (3.5s direct + 4.0s fallback = max 7.5s total)
 * to guarantee responses complete within Vercel serverless execution window.
 */
async function fetchPageResiliently(pageUrl: string): Promise<FetchResult> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  ];

  let directStatus = 0;
  let directHtml = '';
  let fallbackAttempted = false;

  // 1. Direct fetch with strict 3.5s timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const resp = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgents[0],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);
    directStatus = resp.status;

    if (resp.ok) {
      directHtml = await resp.text();
      // Check if blocked by Cloudflare / anti-bot shell
      const isBlocked = directHtml.includes('Access Denied') ||
                        directHtml.includes('Cloudflare') ||
                        directHtml.includes('Just a moment...') ||
                        directHtml.includes('Attention Required');

      if (!isBlocked && directHtml.length > 500) {
        return { htmlOrText: directHtml, fetchSource: 'direct', status: directStatus, fallbackAttempted: false };
      }
    }
  } catch (err: any) {
    console.warn('[discover-listings] Direct fetch failed or timed out:', err?.message || err);
  }

  // 2. Fallback to Jina Reader with strict 4.0s timeout
  fallbackAttempted = true;
  const jinaTargetUrl = (pageUrl.includes('boatsandoutboards') && !pageUrl.endsWith('/')) ? `${pageUrl}/` : pageUrl;
  const parsedJinaTarget = new URL(jinaTargetUrl);
  const jinaUrl = `https://r.jina.ai/http://${parsedJinaTarget.host}${parsedJinaTarget.pathname}${parsedJinaTarget.search}`;
  console.log('[discover-listings] Attempting Jina Reader fallback for:', jinaTargetUrl);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const jinaResp = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain, text/html'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (jinaResp.ok) {
      const jinaText = await jinaResp.text();
      if (jinaText && jinaText.length > 300) {
        return { htmlOrText: jinaText, fetchSource: 'jina', status: jinaResp.status, fallbackAttempted: true };
      }
    }
  } catch (jinaErr: any) {
    // IMPORTANT: do not return here. A Jina timeout/failure must continue to
    // Gemini URL Context instead of terminating discovery with HTTP 500.
    console.warn('[discover-listings] Jina fallback failed; continuing to Gemini:', jinaErr?.message || jinaErr);
  }

  // 3. Gemini URL Context fallback.
  // Useful when the origin blocks Vercel/Jina but the public search page remains web-accessible.
  try {
    console.log('[discover-listings] Attempting Gemini URL Context fallback for:', pageUrl);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'connectboat-discovery' } }
    });

    const prompt = `Access ONLY this public marine marketplace search-results page:
${pageUrl}

Return the individual boat/listing results visible on that page as Markdown, one result per line, using EXACTLY this shape whenever the information exists:
[Exact listing title](Exact public listing URL) — Price | Location

Requirements:
- Preserve the exact individual listing URL from the source page.
- Include only individual listings actually present on the supplied page.
- Do not invent listings, URLs, prices or locations.
- Do not return category/navigation/filter links.
- Prefer boatsandoutboards.co.uk/boat/... URLs for Boats and Outboards.
- Return as many visible listing results as the page provides, up to 40.
- No commentary before or after the list.`;

    const gRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt],
      config: {
        tools: [{ urlContext: {} }]
      }
    });

    const gText = typeof gRes.text === 'string' ? gRes.text.trim() : '';
    const urlMeta = gRes.candidates?.[0]?.urlContextMetadata;
    console.log('[discover-listings] Gemini URL Context metadata:', JSON.stringify(urlMeta || {}));

    if (gText && gText.length > 150) {
      console.log('[discover-listings] Gemini URL Context fallback succeeded. Length:', gText.length);
      return {
        htmlOrText: gText,
        fetchSource: 'gemini-url-context',
        status: 200,
        fallbackAttempted: true
      };
    }
  } catch (geminiErr: any) {
    console.warn('[discover-listings] Gemini URL Context fallback failed:', geminiErr?.message || geminiErr);
  }

  // 4. Search grounding is a separate fallback because some protected
  // marketplace pages cannot be fetched directly by URL Context.
  try {
    console.log('[discover-listings] Attempting Gemini Google Search fallback for:', pageUrl);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const searchPrompt = `Use Google Search to find the individual public boat listings on this exact Boats & Outboards results page:
${pageUrl}

Return only listing lines in this exact format:
[Exact listing title](Exact public listing URL) — Price | Location

Include only listings from that page. Preserve exact URLs. Do not invent listings, prices or locations. Return up to 30 results.`;
    const searchRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [searchPrompt],
      config: { tools: [{ googleSearch: {} }] }
    });
    const searchText = typeof searchRes.text === 'string' ? searchRes.text.trim() : '';
    if (searchText.length > 100) {
      return { htmlOrText: searchText, fetchSource: 'gemini-google-search', status: 200, fallbackAttempted: true };
    }
  } catch (searchErr: any) {
    console.warn('[discover-listings] Gemini Google Search fallback failed:', searchErr?.message || searchErr);
  }

  const finalErrorCode = directStatus === 403 ? 'PAGE_ACCESS_DENIED' : (!directHtml ? 'EMPTY_RESPONSE' : 'FALLBACK_FAILED');

  return {
    htmlOrText: directHtml,
    fetchSource: 'direct',
    status: directStatus || 500,
    errorCode: finalErrorCode,
    errorDetails: 'Não foi possível aceder à página diretamente, via serviço de leitura ou via Gemini URL Context/Search.',
    fallbackAttempted: true
  };
}

/**
 * Helper to ensure JSON error responses are always cleanly returned with both
 * English and Portuguese fields so no Vercel HTML error reaches the client.
 */
function sendJsonError(
  res: any,
  statusCode: number,
  errorCode: string,
  errorMessage: string,
  stage: string,
  details?: string,
  requestId?: string,
  extraDiagnostics?: any
) {
  if (!res || res.headersSent) return;

  try {
    if (typeof res.setHeader === 'function') {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
  } catch (e) {
    // Ignore header setting errors
  }

  const payload = {
    success: false,
    sucesso: false,
    error: errorCode,
    erro: errorMessage,
    errorMessage: errorMessage,
    stage,
    estagio: stage,
    details: details || errorMessage,
    detalhes: details || errorMessage,
    requestId: requestId || `req_${Date.now()}`,
    _diagnostics: extraDiagnostics || undefined
  };

  try {
    if (typeof res.status === 'function') {
      return res.status(statusCode).json(payload);
    } else if (typeof res.send === 'function') {
      return res.send(JSON.stringify(payload));
    } else if (typeof res.end === 'function') {
      res.statusCode = statusCode;
      return res.end(JSON.stringify(payload));
    }
  } catch (e) {
    console.error('[discover-listings] Critical error attempting to send JSON error response:', e);
  }
}

/**
 * Main Endpoint Handler for POST /api/discover-listings
 * Fully wrapped in a top-level try/catch to guarantee zero unhandled runtime exceptions escape to Vercel.
 */
export default async function discoverListingsHandler(req: any, res: any) {
  // Phase 2A: reuse this existing Serverless Function for British Marine event discovery.
  // This keeps the Vercel Hobby deployment within the 12-function limit.
  let phase2aBody: any = req?.body || {};
  if (typeof phase2aBody === 'string') {
    try { phase2aBody = JSON.parse(phase2aBody); } catch { phase2aBody = {}; }
  }
  if (phase2aBody?.action === 'discoverBritishMarineEvents') {
    return discoverBritishMarineEvents(req, res);
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let lastCompletedStage = 'REQUEST_RECEIVED';
  let targetPageUrl = '';
  let detectedMarketplace = 'Unknown';
  let authUid = 'anonymous';
  let httpStatus = 0;
  let fallbackAttempted = false;
  let htmlLength = 0;

  try {
    console.log('[discover-listings] HANDLER_START', { requestId, method: req?.method });

    // Set CORS and content type headers safely
    if (res && typeof res.setHeader === 'function' && !res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req?.method === "OPTIONS") {
      if (typeof res.status === 'function') return res.status(200).end();
      if (typeof res.end === 'function') return res.end();
    }

    if (req?.method !== "POST") {
      return sendJsonError(
        res,
        405,
        'METHOD_NOT_ALLOWED',
        'Método não permitido. Utilize o método POST.',
        'METHOD_CHECK',
        'Apenas pedidos POST são suportados.',
        requestId
      );
    }

    // Stage 2: BODY_PARSED
    let body: any = {};
    if (typeof req?.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch (err) {
        return sendJsonError(
          res,
          400,
          'INVALID_JSON_PAYLOAD',
          'Corpo do pedido em formato JSON inválido.',
          'BODY_PARSED',
          'Não foi possível interpretar o corpo da requisição como JSON.',
          requestId
        );
      }
    } else if (req?.body && typeof req.body === 'object') {
      body = req.body;
    }

    lastCompletedStage = 'BODY_PARSED';

    const rawPageUrl = body.pageUrl || body.url || body.searchUrl;
    const diagnosticsOnly = body.diagnosticsOnly === true;

    console.log('[discover-listings] BODY_RECEIVED', { requestId, pageUrl: rawPageUrl, diagnosticsOnly });

    if (!rawPageUrl || typeof rawPageUrl !== 'string' || !rawPageUrl.trim()) {
      return sendJsonError(
        res,
        400,
        'INVALID_REQUEST_BODY',
        'O URL da página de pesquisa (pageUrl) é obrigatório.',
        'VALIDATE_INPUT',
        'Por favor, forneça o parâmetro pageUrl.',
        requestId
      );
    }

    targetPageUrl = rawPageUrl.trim();

    // Stage 3: AUTH_STARTED
    lastCompletedStage = 'AUTH_STARTED';
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    console.log('[discover-listings] AUTH_START', { requestId, hasAuthHeader: Boolean(authHeader) });

    let staffUser: any;
    try {
      staffUser = await verifyDiscoveryStaff(req);
      authUid = staffUser.uid;
    } catch (authError: any) {
      const statusCode = authError?.statusCode === 403 ? 403 : 401;
      const errorCode = authError?.code || (statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED');

      return sendJsonError(
        res,
        statusCode,
        errorCode,
        authError?.message || 'Falha na validação de acesso.',
        statusCode === 403 ? 'PERMISSIONS_CHECK' : 'AUTH_CHECK',
        authError?.message,
        requestId
      );
    }

    // Stage 4: AUTH_SUCCESS
    lastCompletedStage = 'AUTH_SUCCESS';
    console.log('[discover-listings] AUTH_SUCCESS', {
      requestId,
      authUid,
      verifiedRole: staffUser.role
    });

    // Stage 5: URL_VALIDATED
    const validation: SearchPageValidationResult = validateSearchPageUrl(targetPageUrl);
    if (!validation.isValid) {
      return sendJsonError(
        res,
        400,
        validation.errorCode || 'INVALID_URL',
        validation.errorMessage || 'O URL fornecido não é válido.',
        'URL_VALIDATED',
        validation.errorMessage,
        requestId
      );
    }

    lastCompletedStage = 'URL_VALIDATED';

    // Stage 6: MARKETPLACE_DETECTED
    const { marketplaceId, marketplaceName, normalizedUrl } = validation;
    detectedMarketplace = marketplaceName || 'Unknown';
    targetPageUrl = normalizedUrl || targetPageUrl;
    lastCompletedStage = 'MARKETPLACE_DETECTED';
    console.log('[discover-listings] MARKETPLACE_DETECTED', { requestId, detectedMarketplace, targetPageUrl });

    // Stage 7: FETCH_STARTED
    lastCompletedStage = 'FETCH_STARTED';
    console.log('[discover-listings] BEFORE_FETCH', { requestId, targetPageUrl });

    const fetchRes = await fetchPageResiliently(targetPageUrl);
    httpStatus = fetchRes.status;
    fallbackAttempted = fetchRes.fallbackAttempted;
    htmlLength = fetchRes.htmlOrText ? fetchRes.htmlOrText.length : 0;

    if (fetchRes.fetchSource === 'jina' || fetchRes.fetchSource === 'gemini-url-context' || fetchRes.fetchSource === 'gemini-google-search') {
      lastCompletedStage = 'FALLBACK_FETCH_STARTED';
    } else {
      lastCompletedStage = 'DIRECT_FETCH_COMPLETED';
    }

    console.log('[discover-listings] AFTER_FETCH', { requestId, httpStatus, htmlLength, fetchSource: fetchRes.fetchSource });

    if (!fetchRes.htmlOrText || fetchRes.htmlOrText.length < 200) {
      const errCode = fetchRes.errorCode || (fetchRes.status === 403 ? 'PAGE_ACCESS_DENIED' : 'SEARCH_PAGE_FETCH_FAILED');
      const errMsg = 'Ocorreu um erro temporário no servidor ao ler a página de pesquisa.';
      const details = fetchRes.errorDetails || 'Não foi possível obter o conteúdo da página após tentativas direta e via leitor.';

      return sendJsonError(
        res,
        500,
        errCode,
        errMsg,
        lastCompletedStage,
        details,
        requestId,
        {
          directStatus: fetchRes.status,
          fallbackUsed: fetchRes.fetchSource !== 'direct',
          fetchSource: fetchRes.fetchSource,
          htmlLength
        }
      );
    }

    // Stage 10: HTML_RECEIVED
    lastCompletedStage = 'HTML_RECEIVED';

    // Stage 11: ADAPTER_STARTED
    lastCompletedStage = 'ADAPTER_STARTED';
    let candidateListings: DiscoveredListing[] = [];
    if (marketplaceId === 'apolloduck') {
      candidateListings = discoverApolloDuckListings(fetchRes.htmlOrText, targetPageUrl);
    } else if (marketplaceId === 'boatsandoutboards') {
      candidateListings = discoverBoatsAndOutboardsListings(fetchRes.htmlOrText, targetPageUrl);
    }

    // Stage 12: LINKS_DISCOVERED
    lastCompletedStage = 'LINKS_DISCOVERED';
    const totalCandidates = candidateListings.length;
    console.log('[discover-listings] LINKS_DISCOVERED', { requestId, totalCandidates });

    // Stage 13: DUPLICATE_CHECK_STARTED
    lastCompletedStage = 'DUPLICATE_CHECK_STARTED';
    const uniqueMap = new Map<string, DiscoveredListing>();
    let duplicatesInPage = 0;

    for (const item of candidateListings) {
      const key = item.normalizedSourceUrl.toLowerCase();
      if (uniqueMap.has(key)) {
        duplicatesInPage++;
      } else {
        uniqueMap.set(key, item);
      }
    }

    let validListings = Array.from(uniqueMap.values());
    const totalFound = validListings.length;
    const warnings: string[] = [];

    // Result Limit: Maximum 30 discovered listings
    if (validListings.length > 30) {
      validListings = validListings.slice(0, 30);
      warnings.push('A página contém mais de 30 anúncios. Apenas os primeiros 30 anúncios foram listados.');
    }

    // Preserve the old Jina/direct image extraction. Only when Gemini had to
    // discover the URLs do we enrich missing thumbnails from each listing's
    // public OpenGraph metadata. This is best-effort and never blocks results.
    if (fetchRes.fetchSource === 'gemini-url-context' && validListings.some(item => !item.image)) {
      try {
        validListings = await enrichMissingListingImages(validListings);
      } catch (imageEnrichmentError: any) {
        console.warn('[discover-listings] Image enrichment failed non-fatally:', imageEnrichmentError?.message || imageEnrichmentError);
      }
    }

    // If Health-Check Mode (diagnosticsOnly) is requested:
    if (diagnosticsOnly) {
      return res.status(200).json({
        success: true,
        sucesso: true,
        requestId,
        stages: {
          authentication: "ok",
          validation: "ok",
          marketplace: marketplaceName,
          directFetchStatus: fetchRes.status,
          fallbackUsed: fetchRes.fetchSource !== 'direct',
          htmlLength,
          candidateLinks: totalCandidates,
          validLinks: validListings.length,
          duplicateCheck: "ok"
        }
      });
    }

    if (totalCandidates === 0) {
      warnings.push('Nenhum anúncio individual de barco foi encontrado nesta página de resultados.');
    }

    // Stage 14: RESPONSE_SENT
    lastCompletedStage = 'RESPONSE_SENT';
    console.log('[discover-listings] BEFORE_RESPONSE', { requestId, totalFound, warningsCount: warnings.length });

    return res.status(200).json({
      success: true,
      sucesso: true,
      requestId,
      marketplace: marketplaceName,
      pageUrl: targetPageUrl,
      totalCandidates,
      totalFound,
      duplicatesRemoved: duplicatesInPage,
      alreadyImportedCount: 0,
      listings: validListings,
      warnings,
      _diagnostics: {
        directStatus: fetchRes.status,
        fallbackUsed: fetchRes.fetchSource !== 'direct',
        fetchSource: fetchRes.fetchSource,
        htmlLength,
        candidateLinkCount: totalCandidates,
        validListingCount: validListings.length
      }
    });

  } catch (err: any) {
    console.error('[discover-listings EXCEPTION_CAUGHT]', {
      requestId,
      lastCompletedStage,
      pageUrl: targetPageUrl,
      marketplace: detectedMarketplace,
      authenticatedUserUid: authUid,
      httpStatus,
      fallbackAttempted,
      htmlLength,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack
    });

    return sendJsonError(
      res,
      500,
      'DISCOVERY_FAILED',
      'Ocorreu um erro temporário no servidor ao ler a página de pesquisa.',
      lastCompletedStage,
      err?.message || 'Erro de execução na função do servidor',
      requestId,
      {
        errorName: err?.name || 'Error',
        errorMessage: err?.message || 'Erro desconhecido',
        stage: lastCompletedStage,
        stack: err?.stack
      }
    );
  }
}


