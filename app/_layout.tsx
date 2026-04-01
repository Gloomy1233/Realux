import 'react-native-get-random-values';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { getFirebaseApp, getFirebaseAuth } from '@/lib/firebase/config';
import { parseFirebaseConfig } from '@/lib/firebase/env';
import { ensureDeviceIdentity } from '@/lib/security/deviceSecrets';
import { useSessionStore } from '@/store/sessionStore';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const scheme = useColorScheme();
  const setFirebaseStatus = useSessionStore((s) => s.setFirebaseStatus);
  const setUser = useSessionStore((s) => s.setUser);
  const setAuthReady = useSessionStore((s) => s.setAuthReady);
  const setDevice = useSessionStore((s) => s.setDevice);
  const setDeviceReady = useSessionStore((s) => s.setDeviceReady);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const dev = await ensureDeviceIdentity();
      setDevice(dev.deviceId, dev.deviceSecret);
      const parsed = parseFirebaseConfig();
      if (!parsed.ok) {
        setFirebaseStatus(false, parsed.error);
        setAuthReady(true);
        setDeviceReady(true);
        return;
      }
      setFirebaseStatus(true, null);
      try {
        getFirebaseApp();
        const auth = getFirebaseAuth();
        unsub = onAuthStateChanged(auth, (u) => setUser(u));
      } finally {
        setAuthReady(true);
      }
      setDeviceReady(true);
    })();
    return () => unsub?.();
  }, [setAuthReady, setDevice, setDeviceReady, setFirebaseStatus, setUser]);

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShadowVisible: false }} />
    </ThemeProvider>
  );
}
