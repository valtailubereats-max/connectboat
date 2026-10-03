import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const firestoreRules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const storageRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
const createAd = readFileSync(new URL('../src/pages/CreateAd.tsx', import.meta.url), 'utf8');

test('Firestore accepts the current Standard, Featured and Premium boat-listing photo limits', () => {
  assert.match(firestoreRules, /isBoatListing && \([\s\S]+?premium[^\n]+imagesList\.size\(\) <= 25/);
  assert.match(firestoreRules, /isBoatListing && \([\s\S]+?featured[^\n]+imagesList\.size\(\) <= 15/);
  assert.match(firestoreRules, /isBoatListing && \([\s\S]+?standard[^\n]+imagesList\.size\(\) <= 8/);
  assert.match(firestoreRules, /isBoatService && \([\s\S]+?imagesList\.size\(\) <= 10/);
  assert.match(firestoreRules, /!isBoatListing && !isBoatService && imagesList\.size\(\) <= 3/);
});

test('an owner may edit an approved listing without changing its approval status', () => {
  assert.match(firestoreRules, /request\.resource\.data\.status == resource\.data\.status/);
  assert.match(firestoreRules, /resource\.data\.status in \['pending', 'approved'\]/);
});

test('payment, plan and privilege fields remain protected from owner edits', () => {
  for (const field of [
    'sellerId',
    'plan',
    'isFeatured',
    'expirationDate',
    'paymentStatus',
    'stripeCheckoutSessionId',
    'videoPaid'
  ]) {
    assert.match(firestoreRules, new RegExp(`'${field}'`));
  }
  assert.match(firestoreRules, /hasAny\(protectedAdFields\(\)\)/);
});

test('listing photos stay editable while other locked Featured fields remain guarded', () => {
  assert.doesNotMatch(
    createAd,
    /JSON\.stringify\(formData\.images\) !== JSON\.stringify\(originalAd\.images\)/
  );
  assert.match(createAd, /formData\.title !== originalAd\.title/);
  assert.match(createAd, /formData\.plan !== originalAd\.plan/);
});

test('new Storage uploads are owner-scoped images with the same 5 MB client limit', () => {
  assert.match(storageRules, /match \/ads\/\{userId\}\/\{allPaths=\*\*\}/);
  assert.match(storageRules, /request\.auth\.uid == userId/);
  assert.match(storageRules, /request\.resource\.size <= 5 \* 1024 \* 1024/);
  assert.match(storageRules, /request\.resource\.contentType\.matches\('image\/\.\*'\)/);
  assert.match(createAd, /`ads\/\$\{user\.uid\}\/\$\{fileName\}`/);
});

test('iPad extensionless photos send explicit image metadata to Storage', () => {
  assert.match(createAd, /compressedBlob\.type, file\.type/);
  assert.match(createAd, /startsWith\('image\/'\)/);
  assert.match(createAd, /\|\| 'image\/jpeg'/);
  assert.match(
    createAd,
    /uploadBytes\(imageRef, compressedBlob, \{ contentType \}\)/
  );
});
