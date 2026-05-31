import Constants from 'expo-constants';
import { z } from 'zod';

const FirebaseEnvSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
});

export type FirebaseWebConfig = z.infer<typeof FirebaseEnvSchema>;

type FirebaseWebExtra = Partial<Record<keyof FirebaseWebConfig, string | undefined>>;

function pickFirebaseWeb(extraRoot: unknown): FirebaseWebExtra | undefined {
  if (!extraRoot || typeof extraRoot !== 'object' || !('firebaseWeb' in extraRoot)) {
    return undefined;
  }
  const fb = (extraRoot as { firebaseWeb: unknown }).firebaseWeb;
  if (!fb || typeof fb !== 'object') {
    return undefined;
  }
  return fb as FirebaseWebExtra;
}

/** Resolved project `extra` varies by client (Expo Go manifest2 vs embedded vs expoConfig). */
function rawFirebaseFromBuild(): FirebaseWebExtra | undefined {
  const fromExpoConfig = pickFirebaseWeb(Constants.expoConfig?.extra);
  if (fromExpoConfig && trimStr(fromExpoConfig.apiKey)) {
    return fromExpoConfig;
  }
  const man = Constants.manifest as { extra?: unknown } | null;
  const fromManifest = man?.extra ? pickFirebaseWeb(man.extra) : undefined;
  if (fromManifest && trimStr(fromManifest.apiKey)) {
    return fromManifest;
  }
  const m2 = Constants.manifest2 as { extra?: { expoClient?: { extra?: unknown } } } | null;
  const fromM2 = m2?.extra?.expoClient?.extra ? pickFirebaseWeb(m2.extra.expoClient.extra) : undefined;
  if (fromM2 && trimStr(fromM2.apiKey)) {
    return fromM2;
  }
  return fromExpoConfig ?? fromManifest ?? fromM2;
}

function trimStr(v: string | undefined): string {
  return (v ?? '').trim();
}

/**
 * Release APK/AAB reads config baked into the app manifest via `app.config.ts` (`extra.firebaseWeb`).
 * Development still works from `process.env` when Metro inlines `EXPO_PUBLIC_*`.
 */
export function parseFirebaseConfig(): { ok: true; config: FirebaseWebConfig } | { ok: false; error: string } {
  const fromExtra = rawFirebaseFromBuild();
  const raw = {
    apiKey: trimStr(fromExtra?.apiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
    authDomain: trimStr(fromExtra?.authDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: trimStr(fromExtra?.projectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: trimStr(fromExtra?.storageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: trimStr(fromExtra?.messagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: trimStr(fromExtra?.appId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
  };
  const parsed = FirebaseEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [
      ...new Set(
        parsed.error.issues
          .map((i) => (i.path.length ? String(i.path[0]) : null))
          .filter((x): x is string => x != null)
      ),
    ];
    const allEmpty = Object.values(raw).every((v) => !trimStr(v));
    const devRestartHint =
      allEmpty && __DEV__
        ? ' After editing .env, stop Metro (Ctrl+C) and run npx expo start again — “Reload” does not re-read env or app.config.'
        : '';
    const fieldHint = fields.length ? ` Check fields: ${fields.join(', ')}.` : '';
    return {
      ok: false,
      error: `Missing or invalid EXPO_PUBLIC_FIREBASE_* variables. Set them in .env (local) or EAS env (cloud); they apply when Metro or the native build runs.${fieldHint}${devRestartHint ? ` ${devRestartHint}` : ''}`,
    };
  }
  return { ok: true, config: parsed.data };
}

export function readFirebaseConfigFromEnv(): FirebaseWebConfig {
  const r = parseFirebaseConfig();
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.config;
}

/** Use emulator hosts in development when EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 */
export function firebaseEmulatorHosts() {
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR !== '1') return null;
  return {
    firestoreHost: process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1',
    firestorePort: Number(process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT ?? '8080'),
    authHost: process.env.EXPO_PUBLIC_AUTH_EMULATOR_HOST ?? '127.0.0.1',
    authPort: Number(process.env.EXPO_PUBLIC_AUTH_EMULATOR_PORT ?? '9099'),
    functionsHost: process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1',
    functionsPort: Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT ?? '5001'),
    storageHost: process.env.EXPO_PUBLIC_STORAGE_EMULATOR_HOST ?? '127.0.0.1',
    storagePort: Number(process.env.EXPO_PUBLIC_STORAGE_EMULATOR_PORT ?? '9199'),
  };
}

export function shouldSkipAppCheck(): boolean {
  return process.env.EXPO_PUBLIC_SKIP_APPCHECK === '1';
}

export function appCheckDebugToken(): string | undefined {
  const t = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
  return t && t.length > 0 ? t : undefined;
}
