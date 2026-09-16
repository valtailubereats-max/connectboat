import { classifyContact, contactData, CONTACT_FIELDS, text } from '../utils/eventContactsSync.js';

export async function callContactSheet(body: Record<string, unknown>) {
  const token = process.env.EVENT_CONTACTS_SYNC_SECRET;
  const url = process.env.EVENT_CONTACTS_SHEETS_URL;
  if (!token || !url) throw new Error('Configure EVENT_CONTACTS_SYNC_SECRET and EVENT_CONTACTS_SHEETS_URL on the server.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, token }), signal: AbortSignal.timeout(45000) });
  let result: any;
  try { result = await response.json(); } catch { throw new Error('Google Sheets returned an invalid response. Check the Apps Script deployment.'); }
  if (!response.ok || result?.ok !== true) throw new Error(text(result?.error) || 'Google Sheets did not confirm this operation.');
  return result;
}

export async function handleEventContacts(req: any, res: any, db: any, uid: string) {
  const body = req.body || {};
  const contacts = db.collection('eventContacts');
  if (body.operation === 'pull') {
    const offset = Number(body.offset ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ success: false, errorMessage: 'Invalid sync position.' });
    const page = await callContactSheet({ action: 'readContacts', offset, limit: 25 });
    if (!Array.isArray(page.contacts) || page.contacts.length > 25) throw new Error('Invalid contacts page.');
    const result = await db.runTransaction(async (tx: any) => {
      const guard = db.collection('systemSettings').doc('eventContactsSync');
      await tx.get(guard);
      const snapshot = await tx.get(contacts);
      const working = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id }));
      const links: any[] = [], ambiguous: string[] = [];
      let added = 0, existing = 0, empty = 0;
      for (const row of page.contacts) {
        const id = text(row.contactId);
        if (!id || id.includes('/') || id.length > 200) throw new Error('A sheet contact has an invalid Contact ID.');
        const data = contactData(row);
        if (!CONTACT_FIELDS.slice(0, 8).some(k => data[k])) { empty++; continue; }
        const match = classifyContact(row, working);
        if (match.kind === 'ambiguous') { ambiguous.push(data.company || data.name || data.email || id); continue; }
        if (match.kind === 'existing') {
          existing++;
          if (match.contact.id !== id) links.push({ oldId: id, contactId: match.contact.id });
          if (row.suppressed || data.invitationStatus === 'Unsubscribed') {
            tx.update(contacts.doc(match.contact.id), { invitationStatus: 'Unsubscribed' });
            match.contact.invitationStatus = 'Unsubscribed';
          }
          continue;
        }
        if (row.suppressed) data.invitationStatus = 'Unsubscribed';
        const payload = { ...data, photoUrl: '', photoPath: '', rawSource: '', createdBy: uid, source: 'googleSheets', sheetSyncPending: false };
        tx.create(contacts.doc(id), payload);
        working.push({ ...payload, id }); added++;
      }
      tx.set(guard, { lastImportedAt: new Date() }, { merge: true });
      return { added, existing, empty, ambiguous, links };
    });
    let linkWarning = '';
    if (result.links.length) {
      try { await callContactSheet({ action: 'linkContacts', links: result.links }); }
      catch { linkWarning = 'Some sheet IDs could not be linked. Run Sync Google Sheets again before exporting.'; }
    }
    return res.json({ success: true, ...result, links: undefined, nextOffset: page.nextOffset, linkWarning });
  }
  if (body.operation === 'push') {
    const ids = Array.isArray(body.contactIds) ? body.contactIds : [];
    if (!ids.length || ids.length > 25 || ids.some((id: unknown) => !text(id) || text(id).includes('/'))) return res.status(400).json({ success: false, errorMessage: 'Select 1–25 contact IDs.' });
    const snapshots = await db.getAll(...ids.map((id: string) => contacts.doc(id)));
    const rows = snapshots.filter((d: any) => d.exists).map((d: any) => ({ ...contactData(d.data()), contactId: d.id }));
    const result = await callContactSheet({ action: 'syncAll', contacts: rows });
    // Do not acknowledge a newer edit that happened while the sheet request was running.
    await db.runTransaction(async (tx: any) => {
      const latest = await Promise.all(snapshots.filter((d: any) => d.exists).map((d: any) => tx.get(d.ref)));
      for (const d of latest) {
        const sent = snapshots.find((s: any) => s.id === d.id);
        if (!d.exists) continue;
        const suppressed = result.suppressedIds?.includes(d.id);
        if (sent.updateTime.isEqual(d.updateTime)) tx.update(d.ref, {
          sheetSyncPending: false,
          ...(suppressed ? { invitationStatus: 'Unsubscribed' } : {}),
        });
        else if (suppressed) tx.update(d.ref, { invitationStatus: 'Unsubscribed' });
      }
    });
    return res.json({ success: true, added: result.added, updated: result.updated, suppressedIds: result.suppressedIds || [] });
  }
  if (body.operation === 'delete') {
    const contactId = text(body.contactId);
    if (!contactId || contactId.includes('/')) return res.status(400).json({ success: false, errorMessage: 'Invalid contact ID.' });
    await callContactSheet({ action: 'delete', contactId });
    return res.json({ success: true });
  }
  return res.status(400).json({ success: false, errorMessage: 'Unknown sync operation.' });
}
