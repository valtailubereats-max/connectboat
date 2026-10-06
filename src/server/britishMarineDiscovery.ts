import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { createHash } from 'node:crypto';

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
const COLLECTION = 'externalEventCandidates';
const ROOT = 'https://www.britishmarine.co.uk';
const INDEXES = [`${ROOT}/membership/events-and-courses`, `${ROOT}/membership/events`];
const MAX_EVENTS = 12;
const TIMEOUT_MS = 9000;
let dbInstance: any = null;

function getDb() {
  const firebaseAdmin = (admin as any).default || admin;
  if (!dbInstance) {
    if (!(firebaseAdmin.apps || []).length) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (raw) {
        try {
          let serviceAccount: any;
          try { serviceAccount = JSON.parse(raw); }
          catch { serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); }
          if (typeof serviceAccount.private_key === 'string') {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          }
          firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(serviceAccount), projectId: PROJECT_ID });
        } catch {
          firebaseAdmin.initializeApp({ projectId: PROJECT_ID });
        }
      } else {
        firebaseAdmin.initializeApp({ projectId: PROJECT_ID });
      }
    }
    dbInstance = firebaseAdmin.firestore();
    try { dbInstance.settings({ databaseId: DATABASE_ID }); } catch { /* already set */ }
  }
  return dbInstance;
}

async function requireAdmin(req: Request, db: any) {
  const firebaseAdmin = (admin as any).default || admin;
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });

  let token: any;
  try { token = await firebaseAdmin.auth().verifyIdToken(match[1]); }
  catch { throw Object.assign(new Error('Invalid or expired Firebase authentication token.'), { statusCode: 401 }); }

  const email = String(token.email || '').trim().toLowerCase();
  const explicitAdmins = new Set(['valtailubereats@gmail.com', 'valtail@gmail.com', 'generalsales2021@gmail.com']);
  if (explicitAdmins.has(email)) return token.uid;

  const userDoc = await db.collection('users').doc(token.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw Object.assign(new Error('Administrator access required.'), { statusCode: 403 });
  }
  return token.uid;
}

