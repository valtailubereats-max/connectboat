import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Request } from 'express';

const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
export const BROKER_TIERS = [5, 10, 20, 30, 35] as const;

export function brokerDb(): Firestore {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing.');
    const account = JSON.parse(raw);
    if (typeof account.private_key === 'string') account.private_key = account.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(account), storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'navlink-489413.firebasestorage.app' });
  }
  return getFirestore(getApp(), DATABASE_ID);
}

export async function brokerIdentity(req: Request) {
  brokerDb();
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('UNAUTHENTICATED');
  const token = await getAuth(getApp()).verifyIdToken(match[1]);
  const user = await brokerDb().collection('users').doc(token.uid).get();
  const email = String(token.email || '').toLowerCase();
  return { uid: token.uid, email, isAdmin: user.data()?.role === 'admin' || ['valtailubereats@gmail.com', 'valtail@gmail.com', 'generalsales2021@gmail.com'].includes(email), isModerator: user.data()?.role === 'moderator' };
}

export function isEligibleBrokerAd(ad: Record<string, any>) {
  return (ad.category === 'Boats for Sale' || ad.category === 'Boats for Hire') &&
    ad.status === 'approved' && ad.paymentStatus === 'paid' &&
    Number(ad.amountPaid) > 0 &&
    ad.paymentProductType === 'boat_listing' && ad.brokerPaymentVerified === true;
}

export function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(key: string) {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(Date.UTC(year, month, 1)));
}

function previousMonth(key: string) {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(Date.UTC(year, month - 2, 1)));
}

function monthAfter(date: Date, count: number) {
  return monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1)));
}

export async function eligibleAds(db: Firestore, uid: string) {
  const [ads, recorded] = await Promise.all([
    db.collection('ads').where('sellerId', '==', uid).get(),
    db.collection('brokerEligibleAds').where('sellerId', '==', uid).get(),
  ]);
  const byId = new Map(recorded.docs.map(doc => [doc.id, doc.data()]));
  for (const doc of ads.docs) {
    if (isEligibleBrokerAd(doc.data()) && !byId.has(doc.id)) {
      const item = { sellerId: uid, category: doc.data().category, paidAt: doc.data().paidAt, approvedAt: new Date(), adId: doc.id };
      const ledgerRef = db.collection('brokerEligibleAds').doc(doc.id);
      try { await ledgerRef.create(item); byId.set(doc.id, item); }
      catch (error: any) {
        if (error.code !== 6) throw error;
        const saved = await ledgerRef.get();
        if (saved.exists) byId.set(doc.id, saved.data() || item);
      }
    }
  }
  return [...byId.values()];
}

function paidDate(ad: Record<string, any>): Date | null {
  // The listing qualifies only once both payment and moderation are complete.
  const value = ad.approvedAt || ad.paidAt || ad.paidDate || ad.createdAt;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function adMonth(ad: Record<string, any>): string | null {
  const date = paidDate(ad);
  return date ? monthKey(date) : null;
}

export async function getBrokerState(db: Firestore, uid: string, now = new Date()) {
  const ref = db.collection('brokerProfiles').doc(uid);
  const snap = await ref.get();
  const profile = snap.data();
  if (!profile || profile.status !== 'active') return { profile: profile || null, ads: [], currentDiscount: 0, currentMonthCount: 0, total: 0 };
  const activation = profile.activatedAt?.toDate?.() || new Date(profile.activatedAt);
  const ads = (await eligibleAds(db, uid)).filter(ad => (paidDate(ad)?.getTime() || 0) >= activation.getTime());
  const currentMonth = monthKey(now);
  const targetMonth = new Date(Date.UTC(activation.getUTCFullYear(), activation.getUTCMonth() + 6, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const anniversary = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(activation.getUTCDate(), lastDay)));
  const firstFullMonth = anniversary.getUTCDate() === 1 ? monthKey(anniversary) : nextMonth(monthKey(anniversary));
  const firstReview = nextMonth(firstFullMonth);
  let discount = Number(profile.initialTier || 5);
  const initialAds = ads.filter(ad => (paidDate(ad)?.getTime() || 0) < anniversary.getTime())
    .sort((a, b) => (paidDate(a)?.getTime() || 0) - (paidDate(b)?.getTime() || 0));
  const initialCount = initialAds.length;
  const history: Array<{ month: string; from: number; to: number; qualifyingListings: number; phase: 'initial' | 'monthly' }> = [];
  let initialTier = Number(profile.initialTier || 5);
  initialAds.forEach((ad, index) => {
    const count = index + 1;
    const after = Math.max(Number(profile.initialTier || 5), count >= 30 ? 30 : count >= 10 ? 20 : count >= 5 ? 10 : 5);
    if (after !== initialTier) history.push({ month: adMonth(ad) || monthKey(activation), from: initialTier, to: after, qualifyingListings: count, phase: 'initial' });
    initialTier = after;
  });
  if (currentMonth < firstReview) {
    discount = initialCount >= 30 ? 30 : initialCount >= 10 ? 20 : initialCount >= 5 ? 10 : 5;
    discount = Math.max(discount, Number(profile.initialTier || 5));
  } else {
    const base = initialCount >= 30 ? 30 : initialCount >= 10 ? 20 : initialCount >= 5 ? 10 : 5;
    discount = Math.max(base, Number(profile.initialTier || 5));
    const referralUnlockedAt = await getReferralUnlockedAt(db, uid);
    for (let key = firstReview; key <= currentMonth; key = nextMonth(key)) {
      const previous = previousMonth(key);
      const count = ads.filter(ad => adMonth(ad) === previous).length;
      const tiers = referralUnlockedAt && referralUnlockedAt <= new Date(`${key}-01T00:00:00Z`) ? BROKER_TIERS : BROKER_TIERS.slice(0, 4);
      const index = tiers.indexOf(discount as any);
      const before = discount;
      discount = tiers[Math.max(0, Math.min(tiers.length - 1, index + (count >= 5 ? 1 : -1)))];
      if (before !== discount) history.push({ month: key, from: before, to: discount, qualifyingListings: count, phase: 'monthly' });
    }
  }
  return { profile, ads, currentDiscount: discount, currentMonthCount: ads.filter(ad => adMonth(ad) === currentMonth).length, total: ads.length, nextReview: currentMonth < firstReview ? firstReview : nextMonth(currentMonth), history };
}

export async function getReferralUnlockedAt(db: Firestore, uid: string): Promise<Date | null> {
  const snap = await db.collection('brokerProfiles').where('referredBy', '==', uid).get();
  let earliest: Date | null = null;
  for (const doc of snap.docs) {
    if (doc.id === uid || doc.data().status !== 'active') continue;
    const activated = doc.data().activatedAt?.toDate?.() || new Date(doc.data().activatedAt);
    const ads = (await eligibleAds(db, doc.id)).filter(ad => (paidDate(ad)?.getTime() || 0) >= activated.getTime());
    for (const ad of ads) {
      const date = ad.approvedAt?.toDate?.() || new Date(ad.approvedAt || ad.paidAt);
      if (Number.isFinite(date.getTime()) && (!earliest || date < earliest)) earliest = date;
    }
  }
  return earliest;
}

export async function hasValidBrokerReferral(db: Firestore, uid: string) {
  return !!(await getReferralUnlockedAt(db, uid));
}

export function brokerMoney(baseCents: number, discount: number) {
  const reduction = Math.round(baseCents * discount / 100);
  return { normalPriceCents: baseCents, discountPercent: discount, discountCents: reduction, finalPriceCents: baseCents - reduction };
}
