export interface GA4MeasurementContext {
  clientId: string;
  sessionId?: string;
}

export interface GA4MeasurementEvent {
  name: string;
  params: Record<string, string | number | boolean | undefined>;
}

export const isValidGA4Context = (context: unknown): context is GA4MeasurementContext => {
  if (!context || typeof context !== 'object') return false;
  const candidate = context as Record<string, unknown>;
  return typeof candidate.clientId === 'string' &&
    candidate.clientId.length <= 100 &&
    /^[A-Za-z0-9._-]+$/.test(candidate.clientId) &&
    (candidate.sessionId === undefined || (
      typeof candidate.sessionId === 'string' && /^\d{1,20}$/.test(candidate.sessionId)
    ));
};

export const isConfirmedGBPCheckout = (paymentStatus: unknown, amountTotal: unknown, currency: unknown) =>
  paymentStatus === 'paid' &&
  typeof amountTotal === 'number' && Number.isFinite(amountTotal) && amountTotal > 0 &&
  typeof currency === 'string' && currency.toLowerCase() === 'gbp';

export const hasGA4MeasurementApiSecret = (apiSecret = process.env.GA4_API_SECRET): boolean =>
  typeof apiSecret === 'string' && apiSecret.trim().length > 0;

export const updateGA4ConsentState = async (
  db: any,
  uid: string,
  consented: boolean,
  consentChangedAt: unknown
) => {
  const changedAt = Number(consentChangedAt);
  const timestamp = Number.isFinite(changedAt) && changedAt > 0 ? changedAt : Date.now();
  const consentRef = db.collection('ga4AnalyticsConsents').doc(uid);
  return db.runTransaction(async (transaction: any) => {
    const snapshot = await transaction.get(consentRef);
    const current = snapshot.exists ? snapshot.data() : null;
    const currentTimestamp = Number(current?.consentChangedAt || 0);
    if (currentTimestamp > timestamp && current?.consented !== consented) return false;
    transaction.set(consentRef, {
      consented,
      consentChangedAt: timestamp,
      updatedAt: new Date(),
    }, { merge: true });
    return true;
  });
};

export const buildGA4MeasurementPayload = (
  context: GA4MeasurementContext,
  events: GA4MeasurementEvent[],
  timestampMicros?: number
) => ({
  client_id: context.clientId,
  ...(timestampMicros ? { timestamp_micros: timestampMicros } : {}),
  consent: {
    // Analytics consent does not imply consent to advertising use or profiling.
    ad_user_data: 'DENIED',
    ad_personalization: 'DENIED',
  },
  events: events.map(({ name, params }) => ({
    name,
    params: {
      ...Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)),
      ...(context.sessionId ? { session_id: context.sessionId } : {}),
      engagement_time_msec: 1,
    } as Record<string, string | number | boolean>,
  })),
});

/** Sends consented GA4 events once, using a private Firestore idempotency record. */
export const sendGA4MeasurementEventsOnce = async (options: {
  db: any;
  eventKey: string;
  context: GA4MeasurementContext;
  events: GA4MeasurementEvent[];
  timestampMicros?: number;
  measurementId?: string;
  apiSecret?: string;
  fetcher?: typeof fetch;
}): Promise<boolean> => {
  const measurementId = options.measurementId || process.env.GA4_MEASUREMENT_ID || 'G-B0BPV9R463';
  const apiSecret = options.apiSecret ?? process.env.GA4_API_SECRET;
  if (!hasGA4MeasurementApiSecret(apiSecret)) {
    console.warn('[GA4 Measurement Protocol] Delivery is unavailable.', { reason: 'missing_api_secret' });
    return false;
  }
  if (!isValidGA4Context(options.context) || !options.events.length) return false;
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(options.eventKey)) return false;

  const eventRef = options.db.collection('ga4MeasurementEvents').doc(options.eventKey);
  let claimed = false;
  try {
    claimed = await options.db.runTransaction(async (transaction: any) => {
      const snapshot = await transaction.get(eventRef);
      const current = snapshot.exists ? snapshot.data() : null;
      const lastClaim = current?.claimedAt?.toMillis?.() || 0;
      if (current?.status === 'sent') return false;
      if (current?.status === 'processing' && Date.now() - lastClaim < 5 * 60 * 1000) return false;
      transaction.set(eventRef, { status: 'processing', claimedAt: new Date() }, { merge: true });
      return true;
    });
  } catch {
    console.warn('[GA4 Measurement Protocol] Idempotency check failed.');
    return false;
  }
  if (!claimed) return false;

  try {
    const payload = buildGA4MeasurementPayload(options.context, options.events, options.timestampMicros);
    const response = await (options.fetcher || fetch)(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      await eventRef.set({ status: 'failed', failedAt: new Date(), failureCode: `http_${response.status}` }, { merge: true });
      console.warn('[GA4 Measurement Protocol] Delivery failed.', { httpStatus: response.status });
      return false;
    }
    await eventRef.set({ status: 'sent', sentAt: new Date() }, { merge: true });
    return true;
  } catch {
    await eventRef.set({ status: 'failed', failedAt: new Date(), failureCode: 'network_error' }, { merge: true }).catch(() => {});
    console.warn('[GA4 Measurement Protocol] Delivery failed.', { reason: 'network_error' });
    return false;
  }
};
