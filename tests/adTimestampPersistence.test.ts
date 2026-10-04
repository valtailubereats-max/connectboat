import assert from 'node:assert/strict';
import test from 'node:test';
import { serverTimestamp as firestoreServerTimestamp } from 'firebase/firestore';
import {
  InvalidLegacyCreatedAtError,
  isServerTimestampSentinel,
  prepareAdPayloadForClientWrite,
  prepareAdPayloadForTransport,
} from '../src/utils/adTimestampPersistence.ts';
import { prepareServerAdTimestampFields } from '../src/server/adTimestampPersistence.ts';

class FakeTimestamp {
  constructor(readonly iso: string) {}
  toDate() { return new Date(this.iso); }
  toMillis() { return this.toDate().getTime(); }
}

class FakeServerTimestamp {
  readonly _methodName = 'serverTimestamp';
}

const adapter = {
  serverTimestamp: () => new FakeServerTimestamp(),
  fromDate: (date: Date) => new FakeTimestamp(date.toISOString()),
  isTimestamp: (value: unknown) => value instanceof FakeTimestamp,
};

test('Firebase Client SDK sentinel is never allowed to cross JSON as a plain map', () => {
  const sentinel = firestoreServerTimestamp();
  assert.equal(JSON.stringify(sentinel), '{"_methodName":"serverTimestamp"}');

  const transported = prepareAdPayloadForTransport({
    createdAt: sentinel,
    updatedAt: sentinel,
  }, { isExisting: false });

  assert.equal('createdAt' in transported, false);
  assert.equal('updatedAt' in transported, false);
  assert.equal(JSON.stringify(transported).includes('_methodName'), false);
});

test('new listing injects real write sentinels only at the final client write', () => {
  const statePayload = { title: 'New boat', plan: 'standard' };
  const writePayload = prepareAdPayloadForClientWrite(statePayload, {
    isExisting: false,
    serverTimestamp: adapter.serverTimestamp,
  });

  assert.equal('createdAt' in statePayload, false);
  assert.ok(writePayload.createdAt instanceof FakeServerTimestamp);
  assert.ok(writePayload.updatedAt instanceof FakeServerTimestamp);
  assert.notEqual(writePayload.createdAt.constructor, Object);
});

test('editing a listing preserves a valid existing createdAt Timestamp', () => {
  const createdAt = new FakeTimestamp('2026-01-02T03:04:05.000Z');
  const writePayload = prepareAdPayloadForClientWrite({ title: 'Edited' }, {
    isExisting: true,
    existingCreatedAt: createdAt,
    serverTimestamp: adapter.serverTimestamp,
  });

  assert.equal(writePayload.createdAt, createdAt);
  assert.ok(writePayload.updatedAt instanceof FakeServerTimestamp);
});

test('editing a legacy listing never resends a serialized serverTimestamp map', () => {
  const invalidCreatedAt = { _methodName: 'serverTimestamp' };
  assert.throws(
    () => prepareAdPayloadForClientWrite({ createdAt: invalidCreatedAt }, {
      isExisting: true,
      existingCreatedAt: invalidCreatedAt,
      serverTimestamp: adapter.serverTimestamp,
    }),
    InvalidLegacyCreatedAtError,
  );
  assert.throws(
    () => prepareAdPayloadForTransport({ title: 'Legacy' }, {
      isExisting: true,
      existingCreatedAt: invalidCreatedAt,
    }),
    InvalidLegacyCreatedAtError,
  );
  assert.throws(
    () => prepareServerAdTimestampFields(
      { title: 'Legacy' },
      { createdAt: invalidCreatedAt },
      adapter,
    ),
    InvalidLegacyCreatedAtError,
  );
});

test('JSON transport strips sentinels and server reconstructs timestamps before write', () => {
  const browserSentinel = { _methodName: 'serverTimestamp' };
  const transported = prepareAdPayloadForTransport({
    title: 'Featured boat',
    plan: 'featured',
    createdAt: browserSentinel,
    updatedAt: browserSentinel,
    activatedAt: browserSentinel,
  }, { isExisting: false });

  assert.equal('createdAt' in transported, false);
  assert.equal('updatedAt' in transported, false);
  assert.equal('activatedAt' in transported, false);

  const serverPayload = prepareServerAdTimestampFields(transported, null, adapter);
  assert.ok(serverPayload.createdAt instanceof FakeServerTimestamp);
  assert.ok(serverPayload.updatedAt instanceof FakeServerTimestamp);
  assert.equal(isServerTimestampSentinel(serverPayload.createdAt), true);
});

test('Standard, Featured and Premium plan values are unchanged', () => {
  for (const plan of ['standard', 'featured', 'premium']) {
    const prepared = prepareServerAdTimestampFields({ title: plan, plan }, null, adapter);
    assert.equal(prepared.plan, plan);
    assert.ok(prepared.createdAt instanceof FakeServerTimestamp);
    assert.ok(prepared.updatedAt instanceof FakeServerTimestamp);
  }
});
