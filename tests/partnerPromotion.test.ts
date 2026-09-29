import assert from 'node:assert/strict';
import test from 'node:test';
import { normalisePartnerCode, resolvePartnerPromotion } from '../src/lib/partnerPromotion.js';

test('normalises partner voucher codes', () => {
  assert.equal(normalisePartnerCode(' boat jumble! '), 'BOATJUMBLE');
});

test('voucher funds Standard for Boats for Sale and Hire', () => {
  for (const category of ['Boats for Sale', 'Boats for Hire']) {
    const decision = resolvePartnerPromotion({
      hasValidPartnerVoucher: true,
      isFirstMarketplaceListingFree: false,
      isPaidBoatListing: category.startsWith('Boats for'),
      plan: 'standard',
    });
    assert.equal(decision.promotionSource, 'partner_promotion');
    assert.equal(decision.partnerFundsStandard, true);
    assert.equal(decision.partnerAttributionOnly, false);
  }
});

test('first free listing wins while the voucher remains attribution', () => {
  const decision = resolvePartnerPromotion({
    hasValidPartnerVoucher: true,
    isFirstMarketplaceListingFree: true,
    isPaidBoatListing: false,
    plan: 'free',
  });
  assert.deepEqual(decision, {
    acquisitionSource: 'partner',
    promotionSource: 'first_free_listing',
    partnerAttributionOnly: true,
    partnerFundsStandard: false,
  });
});

test('first free listing is unchanged without a voucher', () => {
  const decision = resolvePartnerPromotion({
    hasValidPartnerVoucher: false,
    isFirstMarketplaceListingFree: true,
    isPaidBoatListing: false,
    plan: 'free',
  });
  assert.equal(decision.promotionSource, 'first_free_listing');
  assert.equal(decision.acquisitionSource, null);
});

test('voucher can fund Standard after first-free has been consumed', () => {
  const decision = resolvePartnerPromotion({
    hasValidPartnerVoucher: true,
    isFirstMarketplaceListingFree: false,
    isPaidBoatListing: false,
    isPaidMarketplaceListing: true,
    plan: 'standard',
  });
  assert.equal(decision.promotionSource, 'partner_promotion');
  assert.equal(decision.partnerFundsStandard, true);
});

test('voucher never funds Featured or Premium', () => {
  for (const plan of ['featured', 'premium']) {
    const decision = resolvePartnerPromotion({
      hasValidPartnerVoucher: true,
      isFirstMarketplaceListingFree: false,
      isPaidBoatListing: true,
      plan,
    });
    assert.equal(decision.partnerFundsStandard, false);
    assert.equal(decision.promotionSource, null);
  }
});
