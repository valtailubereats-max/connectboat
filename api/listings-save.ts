import type { Request, Response } from 'express';
import { createHash } from 'crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
const PAID_BOAT_CATEGORIES = new Set(['Boats for Sale', 'Boats for Hire']);
const MARKETPLACE_CATEGORIES = new Set([
  'Boat Parts', 'Boat Engines', 'Marine Electronics', 'Trailers',
  'Marinas', 'Boat Services', 'Accessories', 'Wanted',
]);

function ensureAdminApp() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
    const serviceAccount = JSON.parse(raw);
    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getApp();
}

function normalisePlan(plan: unknown): 'standard' | 'featured' | 'premium' {
  const value = String(plan || 'standard').toLowerCase();
  if (value === 'premium' || value === 'national') return 'premium';
  if (['featured', 'highlight', 'local', 'intermediate'].includes(value)) return 'featured';
  return 'standard';
}

function normalisePhone(value: unknown): string {
  return String(value || '').replace(/[^0-9+]/g, '').replace(/^00/, '+');
}

function keyFor(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function looksLikeBoatSaleOrHire(category: string, title: string, description: string): boolean {
  if (category === 'Wanted') return false;
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  const explicitBoatOffer = /\bboat\s+(for\s+sale|for\s+hire|for\s+rent)\b/.test(text);
  const vesselWords = /\b(yacht|motorboat|speedboat|sailboat|catamaran|cruiser|narrowboat|houseboat|jet\s*ski|rib)\b/.test(text);
  const offerWords = /\b(for\s+sale|for\s+hire|for\s+rent|selling|charter)\b/.test(text);
  return explicitBoatOffer || (vesselWords && offerWords);
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ success: false, error: 'UNAUTHENTICATED', errorMessage: 'Please sign in again.' });
    }

    const app = ensureAdminApp();
    const decoded = await getAuth(app).verifyIdToken(match[1]);
    const uid = decoded.uid;
    const email = String(decoded.email || '').trim().toLowerCase();
    const { adId, adData } = req.body || {};

    if (!adId || typeof adId !== 'string' || !adData || typeof adData !== 'object') {
      return res.status(400).json({ success: false, error: 'INVALID_LISTING_PAYLOAD', errorMessage: 'A valid listing is required.' });
    }
    if (String(adData.sellerId || '') !== uid) {
      return res.status(403).json({ success: false, error: 'SELLER_MISMATCH', errorMessage: 'You can only create listings for your own account.' });
    }

    const db = getFirestore(app, FIRESTORE_DATABASE_ID);
    const settingsSnap = await db.collection('settings').doc('global').get();
    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const category = String(adData.category || '').trim();
    const images = Array.isArray(adData.images) ? adData.images : [];
    const isBoat = PAID_BOAT_CATEGORIES.has(category);
    const isMarketplace = MARKETPLACE_CATEGORIES.has(category);

    if (isBoat) {
      const plan = normalisePlan(adData.plan);
      const fallback = plan === 'premium' ? 25 : plan === 'featured' ? 15 : 8;
      const configured = Number(settings?.maxImages?.[plan]);
      const maxPhotos = Number.isFinite(configured) && configured > 0 ? configured : fallback;
      if (images.length > maxPhotos) {
        return res.status(400).json({ success: false, error: 'PHOTO_LIMIT', errorMessage: `Your ${plan} plan allows up to ${maxPhotos} photos.` });
      }
      adData.plan = plan;
    } else if (images.length > 3) {
      return res.status(400).json({ success: false, error: 'PHOTO_LIMIT', errorMessage: 'Marketplace listings allow up to 3 photos.' });
    }

    if (isMarketplace && looksLikeBoatSaleOrHire(category, String(adData.title || ''), String(adData.description || ''))) {
      return res.status(400).json({
        success: false,
        error: 'BOAT_MISCATEGORISED',
        errorMessage: 'This appears to be a complete boat or yacht for sale/hire. Please use Boats for Sale or Boats for Hire and select a boat listing plan.',
      });
    }

    const adRef = db.collection('ads').doc(adId);
    const existing = await adRef.get();
    if (existing.exists && existing.data()?.sellerId !== uid) {
      return res.status(403).json({ success: false, error: 'AD_OWNERSHIP_MISMATCH' });
    }

    if (isMarketplace && String(adData.marketplaceListingType || '') === 'free_first') {
      const phone = normalisePhone(adData.sellerPhone);
      if (!email || !phone || phone.length < 7) {
        return res.status(400).json({
          success: false,
          error: 'FREE_LISTING_IDENTITY_REQUIRED',
          errorMessage: 'A valid account email and phone number are required to use the one-time free Marketplace listing.',
        });
      }

      const userRef = db.collection('users').doc(uid);
      const phoneRef = db.collection('marketplaceFreePhones').doc(keyFor(phone));
      const emailRef = db.collection('marketplaceFreeEmails').doc(keyFor(email));

      await db.runTransaction(async (tx) => {
        const [userSnap, phoneSnap, emailSnap, adSnap] = await Promise.all([
          tx.get(userRef), tx.get(phoneRef), tx.get(emailRef), tx.get(adRef),
        ]);
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        if (userData.marketplaceFreeListingUsed === true) throw new Error('FREE_MARKETPLACE_LISTING_ALREADY_USED');
        if (phoneSnap.exists && phoneSnap.data()?.uid !== uid) throw new Error('FREE_MARKETPLACE_PHONE_ALREADY_USED');
        if (emailSnap.exists && emailSnap.data()?.uid !== uid) throw new Error('FREE_MARKETPLACE_EMAIL_ALREADY_USED');
        if (adSnap.exists && adSnap.data()?.sellerId !== uid) throw new Error('AD_OWNERSHIP_MISMATCH');

        tx.set(adRef, {
          ...adData,
          marketplaceListingType: 'free_first',
          marketplaceFreeBenefitConsumed: true,
          marketplaceListingFee: 0,
        }, { merge: true });
        tx.set(userRef, {
          marketplaceFreeListingUsed: true,
          marketplaceFreeListingUsedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(phoneRef, { uid, createdAt: FieldValue.serverTimestamp() }, { merge: false });
        tx.set(emailRef, { uid, createdAt: FieldValue.serverTimestamp() }, { merge: false });
      });

      return res.status(200).json({ success: true, adId, marketplaceListingType: 'free_first' });
    }

    if (isMarketplace) {
      const userSnap = await db.collection('users').doc(uid).get();
      const freeUsed = userSnap.exists && userSnap.data()?.marketplaceFreeListingUsed === true;
      if (!freeUsed) {
        return res.status(409).json({
          success: false,
          error: 'FIRST_MARKETPLACE_LISTING_IS_FREE',
          errorMessage: 'Your first Marketplace listing is free. Refresh your profile and try again.',
        });
      }
      adData.marketplaceListingType = 'paid_additional';
      adData.marketplaceFreeBenefitConsumed = false;
      adData.marketplaceListingFee = Number(settings?.planPrices?.marketplaceAdditional ?? 1.99);
    }

    await adRef.set(adData, { merge: true });
    return res.status(200).json({ success: true, adId, marketplaceListingType: adData.marketplaceListingType || null });
  } catch (error: any) {
    const code = String(error?.message || '');
    if (code === 'FREE_MARKETPLACE_LISTING_ALREADY_USED') {
      return res.status(409).json({ success: false, error: code, errorMessage: 'Your one-time free Marketplace listing has already been used. Additional listings are charged at the current Marketplace listing fee.' });
    }
    if (code === 'FREE_MARKETPLACE_PHONE_ALREADY_USED' || code === 'FREE_MARKETPLACE_EMAIL_ALREADY_USED') {
      return res.status(409).json({ success: false, error: code, errorMessage: 'This phone number or email has already been used for a free Marketplace listing on another account.' });
    }
    console.error('[Listing Save API]', error);
    return res.status(500).json({ success: false, error: 'SAVE_FAILED', errorMessage: error?.message || 'Unable to save listing.' });
  }
}