function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&ndash;|&#8211;/gi, '–').replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function textFromHtml(html: string) {
  return decode(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function clean(value: unknown) { return typeof value === 'string' ? decode(value).replace(/\s+/g, ' ').trim() : ''; }
function normalise(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function canonicalUrl(value: string) {
  try {
    const url = new URL(value, ROOT);
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';
    [...url.searchParams.keys()].forEach((key) => {
      const k = key.toLowerCase();
      if (k.startsWith('utm_') || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(k)) url.searchParams.delete(key);
    });
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return url.toString().replace(/\/$/, '');
  } catch { return ''; }
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ConnectBoat Events Discovery/1.0 (+https://connectboat.co.uk)', Accept: 'text/html' },
      redirect: 'follow', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

function eventLinks(html: string) {
  const links = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const url = canonicalUrl(match[1]);
    if (!url) continue;
    const parsed = new URL(url);
    if (parsed.hostname !== 'britishmarine.co.uk') continue;
    const path = parsed.pathname.replace(/\/$/, '');
    const prefix = ['/membership/events-and-courses/', '/membership/events/'].find((p) => path.startsWith(p));
    if (!prefix) continue;
    const slug = path.slice(prefix.length);
    if (!slug || slug.includes('/')) continue;
    parsed.search = '';
    links.add(parsed.toString().replace(/\/$/, ''));
  }
  return [...links];
}

const MONTHS: Record<string, number> = {
  january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
};
function iso(day: number, month: string, year: number) {
  const m = MONTHS[month.toLowerCase()];
  return m ? `${year}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
}
function dates(text: string) {
  const full = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\s*[–—-]\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (full) return { startDate: iso(+full[1], full[2], +full[3]), endDate: iso(+full[4], full[5], +full[6]) };
  const same = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*[–—-]\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (same) return { startDate: iso(+same[1], same[3], +same[4]), endDate: iso(+same[2], same[3], +same[4]) };
  const one = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (one) { const d = iso(+one[1], one[2], +one[3]); return { startDate: d, endDate: d }; }
  return { startDate: '', endDate: '' };
}

const UK_HINTS = ['Southampton','Portsmouth','Plymouth','Poole','Cowes','London','Farnborough','Basingstoke','Lymington','Bedfordshire','Birmingham','Bristol','Liverpool','Manchester','Glasgow','Edinburgh','Cardiff','Belfast','Brighton','Bournemouth','Hampshire','Dorset','Essex','Kent','Suffolk','Norfolk','Cornwall','Devon','Solent','Argyll','Luss','York','Ipswich'];
function location(text: string, title: string) {
  const labelled = text.match(/(?:^|\n)(?:Where|Location|Venue)\s*:?\s*([^\n]{0,220})/i)?.[1] || '';
  const postcodeMatch = text.match(/\b(?:GIR ?0AA|(?:[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}))\b/i);
  const aroundPostcode = postcodeMatch?.index == null ? '' : text.slice(Math.max(0, postcodeMatch.index - 180), postcodeMatch.index + 80);
  const context = `${labelled} ${aroundPostcode} ${title}`;
  const city = UK_HINTS.find((hint) => new RegExp(`\\b${hint}\\b`, 'i').test(context)) || '';
  const isUk = Boolean(city) || /\b(?:United Kingdom|Great Britain|England|Scotland|Wales|Northern Ireland|UK)\b/i.test(context) || Boolean(postcodeMatch);
  return { isUk, city, venue: clean(labelled), country: isUk ? 'United Kingdom' : '' };
}

function relevant(title: string) {
  if (/\b(committee|board meeting|council meeting|agm|webinar|course|training|workshop|christmas lunch|annual dinner|awards dinner|member drop-in|social media)\b/i.test(title)) return false;
  return /\b(boat show|yacht show|trade show|seawork|regatta|marine|boating|marina|superyacht|watersports|sailing|passenger boat|exhibition|expo|festival|conference)\b/i.test(title);
}
function category(title: string) {
  if (/\b(regatta|race|racing|sailing championship)\b/i.test(title)) return 'Regattas';
  if (/\bfestival\b/i.test(title)) return 'Festivals';
  if (/\b(boat show|yacht show|trade show|exhibition|expo|seawork|metstrade)\b/i.test(title)) return 'Boat Shows';
  return 'Marine Events';
}
function titleFromHtml(html: string) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
  if (h1) return clean(textFromHtml(h1));
  return clean(textFromHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')).replace(/\s*::\s*British Marine.*$/i, '');
}

async function parseEvent(url: string) {
  const html = await fetchHtml(url);
  const text = textFromHtml(html);
  const title = titleFromHtml(html);
  const range = dates(text);
  const loc = location(text, title);
  const externalId = new URL(url).pathname.replace(/\/$/, '').split('/').pop() || '';
  return { title, ...range, ...loc, category: category(title), website: url, ticketUrl: '', sourceUrl: url, externalId, isRelevant: relevant(title) };
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed.' });

  try {
    const db = getDb();
    const adminUid = await requireAdmin(req, db);
    const indexResults = await Promise.allSettled(INDEXES.map(fetchHtml));
    const links = new Set<string>();
    const errors: string[] = [];
    indexResults.forEach((result, i) => {
      if (result.status === 'fulfilled') eventLinks(result.value).forEach((url) => links.add(url));
      else errors.push(`${INDEXES[i]}: ${result.reason instanceof Error ? result.reason.message : 'Source error'}`);
    });

    const selected = [...links].slice(0, MAX_EVENTS);
    if (!selected.length) return res.status(502).json({ success: false, error: 'British Marine returned no event links. The source page structure may have changed.' });

    const existing = await db.collection(COLLECTION).get();
    const dedupeKeys = new Set<string>();
    const sourceUrls = new Set<string>();
    const externalIds = new Set<string>();
    existing.docs.forEach((d: any) => {
      const data = d.data() || {};
      if (data.dedupeKey) dedupeKeys.add(data.dedupeKey);
      if (data.sourceUrl) sourceUrls.add(canonicalUrl(data.sourceUrl));
      if (data.externalId) externalIds.add(data.externalId);
    });

    const report = { checked: selected.length, eligible: 0, created: 0, existing: 0, skippedPast: 0, skippedNonUk: 0, skippedIrrelevant: 0, skippedIncomplete: 0 };
    const today = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < selected.length; i += 3) {
      const batch = selected.slice(i, i + 3);
      const results = await Promise.allSettled(batch.map(parseEvent));
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'rejected') { errors.push(`${batch[j]}: ${result.reason instanceof Error ? result.reason.message : 'Detail error'}`); continue; }
        const event = result.value;
        if (!event.title || !event.startDate || !event.city) { report.skippedIncomplete++; continue; }
        if (!event.isUk) { report.skippedNonUk++; continue; }
        if (!event.isRelevant) { report.skippedIrrelevant++; continue; }
        if ((event.endDate || event.startDate) < today) { report.skippedPast++; continue; }

        report.eligible++;
        const dedupeKey = `${normalise(event.title)}|${event.startDate}|${normalise(event.city)}`;
        const sourceUrl = canonicalUrl(event.sourceUrl);
        if (dedupeKeys.has(dedupeKey) || sourceUrls.has(sourceUrl) || externalIds.has(event.externalId)) { report.existing++; continue; }

        const id = `bm_${createHash('sha256').update(event.externalId || sourceUrl || dedupeKey).digest('hex').slice(0, 20)}`;
        const now = (admin as any).firestore.FieldValue.serverTimestamp();
        await db.collection(COLLECTION).doc(id).set({
          title: event.title, startDate: event.startDate, endDate: event.endDate,
          country: event.country, city: event.city, venue: event.venue, category: event.category,
          website: event.website, ticketUrl: event.ticketUrl, source: 'imported', sourceName: 'British Marine',
          sourceUrl: event.sourceUrl, externalId: event.externalId,
          externalSources: [{ sourceName: 'British Marine', sourceUrl: event.sourceUrl, externalId: event.externalId }],
          reviewStatus: 'pending', dedupeKey, normalizedTitle: normalise(event.title), normalizedCity: normalise(event.city),
          normalizedVenue: normalise(event.venue), canonicalWebsite: canonicalUrl(event.website), possibleDuplicateOf: '', duplicateConfidence: 0,
          firstFoundAt: now, lastCheckedAt: now, lastSeenAt: now, adminEditedFields: [], createdBy: adminUid, createdAt: now, updatedAt: now,
        });
        dedupeKeys.add(dedupeKey); sourceUrls.add(sourceUrl); externalIds.add(event.externalId); report.created++;
      }
    }

    return res.status(200).json({ success: true, source: 'British Marine', ...report, errors: errors.slice(0, 5) });
  } catch (error: any) {
    console.error('[discover-british-marine-events]', error);
    return res.status(error?.statusCode || 500).json({ success: false, error: error?.message || 'Could not check British Marine events.' });
  }
}
