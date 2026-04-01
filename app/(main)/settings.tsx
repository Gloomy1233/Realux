import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { firebaseDiagnostics, getFirebaseAuth } from '@/lib/firebase/config';
import { resetDeviceSecret } from '@/lib/security/deviceSecrets';
import { useSessionStore } from '@/store/sessionStore';

export default function SettingsScreen() {
  const router = useRouter();
  const deviceId = useSessionStore((s) => s.deviceId);
  const setDevice = useSessionStore((s) => s.setDevice);
  const [diag] = useState(() => firebaseDiagnostics());

  async function onResetSecret() {
    const next = await resetDeviceSecret();
    setDevice(next.deviceId, next.deviceSecret);
  }

  async function onSignOut() {
    const auth = getFirebaseAuth();
    await signOut(auth);
    router.replace('/sign-in');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.banner}>
        Prototype mode: device secrets and client-side digests are not a substitute for server-side signing. Treat this
        build as a functional demo of the registration and comparison workflow only.
      </Text>
      <Text style={styles.section}>Device</Text>
      <Text style={styles.mono} selectable>
        {deviceId ?? '—'}
      </Text>
      <PrimaryButton title="Reset device secret" onPress={onResetSecret} />
      <Text style={styles.hint}>Resetting invalidates verification for older captures on this device.</Text>
      <Text style={styles.section}>Developer diagnostics</Text>
      <Text style={styles.mono}>{JSON.stringify(diag, null, 2)}</Text>
      <SecondaryButton title="Sign out" onPress={onSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, backgroundColor: '#f6f8f9' },
  banner: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(13,110,110,0.08)',
    fontSize: 14,
    lineHeight: 20,
  },
  section: { fontWeight: '700', marginTop: 8 },
  mono: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  hint: { fontSize: 13, opacity: 0.8 },
});
