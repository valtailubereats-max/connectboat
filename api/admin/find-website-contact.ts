import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
const ADMIN_EMAILS = new Set(['valtailubereats@gmail.com', 'valtail@gmail.com', 'generalsales2021@gmail.com']);
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function adminApp() {
  if (getApps().length) return getApp();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Firebase Admin is not configured.');
  const account = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  if (typeof account.private_key === 'string') account.private_key = account.private_key.replace(/\\n/g, '\n');
  return initializeApp({ credential: cert(account) });
}

function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (isIP(address) === 6) {
    const ip = address.toLowerCase();
    return !(ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') ||
      ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb') ||
      ip.startsWith('::ffff:'));
  }
  return false;
}

async function fetchPublicHtml(url: URL, redirects = 0): Promise<string> {
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') ||
      url.username || url.password || (url.port && !['80', '443'].includes(url.port)) || isIP(url.hostname)) {
    throw new Error('Only public website URLs are supported.');
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error('Website address is not public.');
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'GET',
      timeout: 5000,
      headers: { 'User-Agent': 'ConnectBoatContactScanner/1.0', Accept: 'text/html' },
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
    }, response => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 2) {
        response.resume();
        const next = new URL(response.headers.location, url);
        if (next.hostname.replace(/^www\./, '') !== url.hostname.replace(/^www\./, '')) return resolve('');
        fetchPublicHtml(next, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200 || !String(response.headers['content-type'] || '').toLowerCase().includes('text/html')) {
        response.resume();
        return resolve('');
      }
      let html = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        html += chunk;
        if (html.length > 200_000) response.destroy();
      });
      response.on('end', () => resolve(html));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('Website timed out.')));
    request.on('error', reject);
    request.end();
  });
}

function findEmail(html: string, hostname: string) {
  const readable = html.replace(/&#64;|&#x40;|&commat;/gi, '@').replace(/&#46;|&#x2e;|&period;/gi, '.');
  const candidates = [...readable.matchAll(EMAIL_PATTERN)].map(match => match[0].toLowerCase())
    .filter(email => !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(email));
  const domain = hostname.replace(/^www\./, '').toLowerCase();
  return candidates.find(email => email.endsWith('@' + domain)) || '';
}

function pageDetails(html: string, hostname: string) {
  const details: Record<string, string> = {};
  details.email = findEmail(html, hostname);
  const attributes = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gis)]
    .map(match => [match[1].toLowerCase(), match[3].replace(/&amp;/gi, '&')]));
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = String(attributes(match[0]).href || '');
    if (!details.phone && /^tel:/i.test(href)) details.phone = decodeURIComponent(href.slice(4)).split(/[?;]/)[0].trim();
    if (!details.whatsapp && /^(?:https?:\/\/)?(?:wa\.me\/|(?:api\.)?whatsapp\.com\/)/i.test(href)) {
      try {
        const link = new URL(href.startsWith('http') ? href : `https://${href}`);
        details.whatsapp = (link.hostname === 'wa.me' ? link.pathname.slice(1) : link.searchParams.get('phone') || '').replace(/[^+\d]/g, '');
      } catch { /* Ignore malformed links. */ }
    }
    if (!details.linkedin && /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:company|in)\//i.test(href)) details.linkedin = href.split(/[?#]/)[0];
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const meta = attributes(match[0]);
    if (!details.company && ['og:site_name', 'application-name'].includes(String(meta.property || meta.name || '').toLowerCase())) {
      details.company = String(meta.content || '').trim().slice(0, 120);
    }
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        const objects = Array.isArray(entry?.['@graph']) ? entry['@graph'] : [entry];
        for (const item of objects) {
          if (!item || typeof item !== 'object' || !/Organization|LocalBusiness/i.test(String(item['@type'] || ''))) continue;
          if (!details.company && typeof item.name === 'string') details.company = item.name.slice(0, 120);
          if (!details.phone && typeof item.telephone === 'string') details.phone = item.telephone;
          if (!details.email && typeof item.email === 'string' && item.email.toLowerCase().endsWith('@' + hostname.replace(/^www\./, ''))) details.email = item.email;
          const links = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];
          if (!details.linkedin) details.linkedin = links.find((link: unknown) => typeof link === 'string' && /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/(?:company|in)\//i.test(link)) || '';
        }
      }
    } catch { /* Ignore invalid structured data. */ }
  }
  return details;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const token = /^Bearer (.+)$/i.exec(String(req.headers.authorization || ''))?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in to search a website.' });
    const app = adminApp();
    const user = await getAuth(app).verifyIdToken(token);
    const role = await getFirestore(app, DATABASE_ID).collection('users').doc(user.uid).get();
    if (!ADMIN_EMAILS.has(String(user.email || '').toLowerCase()) && role.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    const raw = req.body?.website;
    if (typeof raw !== 'string' || raw.length > 2048) return res.status(400).json({ error: 'Invalid website.' });
    const url = new URL(raw);
    const details: Record<string, string> = {};
    for (const page of [url, new URL('/', url.origin), new URL('/contact', url.origin), new URL('/contact-us', url.origin)]) {
      try {
        const found = pageDetails(await fetchPublicHtml(page), url.hostname);
        for (const [key, value] of Object.entries(found)) if (value && !details[key]) details[key] = value;
      } catch { /* Try the next public page. */ }
      if (details.email && details.phone && details.company) break;
    }
    return res.status(200).json({ details });
  } catch {
    return res.status(400).json({ error: 'Could not check this website.' });
  }
}
