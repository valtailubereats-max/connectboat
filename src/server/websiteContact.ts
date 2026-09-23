import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

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

type PublicHtmlResult = { html: string; finalUrl: URL };

async function fetchPublicHtml(url: URL, redirects = 0): Promise<PublicHtmlResult> {
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
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        const next = new URL(response.headers.location, url);
        if (redirects >= 5) return resolve({ html: '', finalUrl: url });
        fetchPublicHtml(next, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200 || !String(response.headers['content-type'] || '').toLowerCase().includes('text/html')) {
        response.resume();
        return resolve({ html: '', finalUrl: url });
      }
      let html = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        html += chunk;
        if (html.length > 200_000) response.destroy();
      });
      response.on('end', () => resolve({ html, finalUrl: url }));
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
    .filter(email => !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(email) &&
      !/^(example@|name@|email@|your@|user@)/.test(email));
  const domain = hostname.replace(/^www\./, '').toLowerCase();
  return candidates.find(email => email.endsWith('@' + domain)) || candidates[0] || '';
}

function readableText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
}

function findVisiblePhone(html: string) {
  const text = readableText(html);
  const candidates = text.match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) || [];
  return candidates.map(value => value.trim()).find(value => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
  }) || '';
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
  if (!details.company) {
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    if (title) details.company = readableText(title).split(/\s+[|–—-]\s+/)[0].trim().slice(0, 120);
  }
  if (!details.phone) details.phone = findVisiblePhone(html);
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

export async function findWebsiteContactDetails(raw: string) {
  if (raw.length > 2048) throw new Error('Invalid website.');
  const url = new URL(raw);
  const details: Record<string, string> = {};
  const first = await fetchPublicHtml(url);
  const resolvedUrl = first.finalUrl;
  const discoveredLinks = [...first.html.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1/gi)]
    .map(match => match[2].replace(/&amp;/gi, '&'))
    .filter(href => /contact|about|contato|contacto|kontakt/i.test(href))
    .map(href => {
      try { return new URL(href, resolvedUrl); } catch { return null; }
    })
    .filter((link): link is URL => Boolean(link && link.origin === resolvedUrl.origin))
    .slice(0, 4);
  const pages = [
    { url: resolvedUrl, html: first.html },
    { url: new URL('/', resolvedUrl.origin) },
    { url: new URL('/contact', resolvedUrl.origin) },
    { url: new URL('/contact-us', resolvedUrl.origin) },
    { url: new URL('/about', resolvedUrl.origin) },
    { url: new URL('/about-us', resolvedUrl.origin) },
    { url: new URL('/contato', resolvedUrl.origin) },
    { url: new URL('/contacto', resolvedUrl.origin) },
    ...discoveredLinks.map(link => ({ url: link })),
  ];
  const visited = new Set<string>();
  for (const page of pages) {
    if (visited.has(page.url.href)) continue;
    visited.add(page.url.href);
    try {
      const result = page.html === undefined ? await fetchPublicHtml(page.url) : { html: page.html, finalUrl: page.url };
      const found = pageDetails(result.html, result.finalUrl.hostname);
      for (const [key, value] of Object.entries(found)) if (value && !details[key]) details[key] = value;
    } catch { /* Try the next public page. */ }
    if (details.email && details.phone && details.company) break;
  }
  return details;
}
