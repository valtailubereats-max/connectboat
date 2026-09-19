import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash, timingSafeEqual } from 'node:crypto';

// Serverless Email Service for ConnectBoat

const EMAIL_FLAG_ACTIVE = process.env.EMAIL_ACTIVE !== 'false';

const FIREBASE_PROJECT_ID = 'navlink-489413';
const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

function getFirebaseAdminApp() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (rawServiceAccount) {
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
        projectId: FIREBASE_PROJECT_ID,
      });
    } else {
      initializeApp({
        projectId: FIREBASE_PROJECT_ID,
      });
    }
  }

  return getApp();
}

async function verifyRequestUser(req: any) {
  const authHeader = req.headers?.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new Error('AUTH_TOKEN_MISSING');
  }

  const idToken = match[1];
  return getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
}


function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function getUserRole(uid: string): Promise<string> {
  const db = getFirestore(getFirebaseAdminApp(), FIRESTORE_DATABASE_ID);
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? (snap.data()?.role || 'user') : 'user';
}

async function isAdminUser(decodedUser: any): Promise<boolean> {
  const role = await getUserRole(decodedUser.uid);
  if (role === 'admin') return true;
  const email = typeof decodedUser?.email === 'string' ? decodedUser.email.trim().toLowerCase() : '';
  return new Set([
    'valtailubereats@gmail.com',
    'valtail@gmail.com',
    'generalsales2021@gmail.com',
  ]).has(email);
}

function normaliseSmsPhone(value: unknown): string {
  let phone = String(value || '').trim().replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  // UK local numbers use a trunk zero. Remove it whether the number is entered
  // locally (075...) or with an already-entered +44/0044 prefix (+44 075...).
  if (/^\+440\d{9,10}$/.test(phone)) phone = '+44' + phone.slice(4);
  if (/^440\d{9,10}$/.test(phone)) phone = '+44' + phone.slice(3);
  if (/^0\d{9,10}$/.test(phone)) phone = '+44' + phone.slice(1);
  if (/^44\d{9,10}$/.test(phone)) phone = '+' + phone;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
}

// ClickSend replaces this placeholder with a unique unsubscribe URL for the recipient.
// Alpha Tags cannot receive STOP replies, so commercial SMS must use this campaign-only method.
const CLICKSEND_UNSUBSCRIBE_PLACEHOLDER = 'StopMsg.me/xxxxx';
const COMMERCIAL_SMS_MESSAGE = `Hi, ConnectBoat is a UK marine marketplace. We'd like to invite your business to join us at connectboat.co.uk. Unsubscribe: ${CLICKSEND_UNSUBSCRIBE_PLACEHOLDER}`;

function getClickSendMessageId(payload: any): string | null {
  const data = payload?.data;
  const item = Array.isArray(data)
    ? data[0]
    : Array.isArray(data?.messages)
      ? data.messages[0]
      : data;
  const messageId = item?.message_id || item?.id;
  return typeof messageId === 'string' ? messageId : null;
}

function getClickSendCampaignId(payload: any): string | null {
  const campaignId = payload?.data?.sms_campaign_id || payload?.data?.id;
  return campaignId === undefined || campaignId === null ? null : String(campaignId);
}

function clickSendListName(phone: string): string {
  // The list name is deterministic and contains no phone number or company name.
  return `connectboat-sms-${createHash('sha256').update(phone).digest('hex').slice(0, 24)}`;
}

function clickSendRecords(payload: any): any[] {
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function clickSendRequest(username: string, apiKey: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`https://rest.clicksend.com/v3${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function resolveClickSendCampaignList(username: string, apiKey: string, phone: string) {
  const listName = clickSendListName(phone);
  const search = await clickSendRequest(
    username,
    apiKey,
    `/search/contacts-lists?q=${encodeURIComponent(listName)}`
  );
  if (!search.response.ok || search.payload?.response_code !== 'SUCCESS') {
    throw new Error(search.payload?.response_msg || 'ClickSend could not check the SMS contact list.');
  }

  const existingList = clickSendRecords(search.payload).find((item: any) => item?.list_name === listName);
  if (existingList?.list_id) {
    const contacts = await clickSendRequest(username, apiKey, `/lists/${existingList.list_id}/contacts?limit=100`);
    if (!contacts.response.ok || contacts.payload?.response_code !== 'SUCCESS') {
      throw new Error(contacts.payload?.response_msg || 'ClickSend could not check the SMS recipient.');
    }
    const stillSubscribed = clickSendRecords(contacts.payload).some(
      (contact: any) => normaliseSmsPhone(contact?.phone_number) === phone
    );
    if (!stillSubscribed) {
      const error: any = new Error('This number has opted out of ConnectBoat SMS and cannot be contacted.');
      error.statusCode = 409;
      throw error;
    }
    return String(existingList.list_id);
  }

  const created = await clickSendRequest(username, apiKey, '/lists', {
    method: 'POST',
    body: JSON.stringify({ list_name: listName }),
  });
  const listId = created.payload?.data?.list_id;
  if (!created.response.ok || created.payload?.response_code !== 'SUCCESS' || !listId) {
    throw new Error(created.payload?.response_msg || 'ClickSend could not create the SMS contact list.');
  }

  const contact = await clickSendRequest(username, apiKey, `/lists/${listId}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ phone_number: phone }),
  });
  if (!contact.response.ok || contact.payload?.response_code !== 'SUCCESS') {
    throw new Error(contact.payload?.response_msg || 'ClickSend could not add the SMS recipient.');
  }

  return String(listId);
}

