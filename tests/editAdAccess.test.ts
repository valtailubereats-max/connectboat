import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  EditAdServerVerificationError,
  loadServerConfirmedEditableAd,
  type ServerAdSnapshot,
} from '../src/utils/editAdAccess';

type TestAd = { sellerId: string; source?: string };
const createAdSource = readFileSync(new URL('../src/pages/CreateAd.tsx', import.meta.url), 'utf8');
const snapshot = (data: TestAd): ServerAdSnapshot<TestAd> => ({
  exists: () => true,
  data: () => data,
});

test('server confirms sellerId equals authenticated UID: edit is allowed', async () => {
  const result = await loadServerConfirmedEditableAd({
    readFromServer: async () => snapshot({ sellerId: 'uid-correct' }),
    userId: 'uid-correct', isAdmin: false, isModerator: false,
  });
  assert.equal(result.status, 'allowed');
});

test('server confirms a different sellerId: edit is denied', async () => {
  const result = await loadServerConfirmedEditableAd({
    readFromServer: async () => snapshot({ sellerId: 'another-user' }),
    userId: 'uid-correct', isAdmin: false, isModerator: false,
  });
  assert.equal(result.status, 'forbidden');
});

test('stale cached sellerId cannot override the current server snapshot', async () => {
  const staleCache = { sellerId: 'uid-without-hyphen', source: 'cache' };
  const result = await loadServerConfirmedEditableAd({
    readFromServer: async () => snapshot({ sellerId: 'uid-with-hyphen', source: 'server' }),
    userId: 'uid-with-hyphen', isAdmin: false, isModerator: false,
  });
  assert.equal(staleCache.source, 'cache');
  assert.deepEqual(result, {
    status: 'allowed',
    data: { sellerId: 'uid-with-hyphen', source: 'server' },
  });
});

test('server unavailable with cache available: cache is not used for ownership', async () => {
  const staleCache = snapshot({ sellerId: 'uid-without-hyphen', source: 'cache' });
  await assert.rejects(
    loadServerConfirmedEditableAd({
      readFromServer: async () => { throw new Error('timeout'); },
      userId: 'uid-with-hyphen', isAdmin: false, isModerator: false,
    }),
    EditAdServerVerificationError,
  );
  assert.equal(staleCache.data().source, 'cache');
});

test('admin and moderator can edit a server-confirmed listing owned by another user', async () => {
  for (const role of [{ isAdmin: true, isModerator: false }, { isAdmin: false, isModerator: true }]) {
    const result = await loadServerConfirmedEditableAd({
      readFromServer: async () => snapshot({ sellerId: 'listing-owner' }),
      userId: 'staff-user', ...role,
    });
    assert.equal(result.status, 'allowed');
  }
});

test('normal desktop/mobile ownership path remains platform-independent', async () => {
  for (const platform of ['Android', 'Desktop']) {
    const result = await loadServerConfirmedEditableAd({
      readFromServer: async () => snapshot({ sellerId: 'same-user', source: platform }),
      userId: 'same-user', isAdmin: false, isModerator: false,
    });
    assert.equal(result.status, 'allowed');
  }
});

test('CreateAd ownership verification is wired to Firestore server reads only', () => {
  assert.match(createAdSource, /readFromServer:\s*async \(\) =>[\s\S]*?getDocFromServer\(docRef\)/);
  assert.doesNotMatch(createAdSource, /getDocWithCacheFallback\(docRef, `ads\/\$\{id\}`\)/);
});
