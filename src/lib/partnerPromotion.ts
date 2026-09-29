export type ListingPromotionSource = 'first_free_listing' | 'partner_promotion' | null;

export interface PartnerPromotionDecision {
  acquisitionSource: 'partner' | null;
  promotionSource: ListingPromotionSource;
  partnerAttributionOnly: boolean;
  partnerFundsStandard: boolean;
}

export function normalisePartnerCode(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function resolvePartnerPromotion(input: {
  hasValidPartnerVoucher: boolean;
  isFirstMarketplaceListingFree: boolean;
  isPaidBoatListing: boolean;
  isPaidMarketplaceListing?: boolean;
  plan: unknown;
}): PartnerPromotionDecision {
  const standardPlan = ['standard', 'free'].includes(String(input.plan || 'standard').toLowerCase());
  const partnerCanFundStandard = input.hasValidPartnerVoucher && standardPlan;

  if (input.isFirstMarketplaceListingFree) {
    return {
      acquisitionSource: input.hasValidPartnerVoucher ? 'partner' : null,
      promotionSource: 'first_free_listing',
      partnerAttributionOnly: input.hasValidPartnerVoucher,
      partnerFundsStandard: false,
    };
  }

  if ((input.isPaidBoatListing || input.isPaidMarketplaceListing) && partnerCanFundStandard) {
    return {
      acquisitionSource: 'partner',
      promotionSource: 'partner_promotion',
      partnerAttributionOnly: false,
      partnerFundsStandard: true,
    };
  }

  return {
    acquisitionSource: input.hasValidPartnerVoucher ? 'partner' : null,
    promotionSource: null,
    partnerAttributionOnly: input.hasValidPartnerVoucher,
    partnerFundsStandard: false,
  };
}
