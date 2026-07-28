import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  enableIndexedDbPersistence,
  getDocsFromCache,
  getDocsFromServer,
  getDocFromCache,
  getDocFromServer,
  Query,
  QuerySnapshot,
  DocumentReference,
  DocumentSnapshot,
  collection,
  addDoc
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Intercept console.error to downgrade benign Firestore connection or offline cache warnings
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const errorStr = args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');

    if (
      errorStr.includes('Could not reach Cloud Firestore backend') ||
      errorStr.includes('@firebase/firestore') ||
      errorStr.includes('Failed to get document from cache') ||
      errorStr.includes('Failed to get document from server')
    ) {
      console.warn('[Firebase Connection/Cache Note]', ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// Enable long polling only in sandboxed environments (such as localhost or Google Cloud Run dev URL)
// to bypass sandboxed iframe restrictions. In production (mercado-luso.com), use the default transport
// (WebSockets / streaming) to prevent reverse proxies/CDNs from buffering long-polling chunks and timing out.
const isSandboxEnv = typeof window !== 'undefined' && (
  window.location.hostname.includes('localhost') ||
  window.location.hostname.includes('127.0.0.1') ||
  window.location.hostname.includes('run.app') ||
  !window.location.hostname.endsWith('mercado-luso.com')
);

console.log('[Firebase] Initializing client-side app. Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'Server-side', '| Sandbox Env (Auto-Detect Long-Polling):', isSandboxEnv);

const firestoreOptions = isSandboxEnv ? { 
  experimentalForceLongPolling: true,
  useFetchStreams: false
} : {};

const dbId = firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId;
export const db = dbId 
  ? initializeFirestore(app, firestoreOptions, dbId)
  : initializeFirestore(app, firestoreOptions);

// Ativação de Persistência Offline (Cache) via IndexedDb conforme pedido
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] A persistência de dados falhou (múltiplas tabs abertas)');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] O browser atual não suporta persistência offline.');
    } else {
      console.warn('[Firebase] Erro ao ativar persistência offline:', err);
    }
  });
}

// Cache/de-duplication maps for document and query snapshots to prevent simultaneous duplicate requests and timeouts
const docCache = new Map<string, Promise<DocumentSnapshot>>();
const docsCache = new Map<string, Promise<QuerySnapshot>>();

// Configura as buscas para tentarem ler primeiro do Servidor e apenas do Cache como Fallback (Offline) para garantir dados sempre atualizados em tempo real estando online
export async function getDocsWithCacheFallback(q: Query, pathLabel: string = 'unknown'): Promise<QuerySnapshot> {
  const cacheKey = pathLabel;
  
  if (docsCache.has(cacheKey)) {
    const cachedPromise = docsCache.get(cacheKey)!;
    try {
      const snap = await cachedPromise;
      return snap;
    } catch {
      docsCache.delete(cacheKey);
    }
  }

  const promise = (async () => {
    try {
      const snap = await withTimeout(getDocsFromServer(q), 10000);
      return snap;
    } catch (err) {
      console.warn(`[Firestore Status] Servidor inacessível ou lento para obter docs (${pathLabel}). Recorrendo ao cache local...`, err);
      try {
        const snap = await getDocsFromCache(q);
        return snap;
      } catch (cacheErr) {
        console.error(`[Firestore Fatal Error] Falha de leitura e cache para: ${pathLabel}`, cacheErr);
        throw err;
      }
    }
  })();

  docsCache.set(cacheKey, promise);
  // Limit cache lifetime to 5 seconds to allow fresh updates while de-duplicating rapid simultaneous triggers
  setTimeout(() => {
    if (docsCache.get(cacheKey) === promise) {
      docsCache.delete(cacheKey);
    }
  }, 5000);

  return promise;
}

export async function getDocWithCacheFallback(docRef: DocumentReference, pathLabel: string = 'unknown'): Promise<DocumentSnapshot> {
  const cacheKey = docRef.path;
  
  if (docCache.has(cacheKey)) {
    const cachedPromise = docCache.get(cacheKey)!;
    try {
      const snap = await cachedPromise;
      return snap;
    } catch {
      docCache.delete(cacheKey);
    }
  }

  const promise = (async () => {
    try {
      const snap = await withTimeout(getDocFromServer(docRef), 10000);
      return snap;
    } catch (err) {
      console.warn(`[Firestore Status] Servidor inacessível ou lento para obter documento (${pathLabel}). Recorrendo ao cache local...`, err);
      try {
        const snap = await getDocFromCache(docRef);
        return snap;
      } catch (cacheErr) {
        console.error(`[Firestore Fatal Error] Falha de leitura e cache para documento: ${pathLabel}`, cacheErr);
        throw err;
      }
    }
  })();

  docCache.set(cacheKey, promise);
  // Limit cache lifetime to 10 seconds to allow fresh updates while de-duplicating rapid card renders
  setTimeout(() => {
    if (docCache.get(cacheKey) === promise) {
      docCache.delete(cacheKey);
    }
  }, 10000);

  return promise;
}

export const auth = getAuth(app);
console.log('[Firebase] Initializing Storage with bucket url:', firebaseConfig.storageBucket || "gs://navlink-489413.firebasestorage.app");
export const storage = getStorage(app, "gs://navlink-489413.firebasestorage.app");

// Limit upload and operation retries of the Firebase Storage instance to prevent freezing loading states in case of network or CORS issues
storage.maxUploadRetryTime = 6000; // 6 seconds
storage.maxOperationRetryTime = 6000; // 6 seconds

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  // If this is a permission error, log it to our system_health_events collection
  if (errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('denied') || errorMsg.toLowerCase().includes('insufficient')) {
    addDoc(collection(db, 'system_health_events'), {
      type: 'firestore_error',
      error: errorMsg,
      timestamp: new Date(),
      operationType,
      path
    }).catch(logErr => {
      console.warn('Silent skip: Failed to log firestore health event to avoid loop:', logErr);
    });
  }

  throw new Error(JSON.stringify(errInfo));
}

export function parseFirestoreDate(field: any): Date | null {
  if (!field) return null;
  if (typeof field.toDate === 'function') {
    return field.toDate();
  }
  if (typeof field === 'object' && field !== null && 'seconds' in field) {
    return new Date(field.seconds * 1000);
  }
  if (field instanceof Date) {
    return field;
  }
  const parsed = new Date(field);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout connecting to database"));
    }, timeoutMs);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

