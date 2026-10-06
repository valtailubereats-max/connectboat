const TRACKING_QUERY_PARAMS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
]);

const normaliseText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const normalizeEventTitle = (value: string) => normaliseText(value);

export const normalizeEventCity = (value: string) => normaliseText(value);

export const normalizeEventVenue = (value: string) => normaliseText(value);

export const canonicalizeEventUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';

    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '');

    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
};

export const generateEventDedupeKey = (
  title: string,
  startDate: string,
  city: string,
) => [normalizeEventTitle(title), startDate.trim(), normalizeEventCity(city)].join('|');

