import { classifyContact, contactData, locationData, CONTACT_FIELDS, text } from '../utils/eventContactsSync.js';
import { readEventContacts } from './readEventContacts.mjs';

const SMS_HISTORY_BODY_PREFIX = "Hi, ConnectBoat is a UK marine marketplace. We'd like to invite your business to join us at connectboat.co.uk. Unsubscribe:";

async function reconcileAcceptedSms(db: any, ids: string[]) {
  const username = process.env.CLICKSEND_USERNAME;
  const apiKey = process.env.CLICKSEND_API_KEY;
  if (!username || !apiKey) throw new Error('SMS provider is not configured.');
  const snapshots = await db.getAll(...ids.map((id: string) => db.collection('eventContacts').doc(id)));
  let updated = 0;
  for (const snapshot of snapshots) {
    const contact = snapshot.data();
    if (!snapshot.exists || contact?.invitationStatus !== 'SMS – Accepted') continue;
    const phone = String(contact.smsRecipient || '');
    const acceptedAt = Date.parse(String(contact.smsAcceptedAt || ''));
    if (!/^\+447\d{9}$/.test(phone) || !Number.isFinite(acceptedAt)) continue;

    // History's date is the send time; delivery can happen much later.
    const from = Math.floor((acceptedAt - 10 * 60_000) / 1000);
    const to = Math.floor((acceptedAt + 10 * 60_000) / 1000);
    const query = new URLSearchParams({ q: `to:${phone}`, date_from: String(from), date_to: String(to), limit: '100' });
    let payload: any;
    try {
      const response = await fetch(`https://rest.clicksend.com/v3/sms/history?${query}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}` },
        signal: AbortSignal.timeout(5000),
      });
      payload = await response.json();
      if (!response.ok || payload?.response_code !== 'SUCCESS') continue;
    } catch { continue; }

    const records = Array.isArray(payload?.data) ? payload.data : payload?.data?.data;
    if (!Array.isArray(records) || (Number(payload?.data?.total) > records.length)) continue;
    const matches = records.filter((record: any) => {
      const sentAt = Number(record?.date ?? record?.timestamp_send);
      return record?.to === phone
        && sentAt >= from && sentAt <= to
        && (!record?.direction || record.direction === 'out')
        && typeof record.message_id === 'string' && Boolean(record.message_id)
        && (!contact.smsClickSendListId || !record.list_id || String(record.list_id) === String(contact.smsClickSendListId))
        && (!contact.smsCampaignId || !record.sms_campaign_id || String(record.sms_campaign_id) === String(contact.smsCampaignId))
        && (contact.smsClickSendMessageId
          ? record.message_id === contact.smsClickSendMessageId
          : typeof record.body === 'string' && record.body.startsWith(SMS_HISTORY_BODY_PREFIX));
    });
    if (matches.length !== 1) continue;
    const record = matches[0];
    const code = Number(record.status_code);
    const state = code === 201 ? 'SMS – Delivered' : Number.isFinite(code) && code >= 300 ? 'SMS – Failed' : null;
    if (!state) continue;

    const changed = await db.runTransaction(async (tx: any) => {
      const latest = await tx.get(snapshot.ref);
      const sameRecipient = await tx.get(db.collection('eventContacts').where('smsRecipient', '==', phone));
      const current = latest.data();
      if (current?.invitationStatus !== 'SMS – Accepted'
        || current?.smsRecipient !== phone
        || current?.smsAcceptedAt !== contact.smsAcceptedAt
        || current?.smsCampaignId !== contact.smsCampaignId
        || sameRecipient.docs.filter((item: any) => item.data()?.invitationStatus === 'SMS – Accepted').length !== 1) return false;
      tx.update(snapshot.ref, {
        invitationStatus: state,
        smsDeliveryStatus: state,
        smsDeliveryStatusCode: String(record.status_code),
        smsDeliveryStatusText: record.status_text == null ? null : String(record.status_text),
        smsDeliveryErrorCode: record.error_code == null ? null : String(record.error_code),
        smsDeliveryErrorText: record.error_text == null ? null : String(record.error_text),
        smsClickSendMessageId: record.message_id,
        sheetSyncPending: true,
      });
      return true;
    });
    if (changed) updated++;
  }
  return updated;
}

