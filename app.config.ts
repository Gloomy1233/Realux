import { loadProjectEnv } from '@expo/env';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import path from 'path';

// Ensures `.env` is loaded when this file runs (local builds). EAS / CI should set the same vars in the
// environment so they win over dotenv without `force`.
loadProjectEnv(path.resolve(__dirname), { silent: true, force: true });

function mergePlugins(base: ExpoConfig['plugins']): ExpoConfig['plugins'] {
  const existing = base ?? [];
  const add = ['expo-font', 'expo-secure-store', 'expo-web-browser'] as const;
  const merged: NonNullable<ExpoConfig['plugins']> = [...existing];
  for (const p of add) {
    const has = merged.some((entry) => entry === p || (Array.isArray(entry) && entry[0] === p));
    if (!has) {
      merged.push(p);
    }
  }
  return merged;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    plugins: mergePlugins(config.plugins),
    extra: {
      ...config.extra,
      firebaseWeb: {
        apiKey: 'AIzaSyAeB1pTFqgRfIsdbWrUt6E4IhrhgzkS0yI',
        authDomain: 'realux-8cd84.firebaseapp.com',
        projectId: 'realux-8cd84',
        storageBucket: 'realux-8cd84.firebasestorage.app',
        messagingSenderId: '988371054696',
        appId: '1:988371054696:android:74272e4e301e39a77e0bdd',
      },
    },
  } as ExpoConfig;
};
