import type { Request, Response } from 'express';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { hasGA4MeasurementApiSecret, isValidGA4Context, normalizeGA4Context, sendGA4MeasurementEventsOnce, updateGA4ConsentState } from './ga4Measurement.js';

const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
const FIREBASE_PROJECT_ID = 'navlink-489413';
const ADMIN_EMAILS = new Set([
  'valtailubereats@gmail.com',
  'valtail@gmail.com',
  'generalsales2021@gmail.com',
]);

function getAdminDb() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawServiceAccount) {
      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(rawServiceAccount);
      } catch {
        serviceAccount = JSON.parse(Buffer.from(rawServiceAccount, 'base64').toString('utf8'));
      }
      if (typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      initializeApp({ credential: cert(serviceAccount), projectId: FIREBASE_PROJECT_ID });
    } else {
      // Match api/email/send.ts: use the Vercel runtime's default credentials
      // when a service-account secret is not configured.
      initializeApp({ projectId: FIREBASE_PROJECT_ID });
    }
  }
  return getFirestore(getApp(), DATABASE_ID);
}

function safeFailureCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown';
  const candidate = error as { code?: unknown; name?: unknown };
  const knownCodes = new Set([
    'app/invalid-credential', 'app/no-app', 'auth/argument-error', 'auth/id-token-expired',
    'auth/invalid-id-token', 'permission-denied', 'unauthenticated', 'failed-precondition',
    'not-found', 'unavailable', 'deadline-exceeded', 'resource-exhausted', 'already-exists',
    'internal',
  ]);
  if (typeof candidate.code === 'string' && knownCodes.has(candidate.code)) {
    return candidate.code;
  }
  const grpcCodes: Record<number, string> = {
    3: 'invalid-argument', 5: 'not-found', 7: 'permission-denied', 8: 'resource-exhausted',
    9: 'failed-precondition', 10: 'aborted', 13: 'internal', 14: 'unavailable', 16: 'unauthenticated',
  };
  if (typeof candidate.code === 'number' && grpcCodes[candidate.code]) {
    return grpcCodes[candidate.code];
  }
  if (['Error', 'TypeError', 'SyntaxError', 'RangeError'].includes(String(candidate.name))) {
    return String(candidate.name);
  }
  return 'unknown';
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

  let stage = 'firebase_admin_initialization';
  try {
    const db = getAdminDb();
    stage = 'firebase_authentication';
    const decoded = await getVerifiedUser(req);
    if (!decoded) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const { action } = req.body || {};

    if (action === 'consent') {
      stage = 'consent_update';
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
      stage = 'submission_validation';
      const adId = req.body?.adId;
      const context = normalizeGA4Context({
        clientId: req.body?.clientId,
        sessionId: req.body?.sessionId,
      });
      if (!safeAdId(adId) || !context) {
        return res.status(400).json({ error: 'INVALID_ANALYTICS_CONTEXT' });
      }
      stage = 'listing_lookup';
      const adRef = db.collection('ads').doc(adId);
      const adSnapshot = await adRef.get();
      const ad = adSnapshot.exists ? adSnapshot.data() : null;
      if (!ad || ad.sellerId !== decoded.uid) return res.status(404).json({ error: 'LISTING_NOT_FOUND' });

      stage = 'consent_state_update';
      const consentApplied = await updateGA4ConsentState(db, decoded.uid, true, req.body?.consentChangedAt);
      if (!consentApplied) return res.status(200).json({ success: true, tracked: false });
      stage = 'attribution_save';
      await db.collection('ga4AdAttribution').doc(adId).set({
        ownerUid: decoded.uid,
        context,
        consented: true,
        category: typeof ad.category === 'string' ? ad.category.slice(0, 60) : 'other',
        plan: typeof ad.plan === 'string' ? ad.plan.slice(0, 30) : 'standard',
        paymentType: ad.paymentStatus === 'paid' ? 'paid' : 'free',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      if (!hasGA4MeasurementApiSecret()) {
        console.error('[Analytics ad event endpoint] GA4 delivery is not configured.', {
          stage: 'measurement_configuration',
          reason: 'missing_api_secret',
        });
        return res.status(503).json({ error: 'GA4_CONFIGURATION_MISSING' });
      }

      stage = 'measurement_protocol_delivery';
      const eventKey = `SUBMITTED_${adId}`;
      const tracked = await sendGA4MeasurementEventsOnce({
        db,
        eventKey,
        context,
        events: [{ name: 'ad_submitted', params: {
          ad_category: typeof ad.category === 'string' ? ad.category : 'other',
          listing_plan: typeof ad.plan === 'string' ? ad.plan : 'standard',
          listing_payment_type: ad.paymentStatus === 'paid' ? 'paid' : 'free',
        } }],
      });
      if (!tracked) {
        const eventSnapshot = await db.collection('ga4MeasurementEvents').doc(eventKey).get();
        if (eventSnapshot.data()?.status === 'sent') {
          return res.status(200).json({ success: true, tracked: true, duplicate: true });
        }
        const state = eventSnapshot.data()?.status;
        console.error('[Analytics ad event endpoint] GA4 delivery was not confirmed.', {
          stage,
          reason: state === 'failed' ? 'delivery_failed' : state === 'processing' ? 'delivery_in_progress' : 'delivery_not_confirmed',
        });
        return res.status(503).json({ error: 'GA4_DELIVERY_NOT_CONFIRMED' });
      }
      return res.status(200).json({ success: true, tracked: true });
    }

    if (action === 'published') {
      stage = 'publication_validation';
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
    console.error('[Analytics ad event endpoint] Request failed.', {
      stage,
      code: safeFailureCode(error),
    });
    return res.status(500).json({ error: 'ANALYTICS_REQUEST_FAILED' });
  }
}

async function consentRefFor(db: any, uid: unknown) {
  if (typeof uid !== 'string' || !uid) return false;
  const snapshot = await db.collection('ga4AnalyticsConsents').doc(uid).get();
  return snapshot.exists && snapshot.data()?.consented === true;
}
