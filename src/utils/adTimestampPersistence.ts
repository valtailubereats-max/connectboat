export const AD_TIMESTAMP_FIELDS = [
  'createdAt',
  'updatedAt',
  'externalPromotionConsentAt',
  'paidAt',
  'activatedAt',
  'featuredActivatedAt',
  'planStartedAt',
  'expirationDate',
  'planExpiresAt',
  'featuredUntil',
] as const;

export type AdTimestampField = (typeof AD_TIMESTAMP_FIELDS)[number];

export class InvalidLegacyCreatedAtError extends Error {
  readonly code = 'INVALID_LEGACY_CREATED_AT';

  constructor() {
    super(
      'This legacy listing has an invalid createdAt value and cannot be saved safely. An administrator must repair createdAt before editing it.',
    );
    this.name = 'InvalidLegacyCreatedAtError';
  }
}

export const isServerTimestampSentinel = (value: unknown): boolean => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as Record<string, unknown>)._methodName === 'serverTimestamp'
);

export const isFirestoreTimestamp = (value: unknown): boolean => (
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { toDate?: unknown }).toDate === 'function' &&
  typeof (value as { toMillis?: unknown }).toMillis === 'function'
);

const timestampToIso = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString();
  if (!isFirestoreTimestamp(value)) return null;

  const date = (value as { toDate: () => Date }).toDate();
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Builds the JSON-safe payload sent to the existing consolidated API.
 * Firestore FieldValue sentinels never cross JSON and server-owned createdAt /
 * updatedAt values are always reconstructed by the server immediately before write.
 */
export const prepareAdPayloadForTransport = (
  data: Record<string, any>,
  options: { isExisting: boolean; existingCreatedAt?: unknown },
): Record<string, any> => {
  if (options.isExisting && !isFirestoreTimestamp(options.existingCreatedAt)) {
    throw new InvalidLegacyCreatedAtError();
  }

  const payload = { ...data };

  for (const fieldName of AD_TIMESTAMP_FIELDS) {
    const value = payload[fieldName];
    if (isServerTimestampSentinel(value)) {
      delete payload[fieldName];
      continue;
    }

    const isoValue = timestampToIso(value);
    if (isoValue) payload[fieldName] = isoValue;
  }

  // These fields are never trusted over JSON. The server owns both values.
  delete payload.createdAt;
  delete payload.updatedAt;
  delete payload.externalPromotionConsentAt;

  return payload;
};

/**
 * Builds the final Client SDK write payload. The timestamp factory must be
 * serverTimestamp and is deliberately invoked only inside this final step.
 */
export const prepareAdPayloadForClientWrite = (
  data: Record<string, any>,
  options: {
    isExisting: boolean;
    existingCreatedAt?: unknown;
    existingExternalPromotionConsent?: boolean;
    existingExternalPromotionConsentAt?: unknown;
    serverTimestamp: () => unknown;
  },
): Record<string, any> => {
  if (options.isExisting && !isFirestoreTimestamp(options.existingCreatedAt)) {
    throw new InvalidLegacyCreatedAtError();
  }

  const payload = { ...data };

  // Never echo a serialized FieldValue map back to Firestore. Omitting an
  // optional legacy field preserves it under merge without silently migrating it.
  for (const fieldName of AD_TIMESTAMP_FIELDS) {
    if (isServerTimestampSentinel(payload[fieldName])) delete payload[fieldName];
  }

  payload.createdAt = options.isExisting
    ? options.existingCreatedAt
    : options.serverTimestamp();
  payload.updatedAt = options.serverTimestamp();

  if (payload.externalPromotionConsent === true) {
    if (
      options.existingExternalPromotionConsent === true &&
      isFirestoreTimestamp(options.existingExternalPromotionConsentAt)
    ) {
      payload.externalPromotionConsentAt = options.existingExternalPromotionConsentAt;
    } else if (options.existingExternalPromotionConsent !== true) {
      payload.externalPromotionConsentAt = options.serverTimestamp();
    } else {
      // Preserve an invalid optional legacy value through merge, but never
      // resend that value or repair it silently in this preventive change.
      delete payload.externalPromotionConsentAt;
    }
  } else {
    payload.externalPromotionConsentAt = null;
  }

  return payload;
};
