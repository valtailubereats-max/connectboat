export type ProspectLocationInput = {
  id?: string; company?: string; name?: string; website?: string; email?: string;
  phone?: string; whatsapp?: string; invitationStatus?: string;
  address?: unknown; postcode?: unknown; city?: unknown; country?: unknown;
  latitude?: unknown; longitude?: unknown; lat?: unknown; lng?: unknown; lon?: unknown;
  location?: unknown;
};
export type MapProspect = ProspectLocationInput & { mapId: string; latitude: number; longitude: number };
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const key = (v: unknown) => text(v).toLowerCase().replace(/\s+/g, ' ');
const number = (v: unknown) => (typeof v === 'number' || typeof v === 'string' && v.trim()) ? Number(v) : NaN;
const domain = (v: unknown) => {
  try { return new URL(/^https?:\/\//i.test(text(v)) ? text(v) : 'https://' + text(v)).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
};
export function coordinates(row: ProspectLocationInput): [number, number] | null {
  const location = row.location && typeof row.location === 'object' ? row.location as ProspectLocationInput : {};
  const lat = number(row.latitude ?? row.lat ?? location.latitude ?? location.lat);
  const lng = number(row.longitude ?? row.lng ?? row.lon ?? location.longitude ?? location.lng ?? location.lon);
  const country = key(row.country ?? location.country);
  if (country && !['uk', 'gb', 'gbr', 'united kingdom', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'].includes(country)) return null;
  // UK viewport, including Northern Ireland and the northern islands. Never infer coordinates from a city.
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 49.8 && lat <= 61 && lng >= -8.3 && lng <= 2 ? [lat, lng] : null;
}
export function parseLocations(value: unknown): ProspectLocationInput[] {
  const obj = value as { prospects?: unknown; features?: unknown } | null;
  const rows = Array.isArray(value) ? value : Array.isArray(obj?.prospects) ? obj.prospects : Array.isArray(obj?.features) ? obj.features.map((feature: any) => ({
    ...feature?.properties,
    ...(feature?.geometry?.type === 'Point' ? { longitude: feature.geometry.coordinates?.[0], latitude: feature.geometry.coordinates?.[1] } : {}),
  })) : null;
  if (!rows || !rows.length || rows.length > 20000) throw new Error('Use a JSON array, { prospects: [...] }, or GeoJSON Point FeatureCollection (maximum 20,000 records).');
  if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Each location must be a prospect record.');
  return rows.map(row => {
    const safe: ProspectLocationInput = {};
    for (const field of ['id', 'company', 'name', 'website', 'email', 'phone', 'whatsapp', 'invitationStatus', 'address', 'postcode', 'city', 'country'] as const) {
      if (typeof row[field] === 'string') safe[field] = row[field].trim();
    }
    for (const field of ['latitude', 'longitude', 'lat', 'lng', 'lon'] as const) {
      if (typeof row[field] === 'number' || typeof row[field] === 'string') safe[field] = row[field];
    }
    if (row.location && typeof row.location === 'object') {
      const loc = row.location;
      safe.location = { latitude: loc.latitude ?? loc.lat, longitude: loc.longitude ?? loc.lng ?? loc.lon, country: text(loc.country) };
    }
    return safe;
  });
}
export function mergeLocations(contacts: ProspectLocationInput[], prepared: ProspectLocationInput[]): ProspectLocationInput[] {
  const used = new Set<number>();
  const result = contacts.map(contact => {
    const candidates = prepared.map((row, i) => ({ row, i }));
    const byId = candidates.filter(({ row }) => Boolean(contact.id && row.id === contact.id));
    const matches = byId.length ? byId : candidates.filter(({ row }) =>
      Boolean(domain(contact.website) && domain(contact.website) === domain(row.website)) ||
      Boolean(key(contact.company).length >= 5 && key(contact.company) === key(row.company)));
    // Ambiguous company/domain matches must not assign an arbitrary location.
    if (matches.length !== 1) return contact;
    const { row, i } = matches[0]; used.add(i);
    if (coordinates(contact)) return contact;
    return { ...row, ...contact, latitude: row.latitude ?? row.lat, longitude: row.longitude ?? row.lng ?? row.lon, location: row.location,
      address: contact.address || row.address, postcode: contact.postcode || row.postcode, country: contact.country || row.country };
  });
  return [...result, ...prepared.filter((_, i) => !used.has(i))];
}
export function project(lat: number, lng: number, zoom: number): [number, number] {
  const size = 256 * 2 ** zoom, sin = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * size, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size];
}
