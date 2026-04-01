import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { registerCaptureWithFirebase } from '@/lib/media/registerCapture';
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
        const res = await registerCaptureWithFirebase({
          localUri: uri,
          uid: user.uid,
          deviceId,
          deviceSecret,
          width: width || 1,
          height: height || 1,
        });
        if (cancelled) return;
        setMediaId(res.mediaId);
        setStep('done');
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : 'Processing failed');
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
          mediaId: {mediaId}
        </Text>
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
  step: { fontSize: 14, opacity: 0.8 },
});