async function sendCommercialSmsCampaign(to: string) {
  const username = process.env.CLICKSEND_USERNAME;
  const apiKey = process.env.CLICKSEND_API_KEY;
  if (!username || !apiKey) {
    const error: any = new Error('SMS provider is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const listId = await resolveClickSendCampaignList(username, apiKey, to);
  const campaignName = `ConnectBoat invitation ${Date.now()}`;
  const { response, payload } = await clickSendRequest(username, apiKey, '/sms-campaigns/send', {
    method: 'POST',
    body: JSON.stringify({
      list_id: Number(listId),
      name: campaignName,
      from: 'ConnectBoat',
      body: COMMERCIAL_SMS_MESSAGE,
      source: 'connectboat-event-contacts',
      senders: [{ recipient_country_code: 'GB', sender_id: 'ConnectBoat' }],
    }),
  });
  if (!response.ok || payload?.response_code !== 'SUCCESS') {
    const error: any = new Error(payload?.response_msg || 'SMS provider rejected the campaign.');
    error.statusCode = 502;
    throw error;
  }

  return {
    campaignId: getClickSendCampaignId(payload),
    listId,
    message: payload?.response_msg || 'SMS campaign accepted for delivery.',
  };
}

function isSuppressedEventContact(contact: any): boolean {
  const status = String(contact?.invitationStatus || '').trim().toLowerCase();
  return status === 'unsubscribed'
    || contact?.suppressed === true
    || contact?.isSuppressed === true
    || contact?.smsOptedOut === true
    || contact?.optedOut === true
    || contact?.unsubscribed === true;
}

type EventContactSmsCandidate = { id: string; company: string; phone: string };
type EventContactSmsExclusion = { id: string; company: string; reason: string };
type EventContactSmsEvaluation = { candidate?: EventContactSmsCandidate; exclusion?: EventContactSmsExclusion };

function eventContactSmsCandidate(id: string, contact: any): EventContactSmsEvaluation {
  const company = String(contact?.company || contact?.name || 'Unnamed contact').trim();
  if (contact?.invitationStatus !== 'Pending') return { exclusion: { id, company, reason: 'Invitation Status is not Pending.' } };
  if (contact?.invitationChannel === 'SMS' || contact?.invitationStatus === 'Sent – SMS') {
    return { exclusion: { id, company, reason: 'This contact has already received SMS.' } };
  }
  if (isSuppressedEventContact(contact)) return { exclusion: { id, company, reason: 'This contact is suppressed or opted out.' } };

  const numbers = [contact?.whatsapp, contact?.phone]
    .map(normaliseSmsPhone)
    .filter((number, index, values) => number && values.indexOf(number) === index);
  const phone = numbers.find(number => /^\+447\d{9}$/.test(number));
  if (!phone) return { exclusion: { id, company, reason: 'No valid UK mobile number (+447...) is available.' } };
  return { candidate: { id, company, phone } };
}

function hasValidAutomationKey(req: any): boolean {
  const configured = process.env.CONNECTBOAT_SMS_AUTOMATION_KEY;
  const supplied = req.headers?.['x-connectboat-automation-key'];
  if (!configured || typeof supplied !== 'string') return false;
  const expected = Buffer.from(configured);
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function hasValidSmsReceiptKey(req: any): boolean {
  const configured = process.env.CONNECTBOAT_SMS_RECEIPT_KEY;
  // ClickSend's delivery-report URL supports a private query token. A header is
  // also accepted for a future signed relay, but no browser ever receives either.
  const supplied = req.headers?.['x-connectboat-sms-receipt-key'] || req.query?.key;
  if (!configured || typeof supplied !== 'string') return false;
  const expected = Buffer.from(configured);
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function clickSendReceiptRecords(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (payload?.data && typeof payload.data === 'object' && (payload.data.message_id || payload.data.messageId)) return [payload.data];
  return payload && typeof payload === 'object' ? [payload] : [];
}

function receiptPhone(receipt: any): string {
  return normaliseSmsPhone(receipt?.to || receipt?.recipient || receipt?.phone_number || receipt?.phone);
}

function receiptCampaignId(receipt: any): string | null {
  const value = receipt?.sms_campaign_id || receipt?.campaign_id || receipt?.campaignId;
  return value === undefined || value === null || value === '' ? null : String(value);
}

function receiptDeliveryState(receipt: any): 'SMS – Accepted' | 'SMS – Delivered' | 'SMS – Failed' {
  const statusCode = Number(receipt?.status_code ?? receipt?.statusCode);
  // ClickSend documents 201 as delivered. A delivery receipt with a 3xx/4xx/5xx
  // status is final failure. All other receipt states remain accepted/pending.
  if (statusCode === 201) return 'SMS – Delivered';
  if (Number.isFinite(statusCode) && statusCode >= 300) return 'SMS – Failed';
  return 'SMS – Accepted';
}

async function enrichReceiptFromClickSendHistory(receipt: any): Promise<any> {
  if (receiptPhone(receipt)) return receipt;
  const messageId = receipt?.message_id ?? receipt?.messageId;
  const username = process.env.CLICKSEND_USERNAME;
  const apiKey = process.env.CLICKSEND_API_KEY;
  if (!messageId || !username || !apiKey) return receipt;

  // A standard ClickSend receipt contains message_id and delivery status, but
  // not necessarily its recipient. SMS history can securely resolve that ID.
  const history = await clickSendRequest(
    username,
    apiKey,
    `/sms/history?limit=1&q=${encodeURIComponent(`message_id:${messageId}`)}`
  );
  if (!history.response.ok || history.payload?.response_code !== 'SUCCESS') return receipt;
  const record = clickSendRecords(history.payload)[0];
  return record ? { ...record, ...receipt } : receipt;
}

async function handleSmsDeliveryReceipts(req: any, res: any) {
  if (!hasValidSmsReceiptKey(req)) {
    return res.status(401).json({ success: false, error: 'Valid SMS receipt authentication is required.' });
  }

  const receipts = clickSendReceiptRecords(req.body);
  if (!receipts.length) {
    return res.status(400).json({ success: false, error: 'At least one ClickSend delivery receipt is required.' });
  }

  const db = getFirestore(getFirebaseAdminApp(), FIRESTORE_DATABASE_ID);
  const processed: Array<{ phone: string; state: string; campaignId: string | null; updated: boolean; reason?: string }> = [];

  for (const rawReceipt of receipts) {
    const receipt = await enrichReceiptFromClickSendHistory(rawReceipt);
    const phone = receiptPhone(receipt);
    const campaignId = receiptCampaignId(receipt);
    const state = receiptDeliveryState(receipt);
    if (!phone) {
      processed.push({ phone: '', state, campaignId, updated: false, reason: 'Receipt does not contain a valid recipient number.' });
      continue;
    }

    const matches = await db.collection('eventContacts').where('smsRecipient', '==', phone).limit(5).get();
    const eligible = matches.docs.filter(item => {
      const contact = item.data();
      return contact?.invitationStatus === 'SMS – Accepted'
        && (!campaignId || !contact?.smsCampaignId || String(contact.smsCampaignId) === campaignId);
    });
    if (eligible.length !== 1) {
      processed.push({
        phone,
        state,
        campaignId,
        updated: false,
        reason: eligible.length ? 'More than one accepted contact matches this receipt.' : 'No accepted ConnectBoat SMS matches this receipt.',
      });
      continue;
    }

    const statusCode = receipt?.status_code ?? receipt?.statusCode ?? null;
    const statusText = receipt?.status_text ?? receipt?.statusText ?? receipt?.status ?? null;
    const errorCode = receipt?.error_code ?? receipt?.errorCode ?? null;
    const errorText = receipt?.error_text ?? receipt?.errorText ?? receipt?.error ?? null;
    const messageId = receipt?.message_id ?? receipt?.messageId ?? null;
    const updated = await db.runTransaction(async transaction => {
      const latest = await transaction.get(eligible[0].ref);
      const contact = latest.data();
      if (contact?.invitationStatus !== 'SMS – Accepted' || contact?.smsRecipient !== phone
        || (campaignId && contact?.smsCampaignId && String(contact.smsCampaignId) !== campaignId)) return false;
      transaction.update(eligible[0].ref, {
        invitationChannel: 'SMS',
        invitationStatus: state,
        smsDeliveryStatus: state,
        smsDeliveryStatusCode: statusCode === null ? null : String(statusCode),
        smsDeliveryStatusText: statusText === null ? null : String(statusText),
        smsDeliveryErrorCode: errorCode === null ? null : String(errorCode),
        smsDeliveryErrorText: errorText === null ? null : String(errorText),
        smsClickSendMessageId: messageId === null ? null : String(messageId),
        smsDeliveryReceiptAt: new Date().toISOString(),
        sheetSyncPending: true,
      });
      return true;
    });
    processed.push({ phone, state, campaignId, updated });
  }

  return res.status(200).json({ success: true, processed });
}

async function handleSmsProspectingAutomation(req: any, res: any) {
  if (!hasValidAutomationKey(req)) {
    return res.status(401).json({ success: false, error: 'Valid automation authentication is required.' });
  }

  const requested = req.body?.quantity;
  if (!Number.isInteger(requested) || requested < 1 || requested > 5) {
    return res.status(400).json({ success: false, error: 'quantity must be an integer between 1 and 5.' });
  }

  const db = getFirestore(getFirebaseAdminApp(), FIRESTORE_DATABASE_ID);
  const snapshot = await db.collection('eventContacts').where('invitationStatus', '==', 'Pending').limit(200).get();
  const selected: Array<{ id: string; company: string; phone: string }> = [];
  const exclusions: Array<{ id: string; company: string; reason: string }> = [];
  const selectedPhones = new Set<string>();

  for (const item of snapshot.docs) {
    const evaluated = eventContactSmsCandidate(item.id, item.data());
    if (evaluated.exclusion) {
      exclusions.push(evaluated.exclusion);
      continue;
    }
    const candidate = evaluated.candidate!;
    if (selectedPhones.has(candidate.phone)) {
      exclusions.push({ id: candidate.id, company: candidate.company, reason: 'Duplicate UK mobile number in Event Contacts.' });
      continue;
    }
    selectedPhones.add(candidate.phone);
    selected.push(candidate);
    if (selected.length === requested) break;
  }

  const acceptedContacts: Array<{ id: string; company: string; phone: string; campaignId: string | null }> = [];
  const failures: Array<{ id: string; company: string; phone: string; reason: string }> = [];

  for (const candidate of selected) {
    try {
      // Re-read immediately before delivery so a manual change, suppression, or earlier send wins.
      const current = await db.collection('eventContacts').doc(candidate.id).get();
      const fresh = current.exists ? eventContactSmsCandidate(candidate.id, current.data()) : { exclusion: { id: candidate.id, company: candidate.company, reason: 'Contact no longer exists.' } };
      if (fresh.exclusion || fresh.candidate?.phone !== candidate.phone) {
        failures.push({ id: candidate.id, company: candidate.company, phone: candidate.phone, reason: fresh.exclusion?.reason || 'Contact phone changed before sending.' });
        continue;
      }

      const accepted = await sendCommercialSmsCampaign(candidate.phone);
      await db.runTransaction(async transaction => {
        const ref = db.collection('eventContacts').doc(candidate.id);
        const latest = await transaction.get(ref);
        const latestEvaluation = latest.exists ? eventContactSmsCandidate(candidate.id, latest.data()) : { exclusion: { reason: 'Contact no longer exists.' } };
        if (latestEvaluation.exclusion || latestEvaluation.candidate?.phone !== candidate.phone) {
          throw new Error(latestEvaluation.exclusion?.reason || 'Contact changed while SMS was being sent.');
        }
        transaction.update(ref, {
          invitationChannel: 'SMS',
          invitationStatus: 'SMS – Accepted',
          smsDeliveryStatus: 'SMS – Accepted',
          smsRecipient: candidate.phone,
          smsCampaignId: accepted.campaignId,
          smsClickSendListId: accepted.listId,
          smsAcceptedAt: new Date().toISOString(),
          sheetSyncPending: true,
        });
      });
      acceptedContacts.push({ ...candidate, campaignId: accepted.campaignId });
    } catch (error: any) {
      failures.push({ id: candidate.id, company: candidate.company, phone: candidate.phone, reason: error?.message || 'Commercial SMS could not be sent.' });
    }
  }

  return res.status(200).json({
    success: true,
    requested,
    selected,
    accepted: acceptedContacts,
    failures,
    exclusions,
    scannedPendingContacts: snapshot.size,
  });
}

async function handleSmsRequest(decodedUser: any, body: any, res: any) {
  if (!(await isAdminUser(decodedUser))) {
    return res.status(403).json({ success: false, error: 'Administrator access required.' });
  }

  const to = normaliseSmsPhone(body?.to);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!to) return res.status(400).json({ success: false, error: 'A valid international mobile number is required.' });
  if (!message || message.length > 480) {
    return res.status(400).json({ success: false, error: 'SMS message must contain between 1 and 480 characters.' });
  }
  if (body?.allowLiveDelivery === false) {
    return res.status(200).json({
      success: true,
      simulated: true,
      messageId: `simulated-${Date.now()}`,
      message: 'SMS simulation completed. No SMS was sent.',
      recipient: to,
    });
  }

  if (body?.allowLiveDelivery !== true) {
    return res.status(400).json({ success: false, error: 'allowLiveDelivery must be explicitly true or false.' });
  }
  if (!/^\+447\d{9}$/.test(to)) {
    return res.status(400).json({ success: false, error: 'A valid UK mobile number is required for commercial SMS.' });
  }
  if (message !== COMMERCIAL_SMS_MESSAGE) {
    return res.status(400).json({ success: false, error: 'Commercial SMS must use the approved ConnectBoat message.' });
  }

  try {
    const accepted = await sendCommercialSmsCampaign(to);
    return res.status(200).json({
      success: true,
      simulated: false,
      campaignId: accepted.campaignId,
      listId: accepted.listId,
      message: accepted.message,
      recipient: to,
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 502).json({
      success: false,
      error: error?.message || 'ClickSend could not send the SMS campaign.',
    });
  }
}

async function isStaffEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const explicitAdminEmails = new Set([
    'valtailubereats@gmail.com',
    'valtail@gmail.com',
    'generalsales2021@gmail.com',
  ]);

  if (explicitAdminEmails.has(normalized)) return true;

  const db = getFirestore(getFirebaseAdminApp(), FIRESTORE_DATABASE_ID);
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) return false;

  const role = snap.docs[0].data()?.role;
  return role === 'admin' || role === 'moderator';
}

async function getAdSellerEmails(adId: string): Promise<string[]> {
  if (!adId) return [];

  const db = getFirestore(getFirebaseAdminApp(), FIRESTORE_DATABASE_ID);
  const adSnap = await db.collection('ads').doc(adId).get();

  if (!adSnap.exists) return [];

  const ad = adSnap.data() || {};
  const emails = new Set<string>();

  for (const field of ['sellerEmail', 'userEmail', 'ownerEmail', 'contactEmail', 'email']) {
    const value = ad[field];
    if (typeof value === 'string' && value.trim()) {
      emails.add(value.trim().toLowerCase());
    }
  }

  const sellerUid =
    ad.sellerId ||
    ad.userId ||
    ad.ownerId ||
    ad.createdBy;

  if (typeof sellerUid === 'string' && sellerUid.trim()) {
    const userSnap = await db.collection('users').doc(sellerUid.trim()).get();
    if (userSnap.exists) {
      const email = userSnap.data()?.email;
      if (typeof email === 'string' && email.trim()) {
        emails.add(email.trim().toLowerCase());
      }
    }

    try {
      const authUser = await getAuth(getFirebaseAdminApp()).getUser(sellerUid.trim());
      if (authUser.email) {
        emails.add(authUser.email.trim().toLowerCase());
      }
    } catch {
      // Firestore/listing email may already be sufficient.
    }
  }

  return Array.from(emails);
}

async function authorizeEmailRequest(
  decodedUser: any,
  template: string,
  to: string | string[],
  data: any
) {
  const recipients = normalizeRecipients(to);

  if (recipients.length === 0) {
    const error: any = new Error('A valid recipient is required.');
    error.statusCode = 400;
    throw error;
  }

  const callerEmail =
    typeof decodedUser?.email === 'string'
      ? decodedUser.email.trim().toLowerCase()
      : '';

  const callerRole = await getUserRole(decodedUser.uid);
  const callerIsStaff =
    callerRole === 'admin' ||
    callerRole === 'moderator' ||
    [
      'valtailubereats@gmail.com',
      'valtail@gmail.com',
      'generalsales2021@gmail.com',
    ].includes(callerEmail);

  const ownEmailTemplates = new Set([
    'boas_vindas',
    'anuncio_submetido',
    'compra_concluida',
  ]);

  if (ownEmailTemplates.has(template)) {
    if (!callerEmail || recipients.some((recipient) => recipient !== callerEmail)) {
      const error: any = new Error('This email template may only be sent to the authenticated user.');
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  const staffOnlyTemplates = new Set([
    'anuncio_aprovado',
    'anuncio_rejeitado',
    'alerta_saude_sistema',
    'event_contact_invitation',
  ]);

  if (staffOnlyTemplates.has(template)) {
    if (!callerIsStaff) {
      const error: any = new Error('Staff access required for this email template.');
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  if (template === 'seller_message') {
    const suppliedBuyerEmail =
      typeof data?.interestedEmail === 'string'
        ? data.interestedEmail.trim().toLowerCase()
        : '';

    if (!callerEmail || suppliedBuyerEmail !== callerEmail) {
      const error: any = new Error('The sender email must match the authenticated ConnectBoat account.');
      error.statusCode = 403;
      throw error;
    }

    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    if (message.length < 10 || message.length > 3000) {
      const error: any = new Error('Message must contain between 10 and 3000 characters.');
      error.statusCode = 400;
      throw error;
    }
  }

  if (template === 'anuncio_pendente_staff') {
    const checks = await Promise.all(recipients.map((recipient) => isStaffEmail(recipient)));
    if (checks.some((allowed) => !allowed)) {
      const error: any = new Error('Pending-listing notifications may only be sent to staff recipients.');
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  if (template === 'interesse_contacto' || template === 'seller_message' || template === 'review_recebida') {
    const adId = typeof data?.adId === 'string' ? data.adId : '';
    const sellerEmails = await getAdSellerEmails(adId);

    if (
      sellerEmails.length === 0 ||
      recipients.some((recipient) => !sellerEmails.includes(recipient))
    ) {
      const error: any = new Error('Recipient does not match the seller of this listing.');
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  // Payment confirmations are dispatched server-to-server by the Stripe flow.
  if (template === 'pagamento_confirmado') {
    const error: any = new Error('Payment confirmation emails are server-only.');
    error.statusCode = 403;
    throw error;
  }

  const error: any = new Error('Email template is not allowed on the public endpoint.');
  error.statusCode = 403;
  throw error;
}


function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function nl2brSafe(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

// Helper to generate unified HTML email templates
function generateConnectBoatTemplate(title: string, bodyContent: string, ctaLink?: string, ctaText?: string): string {
  const ctaButton = ctaLink && ctaText ? `
    <div style="margin: 25px 0; text-align: center;">
      <a href="${ctaLink}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        ${ctaText}
      </a>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 20px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              
              <!-- Header -->
              <tr style="background-color: #0f172a;">
                <td style="padding: 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.05em;">
                    ⛵ ConnectBoat
                  </h1>
                  <p style="margin: 4px 0 0 0; color: #38bdf8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
                    UK Boat & Marine Marketplace
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px; color: #334155; font-size: 15px; line-height: 1.6;">
                  ${bodyContent}
                  ${ctaButton}
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                  <p style="font-size: 12px; color: #64748b; margin: 0;">
                    Need assistance or have questions? Contact us at <a href="mailto:contato@connectboat.co.uk" style="color: #0284c7; text-decoration: underline;">contato@connectboat.co.uk</a>.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr style="background-color: #f1f5f9;">
                <td style="padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
                  <p style="margin: 0 0 6px 0; font-weight: 700;">ConnectBoat UK</p>
                  <p style="margin: 0;">United Kingdom Marine & Boat Marketplace</p>
                  <p style="margin: 12px 0 0 0; font-size: 10px; color: #94a3b8;">
                    This is an automated notification. Please write to contato@connectboat.co.uk for customer support.
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
}

// Render specific email templates
export function renderEmail(template: string, data: any): { subject: string; html: string } {
  let subject = '';
  let bodyContent = '';
  let ctaLink: string | undefined;
  let ctaText: string | undefined;

  let resolvedUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.APP_URL;

  if (!resolvedUrl) {
    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_URL) {
      resolvedUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      resolvedUrl = 'https://www.connectboat.co.uk';
    }
  }

  const baseUrl = resolvedUrl.replace(/\/$/, '');

  switch (template) {
    case 'recibo_pagamento_anuncio':
      const awaitingApproval = data.awaitingApproval === true;
      subject = `Your ConnectBoat listing payment is confirmed`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0; color: #0f172a;">Hello ${data.userName || 'Valued Member'},</p>
        <p style="color: #475569; margin-bottom: 20px;">
          ${awaitingApproval
            ? 'Thank you for advertising on ConnectBoat! Your payment has been confirmed. Your listing is now awaiting admin or moderator approval before publication.'
            : 'Thank you for advertising on ConnectBoat! Your payment has been confirmed and your listing is now <strong>active</strong>.'}
        </p>

        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #166534; display: block;">Payment Status</span>
                <span style="font-size: 18px; font-weight: 800; color: #15803d;">${awaitingApproval ? 'CONFIRMED / AWAITING APPROVAL' : 'CONFIRMED & ACTIVE'}</span>
              </td>
              <td align="right" style="font-size: 20px; font-weight: 800; color: #166534;">
                ${data.totalAmount || 'Paid'}
              </td>
            </tr>
          </table>
        </div>

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 14px;">
          <tr>
            <td colspan="2" style="padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
              Itemized Summary
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #475569;">${data.planTitle || 'Listing Fee'}</td>
            <td align="right" style="padding: 10px 0; font-weight: bold; color: #0f172a;">${data.planPrice || 'Paid'}</td>
          </tr>
          ${data.hasMediaBoost ? `
          <tr>
            <td style="padding: 10px 0; color: #475569;">Media Boost (60s Listing Video)</td>
            <td align="right" style="padding: 10px 0; font-weight: bold; color: #0f172a;">${data.mediaBoostPrice || '£2.00'}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding-top: 12px; border-top: 2px solid #cbd5e1; font-weight: 800; color: #0f172a; font-size: 15px;">Total Paid</td>
            <td align="right" style="padding-top: 12px; border-top: 2px solid #cbd5e1; font-weight: 800; color: #0284c7; font-size: 16px;">${data.totalAmount || 'Paid'}</td>
          </tr>
        </table>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">
            Listing & Transaction Details
          </h3>
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #334155;">
            <tr>
              <td style="padding: 5px 0; color: #64748b; width: 40%;">Listing Title:</td>
              <td style="padding: 5px 0; font-weight: bold; color: #0f172a;">${data.adTitle || 'Boat Listing'}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Listing Reference:</td>
              <td style="padding: 5px 0; font-family: monospace; color: #0f172a;">#${data.adId}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Listing Type:</td>
              <td style="padding: 5px 0; font-weight: bold; color: #0f172a;">${data.listingType || 'Boat for Sale'}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Status:</td>
              <td style="padding: 5px 0;"><span style="background: ${awaitingApproval ? '#fef3c7' : '#dcfce7'}; color: ${awaitingApproval ? '#b45309' : '#15803d'}; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">${awaitingApproval ? 'Awaiting Approval' : 'Active'}</span></td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Payment Date:</td>
              <td style="padding: 5px 0; color: #0f172a;">${data.paymentDate}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">${awaitingApproval ? 'Listing Period:' : 'Expiry Date:'}</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: bold;">${data.expiryDate}</td>
            </tr>
            ${data.paymentRef ? `
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Session / Payment Ref:</td>
              <td style="padding: 5px 0; font-family: monospace; font-size: 11px; color: #64748b;">${data.paymentRef}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          ${awaitingApproval ? '' : `
          <a href="${data.adUrl || `${baseUrl}/anuncio/${data.adId}`}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 12px 22px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px; margin-right: 8px; margin-bottom: 8px;">
            Open Listing
          </a>`}
          <a href="${data.manageUrl || `${baseUrl}/profile`}" target="_blank" style="background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 12px 22px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px; margin-bottom: 8px;">
            My Listings
          </a>
        </div>
      `;
      break;
    case 'anuncio_submetido':
      subject = `⛵ Listing Submitted Successfully: ${data.adTitle || 'Your Listing'}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>Thank you for submitting your listing <strong>"${data.adTitle}"</strong> on ConnectBoat!</p>
        <p>Your listing has been received and is currently being reviewed by our moderation team to ensure compliance with our marine marketplace standards.</p>
        <p>You will receive an email update as soon as your listing is approved and published live.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'View My Account';
      break;

    case 'anuncio_aprovado':
      subject = `✅ Your Listing is Now Live on ConnectBoat: ${data.adTitle || ''}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>Great news! Your listing <strong>"${data.adTitle}"</strong> has been reviewed and <strong>approved</strong> by our moderation team.</p>
        <p>Your listing is now live on ConnectBoat and accessible to buyers across the UK marine community.</p>
        <p>We wish you smooth sailing and successful connections!</p>
      `;
      ctaLink = `${baseUrl}/anuncio/${data.adId}`;
      ctaText = 'View Live Listing';
      break;

    case 'anuncio_rejeitado':
      subject = `❌ Update Regarding Your Listing on ConnectBoat`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>Thank you for submitting your listing to ConnectBoat. Unfortunately, your listing <strong>"${data.adTitle}"</strong> could not be approved at this time.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <strong style="color: #991b1b; display: block; margin-bottom: 5px;">Reason for Rejection:</strong>
          <span style="color: #7f1d1d;">${data.reason || 'The listing does not comply with our marketplace guidelines.'}</span>
        </div>
        <p>Please review our publishing guidelines and make the necessary edits from your profile to resubmit.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Go to My Profile';
      break;

    case 'anuncio_pendente_staff':
      subject = `⚠️ NEW PENDING LISTING MODERATION: ${data.adTitle || 'Listing'}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello Staff / Moderator,</p>
        <p>A new listing has been submitted and is currently <strong>pending review</strong>.</p>
        <table border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 15px; border-radius: 6px; width: 100%; margin: 20px 0;">
          <tr>
            <td style="padding: 4px 0;"><strong>Title:</strong></td>
            <td style="padding: 4px 0;">${data.adTitle}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong>Seller:</strong></td>
            <td style="padding: 4px 0;">${data.sellerName}</td>
          </tr>
        </table>
        <p>Please log in to the ConnectBoat administration panel to review and approve or reject this listing.</p>
      `;
      ctaLink = `${baseUrl}/admin/ads`;
      ctaText = 'Go to Moderation Panel';
      break;

    case 'seller_message':
      subject = `✉️ New Message About: ${escapeHtml(data.adTitle || 'Your ConnectBoat Listing')}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${escapeHtml(data.sellerName || 'Seller')},</p>
        <p>You have received a new message from a ConnectBoat user about your listing:</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Listing:</strong> ${escapeHtml(data.adTitle || '')}</p>
          <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${escapeHtml(data.interestedName || 'ConnectBoat User')}</p>
          <p style="margin: 0;"><strong>Reply email:</strong> ${escapeHtml(data.interestedEmail || '')}</p>
        </div>
        <div style="background-color: #ffffff; border-left: 4px solid #4f46e5; padding: 16px 18px; margin: 20px 0; color: #334155;">
          ${nl2brSafe(data.message || '')}
        </div>
        <p style="font-size: 13px; color: #64748b;">
          You can reply directly to this email to respond to the interested user.
        </p>
      `;
      ctaLink = data.adUrl || `${baseUrl}/anuncio/${data.adId}`;
      ctaText = 'View Listing';
      break;

    case 'interesse_contacto':
      subject = `👥 New Buyer Enquiry for Your Listing: ${data.adTitle}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>You have a new buyer enquiry!</p>
        <p>A prospective buyer, <strong>${data.interestedName}</strong>, has initiated contact for your listing <strong>"${data.adTitle}"</strong>.</p>
        <p>Please check your WhatsApp or direct messages to respond promptly and secure your sale.</p>
      `;
      ctaLink = `${baseUrl}/anuncio/${data.adId}`;
      ctaText = 'View Listing';
      break;

    case 'review_recebida':
      subject = `⭐️ You Received a New Review on ConnectBoat!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>User <strong>${data.reviewerName}</strong> left a public review for your listing <strong>"${data.adTitle}"</strong>.</p>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <div style="font-size: 24px; color: #fbbf24; margin-bottom: 8px;">
            ${'★'.repeat(Math.min(5, Math.max(1, data.rating)))}
          </div>
          <p style="margin: 0; font-style: italic; color: #451a03; font-size: 16px;">
            "${data.comment || 'No comment provided.'}"
          </p>
        </div>
        <p>Positive reviews build trust across the ConnectBoat marine community. Keep up the great work!</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'View My Profile';
      break;

    case 'compra_concluida':
      subject = `🎉 Sale Marked as Completed!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>Congratulations on completing your transaction!</p>
        <p>Your listing <strong>"${data.adTitle}"</strong> has been marked as successfully sold to buyer <strong>${data.buyerName}</strong>.</p>
        <p>Thank you for choosing ConnectBoat as your trusted marine marketplace platform.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Manage My Listings';
      break;

    case 'pagamento_confirmado':
      subject = `💳 Payment Confirmed: ${data.planName || 'ConnectBoat Service'}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.userName || 'Valued Member'},</p>
        <p>We have successfully received your payment for <strong>${data.planName || 'Featured Listing / Digital Showcase'}</strong>.</p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <strong style="color: #166534; display: block; margin-bottom: 5px;">Order Summary:</strong>
          <span style="color: #15803d; font-size: 14px;">Plan: ${data.planName || 'Premium Plan'} • Amount: ${data.amount || 'Paid'}</span>
        </div>
        <p>Your upgraded feature status is now active on ConnectBoat.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'View My Account';
      break;

    case 'boas_vindas':
      subject = `⛵ Welcome to ConnectBoat - UK Marine Marketplace!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Welcome aboard, ${data.userName}!</p>
        <p>Your account has been successfully created on <strong>ConnectBoat</strong>, the UK's premier boat and marine classifieds platform.</p>
        <p>Here is what you can do on ConnectBoat:</p>
        <ul style="padding-left: 20px; margin: 15px 0;">
          <li>Publish listings for boats, marine equipment, parts, services, and charters.</li>
          <li>Browse listings across all regions in the UK.</li>
          <li>Connect directly with buyers and sellers via verified contact options.</li>
        </ul>
        <p>Please complete your profile details to start buying or selling with full confidence.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Complete Profile';
      break;

    case 'event_contact_invitation':
      subject = 'Invitation to ConnectBoat.co.uk';
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${escapeHtml(data.contactName || data.company || 'there')},</p>
        <p>We’d like to introduce you to ConnectBoat, a UK boating marketplace connecting boat owners, buyers, charter customers and marine businesses.</p>
        <p>We’d be delighted to welcome your business to the platform and invite you to discover ConnectBoat.</p>
        <div style="margin: 26px 0 0; text-align: center;">
          <img src="${baseUrl}/ConnectBoat_Email_Signature.jpg" alt="ConnectBoat — The UK Boating Marketplace" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; border-radius: 8px;" />
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 22px 0 0;">If you’d prefer not to receive further emails from ConnectBoat, reply “unsubscribe” and we won’t contact you again.</p>
      `;
      ctaLink = baseUrl;
      ctaText = 'Discover ConnectBoat';
      break;

    case 'alerta_saude_sistema':
      const levelColors: Record<string, string> = {
        'Saudável': '#22c55e',
        'Atenção': '#eab308',
        'Alerta': '#f97316',
        'Crítico': '#ef4444'
      };
      const alertColor = levelColors[data.currentLevel] || '#6366f1';
      subject = `⚠️ System Health Alert: ${data.currentLevel} (${data.healthPercentage}%)`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.adminName || 'Administrator'},</p>
        <p>The ConnectBoat System Health Monitor has detected a status change.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 6px solid ${alertColor};">
          <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Current Status</p>
          <h2 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 800; color: ${alertColor};">
            ${data.currentLevel} (${data.healthPercentage}%)
          </h2>
          ${data.previousLevel ? `<p style="margin: 0; font-size: 13px; color: #64748b;">Previous Level: <strong>${data.previousLevel}</strong></p>` : ''}
        </div>

        <h3 style="font-size: 14px; font-weight: bold; margin: 25px 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b;">Active Health Alerts:</h3>
        <div style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 14px; line-height: 1.5; color: #475569;">
          ${data.alertDetailsString || '<p style="padding: 15px; margin: 0; color: #64748b;">No active alerts at this time.</p>'}
        </div>

        ${data.actionRequired ? `
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <strong style="color: #b45309; display: block; margin-bottom: 5px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Recommended Action</strong>
            <span style="color: #78350f;">${data.actionRequired}</span>
          </div>
        ` : ''}

        <p style="margin-top: 25px;">Please check the administration health dashboard for full details.</p>
      `;
      ctaLink = `${baseUrl}/admin/health`;
      ctaText = 'Open System Health Dashboard';
      break;

    default:
      subject = `ConnectBoat Notification`;
      bodyContent = `
        <p>You have received a notification from ConnectBoat.</p>
        <p>${JSON.stringify(data)}</p>
      `;
  }

  const html = generateConnectBoatTemplate(subject, bodyContent, ctaLink, ctaText);
  return { subject, html };
}

// Direct Programmatic Email Dispatch Helper (for Webhooks & Admin Handlers)
export async function sendEmailDirect(to: string | string[], template: string, data: any) {
  if (!EMAIL_FLAG_ACTIVE) {
    console.log('[API Email] Direct send skipped: EMAIL_ACTIVE is false.');
    return { success: true, message: "Emails disabled globally" };
  }

  const { subject, html } = renderEmail(template, data);

  const emailFrom = process.env.EMAIL_FROM || 'ConnectBoat <no-reply@connectboat.co.uk>';
  const emailReplyTo = process.env.EMAIL_REPLY_TO || 'contato@connectboat.co.uk';
  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    console.log(`[API Email Direct] Dispatching via Resend to: ${Array.isArray(to) ? to.join(', ') : to}`);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: emailFrom,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
        reply_to: emailReplyTo
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Email Direct ERROR] Resend return ${response.status}:`, errorText);
      throw new Error(`Resend API Error (${response.status}): ${errorText}`);
    }

    const responseJson = await response.json();
    return { success: true, provider: 'resend', id: responseJson.id };
  }

  // Simulation log
  console.log(' ');
  console.log('========================================================================');
  console.log(`✉️ [EMAIL DIRECT SIMULATION] DISPATCH LOGGED FOR LOCAL DEVELOPMENT`);
  console.log(`   Recipient(s): ${Array.isArray(to) ? to.join(', ') : to}`);
  console.log(`   From:         ${emailFrom}`);
  console.log(`   Reply-To:     ${emailReplyTo}`);
  console.log(`   Subject:      ${subject}`);
  console.log(`   Template:     ${template}`);
  console.log('------------------------------------------------------------------------');
  console.log(`   Payload data:`, JSON.stringify(data, null, 2));
  console.log('========================================================================');
  console.log(' ');

  return { success: true, simulated: true };
}

// Vercel Serverless Module Handler
export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-ConnectBoat-Automation-Key, X-ConnectBoat-SMS-Receipt-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // This server-to-server automation deliberately has its own Vercel-only secret.
  // It must not use or accept a browser Firebase token as its authentication method.
  if (req.body?.channel === 'sms-prospecting-automation') {
    return handleSmsProspectingAutomation(req, res);
  }

  // ClickSend delivery receipts use an independent Vercel-only shared secret.
  // They never receive browser Firebase credentials or expose provider credentials.
  if (req.body?.channel === 'sms-delivery-receipt' || req.query?.channel === 'sms-delivery-receipt') {
    return handleSmsDeliveryReceipts(req, res);
  }

  // Security: this public endpoint may only be called by an authenticated
  // ConnectBoat user. Server-to-server flows (for example Stripe webhooks)
  // use sendEmailDirect() and are not affected by this check.
  let decodedUser: any;

  try {
    decodedUser = await verifyRequestUser(req);
  } catch (authError: any) {
    if (authError?.message === 'AUTH_TOKEN_MISSING') {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    console.warn('[API Email AUTH] Invalid Firebase ID token:', authError?.message || authError);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.',
    });
  }

  // SMS uses the same Firebase authentication boundary while bypassing email templates.
  if (req.body?.channel === 'sms') {
    return handleSmsRequest(decodedUser, req.body, res);
  }

  if (!EMAIL_FLAG_ACTIVE) {
    console.log('[API Email] Automated emails disabled globally via EMAIL_ACTIVE=false.');
    return res.status(200).json({ success: true, message: "Emails disabled globally" });
  }

  try {
    const { template, to, data } = req.body;

    if (!to || !template) {
      return res.status(400).json({ error: "Required parameters 'to' and 'template' are missing." });
    }

    try {
      await authorizeEmailRequest(decodedUser, template, to, data);
    } catch (authorizationError: any) {
      return res.status(authorizationError?.statusCode || 403).json({
        success: false,
        error: authorizationError?.message || 'Email request is not authorized.',
      });
    }

    const { subject, html } = renderEmail(template, data);

    const emailFrom = process.env.EMAIL_FROM || 'ConnectBoat <no-reply@connectboat.co.uk>';
    const defaultReplyTo = process.env.EMAIL_REPLY_TO || 'contato@connectboat.co.uk';
    const authenticatedReplyEmail =
      typeof decodedUser?.email === 'string' && decodedUser.email.includes('@')
        ? decodedUser.email.trim().toLowerCase()
        : '';
    const emailReplyTo =
      template === 'seller_message' && authenticatedReplyEmail
        ? authenticatedReplyEmail
        : defaultReplyTo;
    const resendApiKey = process.env.RESEND_API_KEY;

    // Send via Resend (Single production email provider for ConnectBoat)
    if (resendApiKey) {
      console.log(`[API Email] Sending real email via Resend to: ${Array.isArray(to) ? to.join(', ') : to}`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: emailFrom,
          to: Array.isArray(to) ? to : [to],
          subject: subject,
          html: html,
          reply_to: emailReplyTo
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API Email ERROR] Resend API return error ${response.status}:`, errorText);
        throw new Error(`Resend API Error (${response.status}): ${errorText}`);
      }

      const responseJson = await response.json();
      return res.status(200).json({ success: true, provider: 'resend', id: responseJson.id });
    }

    // Fallback: Console Simulation for local development without API key
    console.log(' ');
    console.log('========================================================================');
    console.log(`✉️ [EMAIL SIMULATION] DISPATCH LOGGED FOR LOCAL DEVELOPMENT`);
    console.log(`   Recipient(s): ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`   From:         ${emailFrom}`);
    console.log(`   Reply-To:     ${emailReplyTo}`);
    console.log(`   Subject:      ${subject}`);
    console.log(`   Template:     ${template}`);
    console.log('------------------------------------------------------------------------');
    console.log(`   Payload data:`, JSON.stringify(data, null, 2));
    console.log('========================================================================');
    console.log(' ');

    return res.status(200).json({ 
      success: true, 
      simulated: true, 
      info: "Email simulated successfully in dev environment (RESEND_API_KEY not configured)" 
    });

  } catch (err: any) {
    console.error("[API Email ERROR] Failed to send email:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
}
