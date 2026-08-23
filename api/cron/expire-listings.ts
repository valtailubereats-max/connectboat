import type { Request, Response } from 'express';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID =
  'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

function getAdminDb() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!rawServiceAccount) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT environment variable is missing.'
      );
    }

    let serviceAccount: any;

    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      const decoded = Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    }

    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key =
        serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getFirestore(getApp(), FIRESTORE_DATABASE_ID);
}

function isAuthorisedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error('CRON_SECRET environment variable is missing.');
  }

  const authHeader = req.headers.authorization || '';

  return authHeader === `Bearer ${cronSecret}`;
}

export default async function expireListingsHandler(
  req: Request,
  res: Response
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
    });
  }

  try {
    if (!isAuthorisedCronRequest(req)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorised',
      });
    }

    const db = getAdminDb();
    const now = Timestamp.now();

    /*
     * Only approved listings whose expirationDate has passed are eligible.
     * We never delete the listing: it is retained for admin history and
     * future renewal.
     */
    let snapshot;

    try {
      snapshot = await db
        .collection('ads')
        .where('status', '==', 'approved')
        .where('expirationDate', '<=', now)
        .limit(400)
        .get();
    } catch (queryError) {
      /*
       * Safe fallback in case the production Firestore project requests a
       * composite index for the equality + range query.
       * The fallback reads expired-date candidates and filters status here.
       */
      console.warn(
        '[Expire Listings] Indexed query unavailable. Using safe fallback.',
        queryError
      );

      snapshot = await db
        .collection('ads')
        .where('expirationDate', '<=', now)
        .limit(1000)
        .get();
    }

    const eligibleDocs = snapshot.docs.filter((docSnap) => {
      const data = docSnap.data();

      return (
        data.status === 'approved' &&
        data.adStatus !== 'expired' &&
        data.adStatus !== 'archived' &&
        data.adStatus !== 'sold'
      );
    });

    if (eligibleDocs.length === 0) {
      return res.status(200).json({
        success: true,
        checkedAt: now.toDate().toISOString(),
        expiredCount: 0,
        message: 'No listings needed to be expired.',
      });
    }

    const batch = db.batch();
    const expiredIds: string[] = [];

    for (const docSnap of eligibleDocs) {
      batch.update(docSnap.ref, {
        status: 'expired',
        adStatus: 'expired',
        isFeatured: false,
        awaitingAdminActivation: false,
        awaitingAdminApproval: false,
        expiredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      expiredIds.push(docSnap.id);
    }

    await batch.commit();

    console.log(
      `[Expire Listings] Expired ${expiredIds.length} listing(s):`,
      expiredIds
    );

    return res.status(200).json({
      success: true,
      checkedAt: now.toDate().toISOString(),
      expiredCount: expiredIds.length,
      expiredIds,
    });
  } catch (error: any) {
    console.error('[Expire Listings] Fatal error:', error);

    return res.status(500).json({
      success: false,
      error: 'LISTING_EXPIRY_FAILED',
      message:
        error?.message ||
        'An unexpected error occurred while expiring listings.',
    });
  }
}
