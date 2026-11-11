import type { Request, Response } from 'express';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { isValidGA4Context, sendGA4MeasurementEventsOnce, updateGA4ConsentState } from './ga4Measurement.js';

const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
const ADMIN_EMAILS = new Set([
  'valtailubereats@gmail.com',
  'valtail@gmail.com',
  'generalsales2021@gmail.com',
]);

function getAdminDb() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) throw new Error('Firebase Admin is not configured.');
    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      serviceAccount = JSON.parse(Buffer.from(rawServiceAccount, 'base64').toString('utf8'));
    }
    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore(getApp(), DATABASE_ID);
}

async function getVerifiedUser(req: Request) {
  const match = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await getAuth(getApp()).verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

async function isAdmin(uid: string, email: string, db: any) {
  if (ADMIN_EMAILS.has(email.toLowerCase())) return true;
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && ['admin', 'moderator'].includes(userDoc.data()?.role);
}

function safeAdId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

export default async function adAnalyticsHandler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const db = getAdminDb();
    const decoded = await getVerifiedUser(req);
    if (!decoded) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const { action } = req.body || {};

    if (action === 'consent') {
      const consented = req.body?.consented === true;
      const applied = await updateGA4ConsentState(db, decoded.uid, consented, req.body?.consentChangedAt);
      if (!applied) return res.status(200).json({ success: true, stale: true });
      if (!consented) {
        const snapshot = await db.collection('ga4AdAttribution').where('ownerUid', '==', decoded.uid).get();
        for (let offset = 0; offset < snapshot.docs.length; offset += 450) {
          const batch = db.batch();
          snapshot.docs.slice(offset, offset + 450).forEach((doc: any) => {
            batch.set(doc.ref, { consented: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          });
          await batch.commit();
        }
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'record_submission') {
      const adId = req.body?.adId;
      const context = { clientId: req.body?.clientId, sessionId: req.body?.sessionId };
      if (!safeAdId(adId) || !isValidGA4Context(context)) {
        return res.status(400).json({ error: 'INVALID_ANALYTICS_CONTEXT' });
      }
      const adRef = db.collection('ads').doc(adId);
      const adSnapshot = await adRef.get();
      const ad = adSnapshot.exists ? adSnapshot.data() : null;
      if (!ad || ad.sellerId !== decoded.uid) return res.status(404).json({ error: 'LISTING_NOT_FOUND' });

      const consentApplied = await updateGA4ConsentState(db, decoded.uid, true, req.body?.consentChangedAt);
      if (!consentApplied) return res.status(200).json({ success: true, tracked: false });
      await db.collection('ga4AdAttribution').doc(adId).set({
        ownerUid: decoded.uid,
        context,
        consented: true,
        category: typeof ad.category === 'string' ? ad.category.slice(0, 60) : 'other',
        plan: typeof ad.plan === 'string' ? ad.plan.slice(0, 30) : 'standard',
        paymentType: ad.paymentStatus === 'paid' ? 'paid' : 'free',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      await sendGA4MeasurementEventsOnce({
        db,
        eventKey: `SUBMITTED_${adId}`,
        context,
        events: [{ name: 'ad_submitted', params: {
          ad_category: typeof ad.category === 'string' ? ad.category : 'other',
          listing_plan: typeof ad.plan === 'string' ? ad.plan : 'standard',
          listing_payment_type: ad.paymentStatus === 'paid' ? 'paid' : 'free',
        } }],
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'published') {
      const adId = req.body?.adId;
      if (!safeAdId(adId)) return res.status(400).json({ error: 'INVALID_LISTING_ID' });
      const email = typeof decoded.email === 'string' ? decoded.email : '';
      if (!await isAdmin(decoded.uid, email, db)) return res.status(403).json({ error: 'ADMIN_REQUIRED' });

      const [adSnapshot, attributionSnapshot] = await Promise.all([
        db.collection('ads').doc(adId).get(),
        db.collection('ga4AdAttribution').doc(adId).get(),
      ]);
      const ad = adSnapshot.exists ? adSnapshot.data() : null;
      const attribution = attributionSnapshot.exists ? attributionSnapshot.data() : null;
      if (!ad || ad.status !== 'approved' || ad.adStatus !== 'active') {
        return res.status(409).json({ error: 'LISTING_NOT_PUBLISHED' });
      }
      if (!attribution?.consented || !isValidGA4Context(attribution.context)) {
        return res.status(200).json({ success: true, tracked: false });
      }
      const consent = await consentRefFor(db, attribution.ownerUid);
      if (!consent) return res.status(200).json({ success: true, tracked: false });

      const tracked = await sendGA4MeasurementEventsOnce({
        db,
        eventKey: `PUBLISHED_${adId}`,
        context: attribution.context,
        events: [{ name: 'ad_published', params: {
          ad_category: typeof ad.category === 'string' ? ad.category : attribution.category || 'other',
          listing_plan: typeof ad.plan === 'string' ? ad.plan : attribution.plan || 'standard',
          listing_payment_type: ad.paymentStatus === 'paid' ? 'paid' : attribution.paymentType || 'free',
        } }],
      });
      return res.status(200).json({ success: true, tracked });
    }

    return res.status(400).json({ error: 'UNKNOWN_ACTION' });
  } catch (error) {
    console.error('[Analytics ad event endpoint] Request failed.');
    return res.status(500).json({ error: 'ANALYTICS_REQUEST_FAILED' });
  }
}

async function consentRefFor(db: any, uid: unknown) {
  if (typeof uid !== 'string' || !uid) return false;
  const snapshot = await db.collection('ga4AnalyticsConsents').doc(uid).get();
  return snapshot.exists && snapshot.data()?.consented === true;
}
