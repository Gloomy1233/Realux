import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { connectAuthEmulator, type Auth, type Persistence } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { Platform } from 'react-native';

import { appCheckDebugToken, firebaseEmulatorHosts, readFirebaseConfigFromEnv, shouldSkipAppCheck } from '@/lib/firebase/env';
import { initAppCheckForApp } from '@/lib/firebase/appCheck';

let appSingleton: FirebaseApp | null = null;
let authSingleton: Auth | null = null;
let dbSingleton: Firestore | null = null;
let functionsSingleton: Functions | null = null;
let storageSingleton: FirebaseStorage | null = null;

export function resetFirebaseSingletonsForTests() {
  appSingleton = null;
  authSingleton = null;
  dbSingleton = null;
  functionsSingleton = null;
  storageSingleton = null;
}

/** Native: RN auth bundle + AsyncStorage persistence (see metro.config.js). Web: getAuth only. */
function resolveAuth(app: FirebaseApp): Auth {
  if (Platform.OS === 'web') {
    return firebaseAuth.getAuth(app);
  }

  const mod = firebaseAuth as typeof firebaseAuth & {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
  };
  const persistCtor = mod.getReactNativePersistence;
  if (!persistCtor) {
    return firebaseAuth.getAuth(app);
  }

  try {
    return firebaseAuth.initializeAuth(app, {
      persistence: persistCtor(AsyncStorage) as Persistence,
    });
  } catch {
    return firebaseAuth.getAuth(app);
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (!appSingleton) {
    const cfg = readFirebaseConfigFromEnv();
    appSingleton = getApps().length ? getApp() : initializeApp(cfg);
    initAppCheckForApp(appSingleton);
  }
  return appSingleton;
}

export function getFirebaseAuth(): Auth {
  if (!authSingleton) {
    const app = getFirebaseApp();
    authSingleton = resolveAuth(app);
    const emu = firebaseEmulatorHosts();
    if (emu) {
      connectAuthEmulator(authSingleton, `http://${emu.authHost}:${emu.authPort}`, { disableWarnings: true });
    }
  }
  return authSingleton;
}

export function getFirebaseDb(): Firestore {
  void getFirebaseAuth();
  if (!dbSingleton) {
    const app = getFirebaseApp();
    dbSingleton = getFirestore(app);
    const emu = firebaseEmulatorHosts();
    if (emu) {
      connectFirestoreEmulator(dbSingleton, emu.firestoreHost, emu.firestorePort);
    }
  }
  return dbSingleton;
}

export function getFirebaseFunctions(): Functions {
  /** Auth must register on the Firebase app before Functions attaches its Auth interop (`getAuthToken`). */
  void getFirebaseAuth();
  if (!functionsSingleton) {
    const app = getFirebaseApp();
    functionsSingleton = getFunctions(app, 'us-central1');
    const emu = firebaseEmulatorHosts();
    if (emu) {
      connectFunctionsEmulator(functionsSingleton, emu.functionsHost, emu.functionsPort);
    }
  }
  return functionsSingleton;
}

export function getFirebaseStorage(): FirebaseStorage {
  void getFirebaseAuth();
  if (!storageSingleton) {
    const app = getFirebaseApp();
    storageSingleton = getStorage(app);
    const emu = firebaseEmulatorHosts();
    if (emu) {
      connectStorageEmulator(storageSingleton, emu.storageHost, emu.storagePort);
    }
  }
  return storageSingleton;
}

export function firebaseDiagnostics() {
  return {
    skipAppCheck: shouldSkipAppCheck(),
    hasAppCheckDebugToken: Boolean(appCheckDebugToken()),
    emulator: firebaseEmulatorHosts(),
  };
}
