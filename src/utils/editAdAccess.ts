export type ServerAdSnapshot<T> = {
  exists: () => boolean;
  data: () => T;
};

export type EditAdLoadResult<T> =
  | { status: 'allowed'; data: T }
  | { status: 'forbidden' }
  | { status: 'not-found' };

export class EditAdServerVerificationError extends Error {
  constructor(cause?: unknown) {
    super('Unable to confirm the latest listing data from the server.');
    this.name = 'EditAdServerVerificationError';
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

/**
 * Authorisation-sensitive listing loads must use a server-confirmed snapshot.
 * The caller deliberately supplies only a server reader, so a persistent
 * Firestore cache can never be used to grant or deny ownership here.
 */
export async function loadServerConfirmedEditableAd<T extends { sellerId?: string }>(options: {
  readFromServer: () => Promise<ServerAdSnapshot<T>>;
  userId: string;
  isAdmin: boolean;
  isModerator: boolean;
}): Promise<EditAdLoadResult<T>> {
  let snapshot: ServerAdSnapshot<T>;

  try {
    snapshot = await options.readFromServer();
  } catch (error) {
    throw new EditAdServerVerificationError(error);
  }

  if (!snapshot.exists()) return { status: 'not-found' };

  const data = snapshot.data();
  if (!options.isAdmin && !options.isModerator && data.sellerId !== options.userId) {
    return { status: 'forbidden' };
  }

  return { status: 'allowed', data };
}
