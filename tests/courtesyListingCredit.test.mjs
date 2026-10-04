import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/stripe/create-checkout-session.ts', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const createAd = readFileSync(new URL('../src/pages/CreateAd.tsx', import.meta.url), 'utf8');
const adminAds = readFileSync(new URL('../src/pages/AdminAds.tsx', import.meta.url), 'utf8');

test('courtesy lifecycle reuses the consolidated checkout endpoint', () => {
  for (const action of ['grant', 'get', 'consume', 'revoke', 'approve']) {
    assert.match(api, new RegExp(`courtesy_credit_${action}`));
  }
  assert.match(api, /advertisingAction\.startsWith\('courtesy_credit_'\)/);
});

test('credit consumption is authenticated, transactional and server-owned', () => {
  assert.match(api, /verifyIdToken/);
  assert.match(api, /db\.runTransaction/);
  assert.match(api, /String\(adData\.sellerId \|\| ''\) !== decoded\.uid/);
  assert.match(api, /creditData\.status !== 'available'/);
  assert.match(api, /paymentStatus: 'courtesy'/);
  assert.match(api, /amountPaid: 0/);
});

test('approval starts an exact 30-day Premium period', () => {
  assert.match(api, /Date\.now\(\) \+ 30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(api, /featuredLevel: 'premium'/);
  assert.match(api, /planStartedAt: FieldValue\.serverTimestamp\(\)/);
  assert.match(api, /planExpiresAt: expiresAt/);
  assert.match(adminAds, /courtesy_credit_approve/);
});

test('browser clients cannot write courtesy credit records or courtesy ad fields', () => {
  assert.match(rules, /function courtesyAdFields\(\)/);
  assert.match(rules, /match \/courtesyListingCredits\/\{userId\}[\s\S]*?allow read, write: if false/);
  assert.match(api, /delete adData\[key\]/);
});

test('eligible users bypass Stripe only for a Premium listing without Media Boost', () => {
  assert.match(createAd, /courtesyCredit\?\.status === 'available'/);
  assert.match(createAd, /normalizeListingPlan\(formData\.plan\) === 'premium'/);
  assert.match(createAd, /!formData\.mediaBoostEnabled/);
  assert.match(createAd, /executeSaveAd\(adData, adId, true\)/);
});
