import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdPaymentClassification } from '../src/utils/paymentUtils.ts';

const baseAd: any = {
  id: 'ad-1', title: 'Boat', description: 'Boat', imageUrl: '', city: 'London',
  category: 'Boats for Sale', sellerId: 'user-1', sellerPhone: '', sellerName: 'Seller',
  status: 'pending', createdAt: new Date(), plan: 'premium',
};

test('Premium courtesy is classified as Courtesy and keeps the Premium plan', () => {
  const result = getAdPaymentClassification({ ...baseAd, paymentStatus: 'courtesy', isCourtesy: true });
  assert.equal(result.type, 'courtesy');
  assert.equal(result.isPaid, false);
  assert.equal(result.badgeLabel, 'Courtesy');
  assert.equal(result.planLabel, 'Premium');
});

test('paid Marketplace courtesy is labelled Marketplace even when the non-tiered stored plan is free', () => {
  const result = getAdPaymentClassification({
    ...baseAd,
    category: 'Trailers',
    plan: 'free',
    marketplaceListingType: 'paid_additional',
    paymentProductType: 'marketplace_additional',
    paymentStatus: 'courtesy',
    isCourtesy: true,
    amountPaid: 0,
  });
  assert.equal(result.type, 'courtesy');
  assert.equal(result.planLabel, 'Marketplace');
});

test('confirmed Stripe payment remains classified as paid', () => {
  const result = getAdPaymentClassification({ ...baseAd, paymentStatus: 'paid', paidAt: new Date() });
  assert.equal(result.type, 'paid');
  assert.equal(result.isPaid, true);
  assert.equal(result.planLabel, 'Premium');
});

test('legacy administrative plan courtesy does not replace confirmed Stripe payment classification', () => {
  const result = getAdPaymentClassification({ ...baseAd, isCourtesy: true, paymentStatus: 'paid', paidAt: new Date() });
  assert.equal(result.type, 'paid');
  assert.equal(result.isPaid, true);
});
