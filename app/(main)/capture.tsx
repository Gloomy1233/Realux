import { useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { persistCameraCaptureToCache } from '@/lib/media/persistCaptureUri';

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cam = useRef<InstanceType<typeof CameraView>>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [uri, setUri] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickFromGallery() {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.92,
        ...(Platform.OS === 'ios'
          ? {
              preferredAssetRepresentationMode:
                ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
            }
          : null),
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const asset = res.assets[0];
      const stableUri = await persistCameraCaptureToCache(asset.uri);
      setUri(stableUri);

      let w = asset.width ?? 0;
      let h = asset.height ?? 0;
      if (w < 2 || h < 2) {
        const sized = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          Image.getSize(
            stableUri,
            (imgW, imgH) => resolve({ width: imgW, height: imgH }),
            () => reject(new Error('Could not read picked image dimensions'))
          );
        });
        w = sized.width;
        h = sized.height;
      }
      setDims({ w: w || 1, h: h || 1 });
    } finally {
      setBusy(false);
    }
  }

  async function snap() {
    if (!cam.current) return;
    setBusy(true);
    try {
      const shot = await cam.current.takePictureAsync({ quality: 0.78, skipProcessing: true });
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

  if (uri && dims) {
    return (
      <View style={styles.container}>
        <Text style={styles.previewLabel}>Preview</Text>
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
        <SecondaryButton title="Choose different image" onPress={() => setUri(null)} />
      </View>
    );
  }

  /** Camera unavailable: still allow registering from the library. */
  if (!permission.granted) {
    return (
      <View style={[styles.flex, styles.centerMuted]}>
        <Text style={styles.msg}>Camera access is turned off.</Text>
        <Text style={styles.hint}>You can still register using a JPEG from your gallery, or enable the camera.</Text>
        <PrimaryButton title="Choose from gallery" onPress={pickFromGallery} loading={busy} />
        <SecondaryButton title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.barTop, { paddingTop: insets.top + 10 }]}>
        <PrimaryButton title="Capture" onPress={snap} loading={busy} />
        <SecondaryButton title="Gallery" disabled={busy} onPress={pickFromGallery} />
      </View>
      <CameraView ref={cam} style={styles.camera} facing="back" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  barTop: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#111',
  },
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#f6f8f9' },
  centerMuted: {
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#f6f8f9',
  },
  msg: { fontSize: 16, textAlign: 'center' },
  hint: { fontSize: 14, opacity: 0.75, textAlign: 'center' },
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
    backgroundColor: '#f6f8f9',
  },
  previewLabel: { fontSize: 16, marginBottom: 8 },
  preview: { width: '100%', height: 320, borderRadius: 12, backgroundColor: '#e1e8ec' },
});
