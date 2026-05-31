import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { FirebaseError } from 'firebase/app';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { registerCaptureWithBackend } from '@/lib/authenticity/registerCapture';
import { firebaseEmulatorHosts, parseFirebaseConfig } from '@/lib/firebase/env';
import { useSessionStore } from '@/store/sessionStore';

type Step = 'hash' | 'package' | 'embed' | 'upload' | 'done' | 'error';

export default function ProcessScreen() {
  const router = useRouter();
  const { uri, w, h } = useLocalSearchParams<{ uri: string; w: string; h: string }>();
  const user = useSessionStore((s) => s.user);
  const deviceId = useSessionStore((s) => s.deviceId);
  const deviceSecret = useSessionStore((s) => s.deviceSecret);

  const [step, setStep] = useState<Step>('hash');
  const [err, setErr] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [certificateId, setCertificateId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uri || !user?.uid || !deviceId || !deviceSecret) {
        setErr('Missing capture or session data.');
        setStep('error');
        return;
      }
      let width = Number(w) || 0;
      let height = Number(h) || 0;
      if (width < 2 || height < 2) {
        const sized = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          Image.getSize(
            uri,
            (imgW, imgH) => resolve({ width: imgW, height: imgH }),
            (e) => reject(e ?? new Error('Could not read image size'))
          );
        });
        width = sized.width;
        height = sized.height;
      }
      try {
        setStep('hash');
        await new Promise((r) => setTimeout(r, 200));
        setStep('package');
        await new Promise((r) => setTimeout(r, 200));
        setStep('embed');
        setStep('upload');
        const res = await registerCaptureWithBackend({
          localUri: uri,
          uid: user.uid,
          deviceId,
          width: width || 1,
          height: height || 1,
        });
        if (cancelled) return;
        setMediaId(res.captureId);
        setCertificateId(res.certificateId);
        setStep('done');
      } catch (e) {
        if (cancelled) return;
        let message =
          e instanceof FirebaseError ? e.message : e instanceof Error ? e.message : 'Processing failed';
        if (e instanceof FirebaseError && e.code === 'functions/unauthenticated') {
          const parsed = parseFirebaseConfig();
          const projectId = parsed.ok ? parsed.config.projectId : 'unknown';
          const emu = firebaseEmulatorHosts();
          message = emu
            ? `Firebase emulators are enabled, but phones cannot reach 127.0.0.1 on your PC. Turn off EXPO_PUBLIC_USE_FIREBASE_EMULATOR in .env (or unset it), run "npx expo start -c", rebuild your dev client if needed, and try hitting production project "${projectId}".`
            : `The callable saw no logged-in Firebase user (${projectId}). Sign out and sign in again after a full app restart (not just Reload). If Google Cloud shows 0 function requests yet you still see this, the app probably targets a different Firebase project than the one open in Console.`;
        }
        setErr(message);
        setStep('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri, w, h, user?.uid, deviceId, deviceSecret]);

  if (step === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>{err}</Text>
        <PrimaryButton title="Back to home" onPress={() => router.replace('/home')} />
      </View>
    );
  }

  if (step === 'done' && mediaId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Registration complete</Text>
        <Text style={styles.body} selectable>
          captureId: {mediaId}
        </Text>
        {Platform.OS === 'ios' ? (
          <Text style={styles.hint}>
            On iPhone, verify this capture from Verify → Saved captures on this device. Photos may strip proof data if
            you pick the gallery copy instead.
          </Text>
        ) : null}
        {certificateId ? (
          <Text style={styles.body} selectable>
            certificateId: {certificateId}
          </Text>
        ) : null}
        <PrimaryButton title="Home" onPress={() => router.replace('/home')} />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
      <Text style={styles.body}>Working through registration steps…</Text>
      <Text style={styles.step}>
        {step === 'hash' && 'Hashing image'}
        {step === 'package' && 'Building verification package'}
        {step === 'embed' && 'Embedding registration payload'}
        {step === 'upload' && 'Uploading to Firebase'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#f6f8f9' },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 14, lineHeight: 20, opacity: 0.85 },
  step: { fontSize: 14, opacity: 0.8 },
});
