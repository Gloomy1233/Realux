import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { persistCameraCaptureToCache } from '@/lib/media/persistCaptureUri';

export default function CaptureScreen() {
  const router = useRouter();
  const cam = useRef<InstanceType<typeof CameraView>>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [uri, setUri] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function snap() {
    if (!cam.current) return;
    setBusy(true);
    try {
      const shot = await cam.current.takePictureAsync({ quality: 0.92, skipProcessing: true });
      const stableUri = await persistCameraCaptureToCache(shot.uri);
      setUri(stableUri);
      setDims({ w: shot.width, h: shot.height });
    } finally {
      setBusy(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera access is needed to capture images.</Text>
        <PrimaryButton title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  if (uri && dims) {
    return (
      <View style={styles.container}>
        <Text style={styles.previewLabel}>Preview captured frame</Text>
        <Image source={{ uri }} style={styles.preview} resizeMode="contain" />
        <PrimaryButton
          title="Process and register"
          loading={busy}
          onPress={() =>
            router.push({
              pathname: '/process',
              params: { uri, w: String(dims.w), h: String(dims.h) },
            })
          }
        />
        <SecondaryButton title="Retake" onPress={() => setUri(null)} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView ref={cam} style={styles.camera} facing="back" />
      <View style={styles.bar}>
        <PrimaryButton title="Capture" onPress={snap} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  bar: { padding: 16, backgroundColor: '#111' },
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#f6f8f9' },
  msg: { fontSize: 16, textAlign: 'center' },
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center', backgroundColor: '#f6f8f9' },
  previewLabel: { fontSize: 16, marginBottom: 8 },
  preview: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#e1e8ec' },
});
