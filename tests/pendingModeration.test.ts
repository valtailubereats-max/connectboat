import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { shouldNotifyPendingModeration } from '../src/utils/pendingModeration';

const createAdSource = readFileSync(new URL('../src/pages/CreateAd.tsx', import.meta.url), 'utf8');
const firestoreRules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

test('new listing submitted as Pending notifies moderation', () => {
  assert.equal(shouldNotifyPendingModeration({
    isExistingListing: false,
    previousStatus: null,
    nextStatus: 'pending',
    isStaffEdit: false,
  }), true);
});

test('owner edit transitioning Approved to Pending notifies moderation', () => {
  assert.equal(shouldNotifyPendingModeration({
    isExistingListing: true,
    previousStatus: 'approved',
    nextStatus: 'pending',
    isStaffEdit: false,
  }), true);
});

test('editing an already Pending listing does not notify again', () => {
  assert.equal(shouldNotifyPendingModeration({
    isExistingListing: true,
    previousStatus: 'pending',
    nextStatus: 'pending',
    isStaffEdit: false,
  }), false);
});

test('administrative edit does not trigger a moderation notification', () => {
  assert.equal(shouldNotifyPendingModeration({
    isExistingListing: true,
    previousStatus: 'approved',
    nextStatus: 'pending',
    isStaffEdit: true,
  }), false);
});

test('CreateAd uses the transition decision and Firestore permits only Approved to Pending', () => {
  assert.match(createAdSource, /if \(shouldNotifyModeration\)/);
  assert.match(
    firestoreRules,
    /resource\.data\.status == 'approved' && request\.resource\.data\.status == 'pending'/
  );
  assert.doesNotMatch(
    firestoreRules,
    /resource\.data\.status == 'pending' && request\.resource\.data\.status == 'approved'/
  );
});
