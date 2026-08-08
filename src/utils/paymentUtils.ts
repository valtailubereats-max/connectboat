import { Ad } from '../types';
import { format } from 'date-fns';

/**
 * Checks if an ad has real confirmed payment evidence.
 * Exact same rule across Admin and My Listings.
 */
export const isPaidAd = (ad: Ad): boolean => {
  if (!ad) return false;
  return Boolean(
    ad.paidAt ||
    (ad as any).paymentCompletedAt ||
    (ad as any).paymentStatus === 'paid' ||
    (ad as any).paymentStatus === 'completed'
  );
};

/**
 * Formats date into UK standard format dd/MM/yyyy
 */
export const formatUKDate = (dateVal: any): string | null => {
  if (!dateVal) return null;
  try {
    let dateObj: Date | null = null;
    if (typeof dateVal?.toDate === 'function') {
      dateObj = dateVal.toDate();
    } else if (dateVal instanceof Date) {
      dateObj = dateVal;
    } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
      dateObj = new Date(dateVal);
    }
    if (dateObj && !isNaN(dateObj.getTime())) {
      return format(dateObj, 'dd/MM/yyyy');
    }
  } catch (e) {
    console.error('Error formatting UK date:', e);
  }
  return null;
};

/**
 * Formats date and time into UK standard format dd/MM/yyyy HH:mm
 */
export const formatUKDateTime = (dateVal: any): string | null => {
  if (!dateVal) return null;
  try {
    let dateObj: Date | null = null;
    if (typeof dateVal?.toDate === 'function') {
      dateObj = dateVal.toDate();
    } else if (dateVal instanceof Date) {
      dateObj = dateVal;
    } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
      dateObj = new Date(dateVal);
    }
    if (dateObj && !isNaN(dateObj.getTime())) {
      return format(dateObj, 'dd/MM/yyyy HH:mm');
    }
  } catch (e) {
    console.error('Error formatting UK datetime:', e);
  }
  return null;
};

/**
 * Normalizes and formats the listing plan label: Standard, Featured, Premium, etc.
 */
export const getAdPlanLabel = (ad: Ad): { label: string; color: string } => {
  if (!ad) return { label: 'Standard', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  const plan = (ad.plan || '').toLowerCase();
  if (plan === 'premium') {
    return { label: 'Premium', color: 'bg-purple-100 text-purple-800 border-purple-200' };
  }
  if (plan === 'featured' || plan === 'national' || plan === 'local' || ad.isFeatured) {
    return { label: 'Featured', color: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  if (plan === 'standard' || plan === 'basic') {
    return { label: 'Standard', color: 'bg-blue-100 text-blue-800 border-blue-200' };
  }
  if (ad.isPermanentFeatured) {
    return { label: 'Permanent Featured', color: 'bg-purple-100 text-purple-800 border-purple-200' };
  }
  if (ad.plan) {
    const capitalized = ad.plan.charAt(0).toUpperCase() + ad.plan.slice(1);
    return { label: capitalized, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
  return { label: 'Standard', color: 'bg-slate-100 text-slate-700 border-slate-200' };
};

export type PaymentStatusType = 'paid' | 'legacy_free' | 'unavailable';

export interface PaymentClassification {
  isPaid: boolean;
  type: PaymentStatusType;
  badgeLabel: string; // 'Paid' | 'Legacy / Free Listing' | 'Payment data unavailable'
  planLabel: string;  // 'Standard' | 'Featured' | 'Premium' | etc.
  formattedDate: string | null; // UK date e.g. '08/08/2026'
}

/**
 * Full payment classification for an ad.
 * Evaluates real payment evidence first. If missing, distinguishes between
 * Legacy/Free Listing (donations, legacy free era, demo/imported, standard with no checkout session)
 * and Payment data unavailable (paid plan intended or checkout session present, but unconfirmed).
 */
export const getAdPaymentClassification = (ad: Ad): PaymentClassification => {
  const isPaid = isPaidAd(ad);
  const planObj = getAdPlanLabel(ad);
  const formattedDate = formatUKDate(ad.paidAt || (ad as any).paymentCompletedAt);

  if (isPaid) {
    return {
      isPaid: true,
      type: 'paid',
      badgeLabel: 'Paid',
      planLabel: planObj.label,
      formattedDate: formattedDate || 'N/A',
    };
  }

  const planStr = (ad.plan || '').toLowerCase();
  const isDonationCategory = ad.category === '💚 Doações & Solidariedade';
  const isFreePlanOrFlag =
    planStr === 'free' ||
    planStr === 'legacy' ||
    Boolean((ad as any).isFree) ||
    Boolean((ad as any).isLegacy) ||
    Boolean((ad as any).isFreeListing);
  const isImportedOrDemo =
    Boolean(ad.demoListing) ||
    Boolean(ad.importedBy) ||
    ad.listingMode === 'claimable' ||
    Boolean(ad.externalListing);
  const isStandardWithoutStripe =
    !ad.stripeCheckoutSessionId &&
    (!ad.plan || planStr === 'standard' || planStr === 'free');

  if (isDonationCategory || isFreePlanOrFlag || isImportedOrDemo || isStandardWithoutStripe) {
    return {
      isPaid: false,
      type: 'legacy_free',
      badgeLabel: 'Legacy / Free Listing',
      planLabel: isDonationCategory ? 'Free Donation' : (planObj.label || 'Standard'),
      formattedDate: null,
    };
  }

  return {
    isPaid: false,
    type: 'unavailable',
    badgeLabel: 'Payment data unavailable',
    planLabel: planObj.label || 'Standard',
    formattedDate: null,
  };
};
