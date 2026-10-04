const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const firebaseStoragePathFromUrl = (value: unknown, expectedBucket?: string): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const source = value.trim();

  if (source.startsWith('gs://')) {
    const withoutScheme = source.slice(5);
    const separator = withoutScheme.indexOf('/');
    if (separator < 1) return null;
    const bucket = withoutScheme.slice(0, separator);
    if (expectedBucket && bucket !== expectedBucket) return null;
    return safeDecode(withoutScheme.slice(separator + 1));
  }

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }

  if (url.hostname === 'firebasestorage.googleapis.com') {
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) return null;
    const bucket = safeDecode(match[1]);
    if (expectedBucket && bucket !== expectedBucket) return null;
    return safeDecode(match[2]);
  }

  if (url.hostname === 'storage.googleapis.com') {
    const match = url.pathname.match(/^\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const bucket = safeDecode(match[1]);
    if (expectedBucket && bucket !== expectedBucket) return null;
    return safeDecode(match[2]);
  }

  return null;
};

export const collectFirebaseStoragePaths = (
  values: unknown[],
  expectedBucket?: string
): string[] => Array.from(new Set(
  values
    .map(value => firebaseStoragePathFromUrl(value, expectedBucket))
    .filter((path): path is string => Boolean(path))
));

export const deleteFirebaseStoragePaths = async (
  paths: string[],
  deletePath: (path: string) => Promise<unknown>
): Promise<void> => {
  const results = await Promise.allSettled(paths.map(deletePath));
  const failures = results
    .map((result, index) => result.status === 'rejected' && result.reason?.code !== 'storage/object-not-found'
      ? { path: paths[index], reason: result.reason }
      : null)
    .filter((failure): failure is { path: string; reason: unknown } => failure !== null);

  if (failures.length > 0) {
    const failedPaths = failures.map(failure => failure.path).join(', ');
    console.error('[PermanentDelete] Firebase Storage cleanup failed', failures);
    throw new Error(`The listing was not deleted because ${failures.length} Storage file(s) could not be removed: ${failedPaths}`);
  }
};
