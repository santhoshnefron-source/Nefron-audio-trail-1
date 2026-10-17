import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, setPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const originalConsoleError = console.error;
console.error = (...args) => {
  const isFirestoreConnectionError = args.some(arg => {
    if (typeof arg === 'string' && (arg.includes('Could not reach Cloud Firestore backend') || arg.includes('[code=unavailable]'))) {
      return true;
    }
    if (arg && arg.message && (arg.message.includes('Could not reach Cloud Firestore backend') || arg.message.includes('[code=unavailable]'))) {
      return true;
    }
    return false;
  });

  if (isFirestoreConnectionError) {
    return;
  }
  originalConsoleError(...args);
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Explicitly set persistence safely
try {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Auth persistence error:", error);
    // Fallback if cross-origin doesn't allow indexedDB/localStorage
    setPersistence(auth, inMemoryPersistence).catch(console.error);
  });
} catch (e) {
  console.error("Top-level persistence error:", e);
}

// Configure Firestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, onAuthStateChanged };
export type { User };

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}
