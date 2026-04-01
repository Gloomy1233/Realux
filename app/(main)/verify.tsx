import { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { logVerificationEvent } from '@/lib/firebase/logVerificationEvent';
import { verifyImageAgainstFirebase } from '@/lib/verify/verifyImageAgainstFirebase';
import { useSessionStore } from '@/store/sessionStore';

export default function VerifyScreen() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const deviceSecret = useSessionStore((s) => s.deviceSecret);
  const setLast = useSessionStore((s) => s.setLastVerification);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function pickAndRun() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setMsg('Photo library permission is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      ...(Platform.OS === 'ios'
        ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current }
        : null),
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const uri = res.assets[0].uri;
    if (!deviceSecret) {
      setMsg('Device secret not ready.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const outcome = await verifyImageAgainstFirebase({ localUri: uri, deviceSecret });
      setLast(outcome);
      if (user?.uid) {
        await logVerificationEvent({
          uid: user.uid,
          mediaId: outcome.mediaId,
          label: outcome.label,
          detailsJson: outcome.details,
        });
      }
      router.push('/verify-result');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.body}>
        Pick the same photo Realux saved after registration (it contains hidden registration data after the JPEG).
        Photos taken before “Process and register”, or re-saved by some gallery apps, may not verify.
      </Text>
      {busy ? <ActivityIndicator /> : <PrimaryButton title="Pick image" onPress={pickAndRun} />}
      {msg ? <Text style={styles.err}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: '#f6f8f9' },
  body: { fontSize: 15, lineHeight: 22 },
  err: { color: '#b00020' },
});
