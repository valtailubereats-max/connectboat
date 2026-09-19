export const CONTACT_FIELDS = ['name','company','whatsapp','phone','email','website','linkedin','otherContact','invitationChannel','invitationStatus','notes'] as const;
export const LOCATION_FIELDS = ['address','postcode','city','country','latitude','longitude'] as const;
export function text(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }
export function contactData(row: any) {
  const result: Record<string, string> = {};
  for (const key of CONTACT_FIELDS) result[key] = text(row?.[key]);
  result.invitationStatus = ['Pending','Sent – WhatsApp','Sent – Email','Sent – Other','Unsubscribed','SMS – Accepted','SMS – Delivered','SMS – Failed'].includes(result.invitationStatus) ? result.invitationStatus : 'Pending';
  return result;
}
export function locationData(row: any) {
  const result: Record<string, string> = {};
  for (const key of LOCATION_FIELDS) result[key] = text(row?.[key]);
  return result;
}
function phone(value: unknown) { return text(value).replace(/\D/g, '').replace(/^00/, ''); }
function domain(value: unknown) { try { return new URL(/^https?:/i.test(text(value)) ? text(value) : 'https://' + text(value)).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }
export function classifyContact(row: any, contacts: any[]): { kind: 'existing' | 'ambiguous' | 'missing'; contact?: any } {
  const id = text(row.contactId);
  const exact = id && contacts.find(c => c.id === id);
  if (exact) return { kind: 'existing', contact: exact };
  const email = text(row.email).toLowerCase();
  const phones = [phone(row.phone), phone(row.whatsapp)].filter(Boolean);
  const strong = contacts.filter(c => (email && email === text(c.email).toLowerCase()) || phones.some(p => [phone(c.phone), phone(c.whatsapp)].includes(p)));
  if (strong.length === 1) return { kind: 'existing', contact: strong[0] };
  if (strong.length > 1) return { kind: 'ambiguous' };
  const company = text(row.company).toLowerCase().replace(/\s+/g, ' ');
  const site = domain(row.website);
  if (contacts.some(c => (site && domain(c.website) === site) || (company.length >= 5 && text(c.company).toLowerCase().replace(/\s+/g, ' ') === company))) return { kind: 'ambiguous' };
  return { kind: 'missing' };
}
