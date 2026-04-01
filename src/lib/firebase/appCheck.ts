import { CustomProvider, initializeAppCheck } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

import { appCheckDebugToken, shouldSkipAppCheck } from '@/lib/firebase/env';

/**
 * Wire App Check for the Firebase app.
 *
 * Prototype behavior:
 * - `EXPO_PUBLIC_SKIP_APPCHECK=1` skips initialization (local dev / emulator).
 * - Otherwise, if `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN` is set, register the same token
 *   in the Firebase console (App Check → Manage debug tokens) so requests are accepted.
 *
 * Production TODO: swap CustomProvider for platform attestation (Play Integrity / DeviceCheck)
 * or a dedicated exchange endpoint; keep enforcement enabled in Firebase console.
 */
export function initAppCheckForApp(app: FirebaseApp) {
  if (shouldSkipAppCheck()) {
    if (__DEV__) {
      console.warn(
        '[Realux] App Check skipped via EXPO_PUBLIC_SKIP_APPCHECK. Re-enable before production releases.'
      );
    }
    return;
  }

  const token = appCheckDebugToken();
  if (!token) {
    if (__DEV__) {
      console.warn(
        '[Realux] App Check debug token missing. Set EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN or skip with EXPO_PUBLIC_SKIP_APPCHECK=1.'
      );
    }
    return;
  }

  try {
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: () =>
          Promise.resolve({
            token,
            expireTimeMillis: Date.now() + 1000 * 60 * 60,
          }),
      }),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('[Realux] App Check init failed', e);
  }
}
