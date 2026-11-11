import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGA4MeasurementPayload,
  isConfirmedGBPCheckout,
  isValidGA4Context,
  sendGA4MeasurementEventsOnce,
  updateGA4ConsentState,
} from '../src/server/ga4Measurement.ts';

class FakeFirestore {
  records = new Map<string, any>();

  collection(name: string) {
    return {
      doc: (id: string) => {
        const key = `${name}/${id}`;
        return {
          get: async () => ({
            exists: this.records.has(key),
            data: () => this.records.get(key),
          }),
          set: async (value: any) => {
            this.records.set(key, { ...this.records.get(key), ...value });
          },
          key,
        };
      },
    };
  }

  async runTransaction(callback: (transaction: any) => Promise<boolean>) {
    return callback({
      get: async (ref: any) => ({
        exists: this.records.has(ref.key),
        data: () => this.records.get(ref.key),
      }),
      set: (ref: any, value: any) => {
        this.records.set(ref.key, { ...this.records.get(ref.key), ...value });
      },
    });
  }
}

test('validates GA identifiers without accepting personal data as client IDs', () => {
  assert.equal(isValidGA4Context({ clientId: '12345.67890', sessionId: '123456' }), true);
  assert.equal(isValidGA4Context({ clientId: 'person@example.com' }), false);
  assert.equal(isValidGA4Context({ clientId: '12345.67890', sessionId: 'abc' }), false);
});

test('builds privacy-limited purchase payload with GBP transaction fields', () => {
  const payload = buildGA4MeasurementPayload(
    { clientId: '12345.67890', sessionId: '123456' },
    [{ name: 'purchase', params: { transaction_id: 'cs_test_123', value: 7.99, currency: 'GBP' } }]
  );
  assert.equal(payload.events[0].params.currency, 'GBP');
  assert.equal(payload.events[0].params.transaction_id, 'cs_test_123');
  assert.equal(payload.events[0].params.session_id, '123456');
  assert.deepEqual(payload.consent, { ad_user_data: 'DENIED', ad_personalization: 'DENIED' });
  assert.equal('user_id' in payload, false);
});

test('only confirmed, positive GBP payments qualify for purchase measurement', () => {
  assert.equal(isConfirmedGBPCheckout('paid', 799, 'gbp'), true);
  assert.equal(isConfirmedGBPCheckout('unpaid', 799, 'gbp'), false);
  assert.equal(isConfirmedGBPCheckout('no_payment_required', 0, 'gbp'), false);
  assert.equal(isConfirmedGBPCheckout('paid', 799, 'usd'), false);
});

test('a late consent request cannot overwrite a newer refusal', async () => {
  const db = new FakeFirestore();
  assert.equal(await updateGA4ConsentState(db, 'user-1', true, 2000), true);
  assert.equal(await updateGA4ConsentState(db, 'user-1', false, 3000), true);
  assert.equal(await updateGA4ConsentState(db, 'user-1', true, 2500), false);
  assert.equal(db.records.get('ga4AnalyticsConsents/user-1')?.consented, false);
});

test('sends a dispatch only once after Stripe webhook retries', async () => {
  const db = new FakeFirestore();
  let requests = 0;
  const options = {
    db,
    eventKey: 'PURCHASE_cs_test_123',
    context: { clientId: '12345.67890', sessionId: '123456' },
    events: [{ name: 'purchase', params: { transaction_id: 'cs_test_123', value: 7.99, currency: 'GBP' } }],
    apiSecret: 'test-only',
    fetcher: async () => {
      requests += 1;
      return new Response(null, { status: 204 });
    },
  };

  assert.equal(await sendGA4MeasurementEventsOnce(options), true);
  assert.equal(await sendGA4MeasurementEventsOnce(options), false);
  assert.equal(requests, 1);
  assert.equal(db.records.get('ga4MeasurementEvents/PURCHASE_cs_test_123')?.status, 'sent');
});
