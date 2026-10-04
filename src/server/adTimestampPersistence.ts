import {
  AD_TIMESTAMP_FIELDS,
  InvalidLegacyCreatedAtError,
  isServerTimestampSentinel,
} from '../utils/adTimestampPersistence.js';

interface ServerTimestampAdapter {
  serverTimestamp: () => unknown;
  fromDate: (date: Date) => unknown;
  isTimestamp: (value: unknown) => boolean;
}

const timestampFromTransport = (
  value: unknown,
  adapter: ServerTimestampAdapter,
): unknown | undefined => {
  if (adapter.isTimestamp(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return adapter.fromDate(value);

  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return adapter.fromDate(date);
    return undefined;
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const rawSeconds = record.seconds ?? record._seconds;
    const rawNanoseconds = record.nanoseconds ?? record._nanoseconds ?? 0;
    const seconds = Number(rawSeconds);
    const nanoseconds = Number(rawNanoseconds);
    if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
      return adapter.fromDate(new Date((seconds * 1000) + (nanoseconds / 1_000_000)));
    }
  }

  return undefined;
};

/**
 * Reconstructs every transported timestamp immediately before the Admin SDK
 * write. It never trusts a browser-serialized FieldValue as a normal map.
 */
export const prepareServerAdTimestampFields = (
  incomingData: Record<string, any>,
  existingData: Record<string, any> | null,
  adapter: ServerTimestampAdapter,
): Record<string, any> => {
  const payload = { ...incomingData };

  if (existingData && !adapter.isTimestamp(existingData.createdAt)) {
    throw new InvalidLegacyCreatedAtError();
  }

  for (const fieldName of AD_TIMESTAMP_FIELDS) {
    if (fieldName === 'createdAt' || fieldName === 'updatedAt' || fieldName === 'externalPromotionConsentAt') {
      continue;
    }

    const value = payload[fieldName];
    if (value === undefined || value === null) continue;

    if (isServerTimestampSentinel(value)) {
      payload[fieldName] = adapter.serverTimestamp();
      continue;
    }

    const timestamp = timestampFromTransport(value, adapter);
    if (timestamp !== undefined) {
      payload[fieldName] = timestamp;
    } else if (existingData && Object.prototype.hasOwnProperty.call(existingData, fieldName)) {
      // Do not resend or silently migrate an optional invalid legacy timestamp.
      delete payload[fieldName];
    } else {
      throw new Error(`INVALID_AD_TIMESTAMP:${fieldName}`);
    }
  }

  payload.createdAt = existingData?.createdAt ?? adapter.serverTimestamp();
  payload.updatedAt = adapter.serverTimestamp();

  if (payload.externalPromotionConsent === true) {
    if (
      existingData?.externalPromotionConsent === true &&
      adapter.isTimestamp(existingData.externalPromotionConsentAt)
    ) {
      payload.externalPromotionConsentAt = existingData.externalPromotionConsentAt;
    } else if (existingData?.externalPromotionConsent !== true) {
      payload.externalPromotionConsentAt = adapter.serverTimestamp();
    } else {
      delete payload.externalPromotionConsentAt;
    }
  } else {
    payload.externalPromotionConsentAt = null;
  }

  return payload;
};
