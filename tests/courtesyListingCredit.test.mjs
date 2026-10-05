import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/stripe/create-checkout-session.ts', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const createAd = readFileSync(new URL('../src/pages/CreateAd.tsx', import.meta.url), 'utf8');
const adminAds = readFileSync(new URL('../src/pages/AdminAds.tsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/pages/Profile.tsx', import.meta.url), 'utf8');
const paymentUtils = readFileSync(new URL('../src/utils/paymentUtils.ts', import.meta.url), 'utf8');

test('courtesy lifecycle reuses the consolidated checkout endpoint', () => {
  for (const action of ['grant', 'get', 'consume', 'revoke', 'approve']) {
    assert.match(api, new RegExp(`courtesy_credit_${action}`));
  }
  assert.match(api, /advertisingAction\.startsWith\('courtesy_credit_'\)/);
  assert.match(api, /scope: 'eligible_paid_listing'/);
  assert.doesNotMatch(api, /status: 'available', plan: 'premium'/);
});

test('credit consumption is authenticated, transactional and server-owned', () => {
  assert.match(api, /verifyIdToken/);
  assert.match(api, /db\.runTransaction/);
  assert.match(api, /String\(adData\.sellerId \|\| ''\) !== decoded\.uid/);
  assert.match(api, /creditData\.status !== 'available'/);
  assert.match(api, /paymentStatus: 'courtesy'/);
  assert.match(api, /amountPaid: 0/);
});

test('boat approval keeps the original exact 30-day Premium benefit', () => {
  assert.match(api, /const durationDays = isBoatListing[\s\S]*?\? 30/);
  assert.match(api, /featuredLevel: isBoatListing \? 'premium'/);
  assert.match(api, /isBoatListing \? \{ plan: 'premium', planType: 'premium' \}/);
  assert.match(api, /planStartedAt: FieldValue\.serverTimestamp\(\)/);
  assert.match(api, /planExpiresAt: expiresAt/);
  assert.match(adminAds, /courtesy_credit_approve/);
});

test('browser clients cannot write courtesy credit records or courtesy ad fields', () => {
  assert.match(rules, /function courtesyAdFields\(\)/);
  assert.match(rules, /match \/courtesyListingCredits\/\{userId\}[\s\S]*?allow read, write: if false/);
  assert.match(api, /delete adData\[key\]/);
});

test('eligible paid categories bypass Stripe through one shared courtesy decision', () => {
  assert.match(createAd, /courtesyCredit\?\.status === 'available'/);
  assert.match(createAd, /getCourtesyEligibleAmount/);
  assert.match(createAd, /isPaidBoatListingCategory\(formData\.category\)/);
  assert.match(createAd, /isBoatServiceCategory\(formData\.category\)/);
  assert.match(createAd, /isMarketplaceListingCategory\(formData\.category\)/);
  assert.match(createAd, /executeSaveAd\(adData, adId, true\)/);
});

test('Marketplace first-free and partner-funded listings do not consume courtesy', () => {
  assert.match(createAd, /!hasMarketplaceFreeBenefit\(\) && !partnerVoucher/);
  assert.match(api, /userData\.marketplaceFreeListingUsed === true/);
  assert.match(api, /adData\.marketplaceListingType === 'paid_additional'/);
  assert.match(api, /adData\.marketplaceFreeBenefitConsumed !== true/);
  assert.match(api, /!isPartnerFunded/);
});

test('paid Marketplace courtesy stays Marketplace and never becomes Premium', () => {
  assert.match(api, /paymentProductType = 'marketplace_additional'/);
  assert.match(api, /\.\.\.\(isBoatListing \? \{ plan: 'premium', planType: 'premium' \} : \{\}\)/);
  assert.match(api, /\.\.\.\(isBoatListing \? \{ plan: 'premium', planType: 'premium' \} : \{ planType: plan \}\)/);
  assert.match(api, /amountPaid: 0, isCourtesy: true/);
});

test('free categories and Boat Services Basic leave the credit available', () => {
  assert.match(createAd, /return activePlan === 'featured' \|\| activePlan === 'premium'[\s\S]*?: 0/);
  assert.match(createAd, /return 0;[\s\S]*?hasCourtesyForSelectedPlan/);
  assert.match(api, /throw new Error\('COURTESY_CATEGORY_OR_PLAN_NOT_ELIGIBLE'\)/);
});

test('Media Boost remains outside courtesy and existing Stripe calculation is unchanged', () => {
  assert.match(createAd, /formData\.mediaBoostEnabled\) return 0/);
  assert.match(api, /COURTESY_MEDIA_BOOST_NOT_INCLUDED/);
  assert.match(api, /unit_amount: 200/);
  assert.match(api, /stripe\.checkout\.sessions\.create/);
});

test('credit reuse and concurrent consumption are prevented transactionally', () => {
  assert.match(api, /db\.runTransaction\(async tx =>/);
  assert.match(api, /creditData\.status !== 'available'/);
  assert.match(api, /tx\.update\(creditRef, \{ status: 'used'/);
  assert.match(api, /creditData\.status !== 'used' \|\| creditData\.listingId !== adId/);
});

test('courtesy presentation never offers pending payment actions', () => {
  assert.match(paymentUtils, /type: 'courtesy'/);
  assert.match(profile, /paymentInfo\.type === 'courtesy'/);
  assert.match(profile, /paymentInfo\.type !== 'courtesy'/);
  assert.match(adminAds, /getAdPaymentClassification\(ad\)\.type !== 'courtesy'/);
  assert.match(adminAds, /getAdPaymentClassification\(selectedAd\)\.type !== 'courtesy'/);
});

test('live preview and order summary reflect Premium courtesy at zero total', () => {
  assert.match(createAd, /normalizeListingPlan\(formData\.plan\) === 'premium'[\s\S]*?'Premium 👑'/);
  assert.match(createAd, /Courtesy Listing Credit/);
  assert.match(createAd, /hasCourtesyForSelectedPlan\(\)[\s\S]*?'0\.00'/);
  assert.match(createAd, /getCourtesyEligibleAmount\(\)\.toFixed\(2\)/);
});