export async function callContactSheet(body: Record<string, unknown>, timeoutMs = 20000) {
  const token = process.env.EVENT_CONTACTS_SYNC_SECRET;
  const url = process.env.EVENT_CONTACTS_SHEETS_URL;
  if (!token || !url) throw new Error('Configure EVENT_CONTACTS_SYNC_SECRET and EVENT_CONTACTS_SHEETS_URL on the server.');
  let response: globalThis.Response;
  try {
    response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, token }), signal: AbortSignal.timeout(timeoutMs) });
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('Google Sheets took too long to respond. Wait a minute before retrying; the previous script may still be running.');
    throw error;
  }
  let result: any;
  try { result = await response.json(); } catch { throw new Error('Google Sheets returned an invalid response. Check the Apps Script deployment.'); }
  if (!response.ok || result?.ok !== true) throw new Error(text(result?.error) || 'Google Sheets did not confirm this operation.');
  return result;
}

export async function handleEventContacts(req: any, res: any, db: any, uid: string) {
  const startedAt = Date.now();
  const body = req.body || {};
  const contacts = db.collection('eventContacts');
  if (body.operation === 'reconcileSms') {
    const ids = body.contactIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 5
      || ids.some((id: unknown) => typeof id !== 'string' || !id || id.includes('/') || id.length > 200)
      || new Set(ids).size !== ids.length) {
      return res.status(400).json({ success: false, errorMessage: 'Select 1–5 distinct contact IDs.' });
    }
    const updated = await reconcileAcceptedSms(db, ids);
    return res.json({ success: true, updated });
  }
  if (body.operation === 'pull') {
    const offset = Number(body.offset ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ success: false, errorMessage: 'Invalid sync position.' });
    const page = await callContactSheet({ action: 'readContacts', offset, limit: 25 });
    if (!Array.isArray(page.contacts) || page.contacts.length > 25) throw new Error('Invalid contacts page.');
    const pageIds = page.contacts.map((row: any) => text(row.contactId));
    if (pageIds.some((id: string) => !id || id.includes('/') || id.length > 200)) throw new Error('A sheet contact has an invalid Contact ID.');
    const result = await db.runTransaction(async (tx: any) => {
      const guard = db.collection('systemSettings').doc('eventContactsSync');
      await tx.get(guard);
      const working = await readEventContacts(tx, contacts, pageIds);
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
          // The spreadsheet is the source for optional map fields. Do not overwrite
          // contact details, invitation status, or notes already in ConnectBoat.
          const location = locationData(row);
          const locationPatch = Object.fromEntries(Object.entries(location).filter(([, value]) => Boolean(value)));
          if (Object.keys(locationPatch).length) {
            tx.update(contacts.doc(match.contact.id), locationPatch);
            Object.assign(match.contact, locationPatch);
          }
          if (match.contact.id !== id) links.push({ oldId: id, contactId: match.contact.id });
          if (row.suppressed || data.invitationStatus === 'Unsubscribed') {
            tx.update(contacts.doc(match.contact.id), { invitationStatus: 'Unsubscribed' });
            match.contact.invitationStatus = 'Unsubscribed';
          }
          continue;
        }
        if (row.suppressed) data.invitationStatus = 'Unsubscribed';
        const payload = { ...data, ...locationData(row), photoUrl: '', photoPath: '', rawSource: '', createdBy: uid, source: 'googleSheets', sheetSyncPending: false };
        tx.create(contacts.doc(id), payload);
        working.push({ ...payload, id }); added++;
      }
      tx.set(guard, { lastImportedAt: new Date() }, { merge: true });
      return { added, existing, empty, ambiguous, links };
    }, { maxAttempts: 1 });
    let linkWarning = '';
    if (result.links.length) {
      try {
        const remainingMs = Math.min(10000, 50000 - (Date.now() - startedAt));
        if (remainingMs < 1000) throw new Error('Linking deferred to the next sync.');
        await callContactSheet({ action: 'linkContacts', links: result.links }, remainingMs);
      }
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
    }, { maxAttempts: 1 });
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
