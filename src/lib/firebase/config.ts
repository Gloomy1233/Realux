import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

import { appCheckDebugToken, firebaseEmulatorHosts, readFirebaseConfigFromEnv, shouldSkipAppCheck } from '@/lib/firebase/env';
import { initAppCheckForApp } from '@/lib/firebase/appCheck';

let appSingleton: FirebaseApp | null = null;
let authSingleton: Auth | null = null;
let dbSingleton: Firestore | null = null;

export function resetFirebaseSingletonsForTests() {
  appSingleton = null;
  authSingleton = null;
  dbSingleton = null;
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
    // TODO(production): add durable persistence via supported Auth persistence layer for RN
    // when upgrading Firebase / platform packaging (AsyncStorage-backed persistence).
    authSingleton = getAuth(app);
    const emu = firebaseEmulatorHosts();
    if (emu) {
      connectAuthEmulator(authSingleton, `http://${emu.authHost}:${emu.authPort}`, { disableWarnings: true });
    }
  }
  return authSingleton;
}

export function getFirebaseDb(): Firestore {
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

export function firebaseDiagnostics() {
  return {
    skipAppCheck: shouldSkipAppCheck(),
    hasAppCheckDebugToken: Boolean(appCheckDebugToken()),
    emulator: firebaseEmulatorHosts(),
  };
}
