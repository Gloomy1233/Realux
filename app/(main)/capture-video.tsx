import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { persistVideoCaptureToCache } from '@/lib/media/persistCaptureUri';

const MAX_RECORD_SECONDS = 60;
const CAMERA_WARMUP_MS = 350;

export default function CaptureVideoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cam = useRef<InstanceType<typeof CameraView>>(null);
  const recordStartedAt = useRef(0);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [uri, setUri] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number; durationMs: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function ensureMicPermission(): Promise<boolean> {
    if (micPermission?.granted) return true;
    const mic = await requestMicPermission();
    if (!mic.granted) {
      setMsg('Microphone permission is required to record video with audio.');
      return false;
    }
    return true;
  }

  async function pickFromGallery() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setMsg('Photo library permission is required.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        ...(Platform.OS === 'ios'
          ? { videoQuality: ImagePicker.UIImagePickerControllerQualityType.High }
          : null),
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const asset = res.assets[0];
      const stableUri = await persistVideoCaptureToCache(asset.uri);
      setUri(stableUri);
      setDims({
        w: asset.width ?? 1,
        h: asset.height ?? 1,
        durationMs: Math.max(1, Math.round((asset.duration ?? 1) * 1000)),
      });
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (!cam.current || recording || busy) return;
    if (!cameraReady) {
      setMsg('Camera is still starting. Wait a moment, then try again.');
      return;
    }
    if (!(await ensureMicPermission())) return;

    setMsg(null);
    setRecording(true);
    recordStartedAt.current = Date.now();

    try {
      await new Promise((resolve) => setTimeout(resolve, CAMERA_WARMUP_MS));
      const clip = await cam.current.recordAsync({ maxDuration: MAX_RECORD_SECONDS });
      if (!clip?.uri) {
        setMsg('Recording produced no video file. Try again or pick from gallery.');
        return;
      }

      setBusy(true);
      const stableUri = await persistVideoCaptureToCache(clip.uri);
      const durationMs = Math.max(1, Date.now() - recordStartedAt.current);
      setUri(stableUri);
      setDims({ w: 1, h: 1, durationMs });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Recording failed');
    } finally {
      setRecording(false);
      setBusy(false);
    }
  }

  function stopRecording() {
    if (!recording) return;
    cam.current?.stopRecording();
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
        <Text style={styles.previewLabel}>Video ready</Text>
        <Text style={styles.meta}>
          Duration: {Math.round(dims.durationMs / 1000)}s
          {dims.w > 1 ? ` · ${dims.w}×${dims.h}` : ''}
        </Text>
        <PrimaryButton
          title="Process and register"
          loading={busy}
          onPress={() =>
            router.push({
              pathname: '/process-video',
              params: {
                uri,
                w: String(dims.w),
                h: String(dims.h),
                durationMs: String(dims.durationMs),
              },
            } as unknown as Href)
          }
        />
        <SecondaryButton title="Choose different video" onPress={() => setUri(null)} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.flex, styles.centerMuted]}>
        <Text style={styles.msg}>Camera access is turned off.</Text>
        <Text style={styles.hint}>You can still register an MP4 from your gallery, or enable the camera.</Text>
        <PrimaryButton title="Choose from gallery" onPress={pickFromGallery} loading={busy} />
        <SecondaryButton title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.barTop, { paddingTop: insets.top + 10 }]}>
        {recording ? (
          <>
            <View style={styles.recordingRow}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording — tap Stop when finished</Text>
            </View>
            <PrimaryButton title="Stop recording" onPress={stopRecording} />
          </>
        ) : (
          <PrimaryButton
            title={cameraReady ? 'Record video' : 'Starting camera…'}
            onPress={startRecording}
            loading={busy}
            disabled={!cameraReady}
          />
        )}
        <SecondaryButton title="Gallery" disabled={busy || recording} onPress={pickFromGallery} />
        {!recording ? (
          <Text style={styles.recordHint}>
            {Platform.OS === 'ios'
              ? `Includes audio. Max ${MAX_RECORD_SECONDS}s.`
              : `Max ${MAX_RECORD_SECONDS}s. Emulator recording may not work — use Gallery on a real device.`}
          </Text>
        ) : null}
        {msg ? <Text style={styles.err}>{msg}</Text> : null}
      </View>
      <CameraView
        ref={cam}
        style={styles.camera}
        facing="back"
        mode="video"
        onCameraReady={() => setCameraReady(true)}
      />
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
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e53935',
  },
  recordingText: { color: '#fff', fontSize: 14, flex: 1 },
  recordHint: { color: '#ccc', fontSize: 13 },
  err: { color: '#ff8a80', fontSize: 13 },
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
  meta: { fontSize: 14, opacity: 0.85 },
});
