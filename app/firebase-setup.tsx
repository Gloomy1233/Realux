import { Stack } from 'expo-router';
import { DevSettings, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/SecondaryButton';
import { useSessionStore } from '@/store/sessionStore';

export default function FirebaseSetupScreen() {
  const err = useSessionStore((s) => s.firebaseInitError);

  return (
    <>
      <Stack.Screen options={{ title: 'Configuration' }} />
      <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configure Firebase</Text>
      <Text style={styles.body}>
        Realux needs your Firebase web app keys in `.env` (see `.env.example`) with names `EXPO_PUBLIC_FIREBASE_*`.
        After any change to `.env`, you must stop Metro completely (Ctrl+C in the terminal) and run{' '}
        <Text style={styles.mono}>npx expo start</Text> again. Tapping Reload in the app does not re-run app config.
        For release builds, set the same names in EAS environment variables or your shell before prebuild/Gradle.
      </Text>
      {err ? (
        <View style={styles.errBox}>
          <Text style={styles.errTitle}>Current status</Text>
          <Text style={styles.errBody}>{err}</Text>
        </View>
      ) : null}
      <Text style={styles.hint}>
        For local development you can set `EXPO_PUBLIC_SKIP_APPCHECK=1`. Before , register App Check debug
        tokens or platform providers and turn on enforcement in the Firebase console.production
      </Text>
      <SecondaryButton
        title="Reload app (do this after Metro restart)"
        onPress={() => DevSettings.reload()}
      />
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  errBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(176,0,32,0.08)',
  },
  errTitle: { fontWeight: '600', marginBottom: 6 },
  errBody: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 14, lineHeight: 20, opacity: 0.85 },
  mono: { fontFamily: 'monospace', fontSize: 14 },
});
