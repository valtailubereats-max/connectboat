import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
let dbInstance: FirebaseFirestore.Firestore | null = null;

function getDb() {
  const firebaseAdmin = (admin as any).default || admin;
  if (!firebaseAdmin.apps?.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing.');
    let serviceAccount: any;
    try { serviceAccount = JSON.parse(raw); }
    catch { serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')); }
    if (typeof serviceAccount.private_key === 'string') serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(serviceAccount), projectId: PROJECT_ID });
  }
  if (!dbInstance) {
    dbInstance = firebaseAdmin.firestore();
    try { dbInstance.settings({ databaseId: DATABASE_ID }); } catch {}
  }
  return dbInstance;
}

const safeOrder = (id: string, data: any) => ({
  id,
  paymentStatus: data.paymentStatus || 'pending',
  workflowStatus: data.workflowStatus || 'awaiting_payment',
  advertiserName: data.advertiserName || '',
  targetUrl: data.targetUrl || '',
  displaySeconds: Number(data.displaySeconds || 4),
  durationDays: Number(data.durationDays || 30),
  amountPaid: typeof data.amountPaid === 'number' ? data.amountPaid : null,
  currency: data.currency || 'GBP',
  generatedBanners: Array.isArray(data.generatedBanners) ? data.generatedBanners : [],
  selectedBannerUrl: data.selectedBannerUrl || '',
  generationCount: Number(data.generationCount || 0),
  aiGenerationsIncluded: Number(data.aiGenerationsIncluded || 3),
  adminNote: data.adminNote || '',
});

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    const orderId = String(req.query.orderId || '');
    const accessToken = String(req.query.accessToken || '');
    if (!orderId || !accessToken) return res.status(400).json({ success: false, error: 'Missing order access details.' });

    const snap = await getDb().collection('advertisingOrders').doc(orderId).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Advertising order not found.' });

    const data = snap.data() || {};
    if (data.accessToken !== accessToken) return res.status(403).json({ success: false, error: 'Invalid advertising order access token.' });

    return res.status(200).json({ success: true, order: safeOrder(snap.id, data) });
  } catch (error: any) {
    console.error('[Advertising Order]', error);
    return res.status(500).json({ success: false, error: error?.message || 'Unable to load advertising order.' });
  }
}
