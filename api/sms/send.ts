import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = 'navlink-489413';
const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
const SMS_DELIVERY_ENABLED = process.env.SMS_DELIVERY_ENABLED === 'true';

function getFirebaseAdminApp() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawServiceAccount) {
      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(rawServiceAccount);
      } catch {
        serviceAccount = JSON.parse(Buffer.from(rawServiceAccount, 'base64').toString('utf-8'));
      }
      if (typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      initializeApp({ credential: cert(serviceAccount), projectId: FIREBASE_PROJECT_ID });
    } else {
      initializeApp({ projectId: FIREBASE_PROJECT_ID });
    }
  }
  return getApp();
}

async function verifyAdmin(req: any) {
  const authHeader = req.headers?.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error: any = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const user = await getAuth(getFirebaseAdminApp()).verifyIdToken(match[1]);
  const db = getFirestore(getFirebaseAdminApp(), FIRESTORE_DATABASE_ID);
  const profile = await db.collection('users').doc(user.uid).get();
  const role = profile.exists ? profile.data()?.role : '';
  const adminEmails = new Set(['valtailubereats@gmail.com', 'valtail@gmail.com', 'generalsales2021@gmail.com']);
  const isAdmin = role === 'admin' || adminEmails.has(String(user.email || '').toLowerCase());
  if (!isAdmin) {
    const error: any = new Error('Administrator access required.');
    error.statusCode = 403;
    throw error;
  }
  return user;
}

function normalisePhone(value: unknown): string {
  let phone = String(value || '').trim().replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = '+' + phone.slice(2);
  if (/^0\d{9,10}$/.test(phone)) phone = '+44' + phone.slice(1);
  if (/^44\d{9,10}$/.test(phone)) phone = '+' + phone;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return '';
  return phone;
}

function getMessageId(payload: any): string | null {
  const data = payload?.data;
  const first = Array.isArray(data) ? data[0] : Array.isArray(data?.messages) ? data.messages[0] : data;
  return typeof first?.message_id === 'string' ? first.message_id : null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    await verifyAdmin(req);
    const to = normalisePhone(req.body?.to);
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!to) return res.status(400).json({ success: false, error: 'A valid international mobile number is required.' });
    if (!message || message.length > 480) return res.status(400).json({ success: false, error: 'SMS message must contain between 1 and 480 characters.' });

    // A real delivery needs both a server-side opt-in and a future explicit client action.
    // The current Event Contacts button always sends false, so this implementation is safe to test.
    if (!SMS_DELIVERY_ENABLED || req.body?.allowLiveDelivery !== true) {
      return res.status(200).json({
        success: true,
        simulated: true,
        messageId: `simulated-${Date.now()}`,
        message: 'SMS simulation completed. No SMS was sent.',
        recipient: to,
      });
    }

    const username = process.env.CLICKSEND_USERNAME;
    const apiKey = process.env.CLICKSEND_API_KEY;
    if (!username || !apiKey) return res.status(503).json({ success: false, error: 'SMS provider is not configured.' });
    const sender = process.env.CLICKSEND_SENDER_ID?.trim();
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`,
      },
      body: JSON.stringify({
        messages: [{ source: 'sdk', body: message, to, ...(sender ? { from: sender } : {}) }],
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.response_code !== 'SUCCESS') {
      return res.status(502).json({ success: false, error: payload?.response_msg || 'SMS provider rejected the request.' });
    }
    return res.status(200).json({ success: true, simulated: false, messageId: getMessageId(payload), message: payload?.response_msg || 'SMS accepted for delivery.' });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({ success: false, error: error?.message || 'SMS request failed.' });
  }
}
