import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { listProofVaultEntries, type ProofVaultEntry } from '@/lib/authenticity/proofVault';
import { verifyImageWithBackend } from '@/lib/authenticity/verifyRemote';
import { resolvePickedImageUri } from '@/lib/media/resolvePickedImageUri';
import { useSessionStore } from '@/store/sessionStore';
import type { VerificationOutcome, VerificationResultLabel } from '@/types/verification';

function shortCaptureId(captureId: string): string {
  return captureId.length > 12 ? `${captureId.slice(0, 8)}…` : captureId;
}

export default function VerifyScreen() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const setLast = useSessionStore((s) => s.setLastVerification);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [savedCaptures, setSavedCaptures] = useState<ProofVaultEntry[]>([]);

  const loadSavedCaptures = useCallback(async () => {
    const entries = await listProofVaultEntries();
    setSavedCaptures(entries);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSavedCaptures();
    }, [loadSavedCaptures])
  );

  function mapServerVerdict(v: string): VerificationResultLabel {
    if (v === 'verified_realux_capture') return 'verified';
    if (v === 'tampered_or_changed' || v === 'suspicious') return 'tampered_or_changed';
    return 'unknown_provenance';
  }

  async function runVerification(localUri: string) {
    if (!user?.uid) {
      setMsg('You must be signed in to verify images.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const remote = await verifyImageWithBackend({ localUri, uid: user.uid });
      const outcome: VerificationOutcome = {
        label: mapServerVerdict(remote.verdict),
        mediaId: remote.captureId,
        certificateId: remote.certificateId,
        serverVerdict: remote.verdict,
        details: {
          payloadFound: remote.checks?.proofFound ?? remote.verdict !== 'unknown_provenance',
          firestoreRecordFound: remote.checks?.backendRecordFound ?? false,
          mediaIdMatched: Boolean(remote.captureId),
          hashMatched: Boolean(remote.checks?.imageHashOk && remote.checks?.fullFileHashOk),
          rpcDigestMatched: remote.verdict === 'verified_realux_capture',
          checksumMatched: remote.verdict === 'verified_realux_capture',
          backendVerified: remote.verdict === 'verified_realux_capture',
          exactFileHashMatched: remote.checks?.fullFileHashOk,
          confidence: remote.confidence,
          notes: remote.reasons,
        },
      };
      setLast(outcome);
      router.push('/verify-result');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

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
    const asset = res.assets[0];
    const uri = await resolvePickedImageUri({
      uri: asset.uri,
      assetId: asset.assetId,
    });
    await runVerification(uri);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.body}>
        Verify a photo that Realux registered on this device. The proof bytes must still be present in the file you
        verify.
      </Text>
      {Platform.OS === 'ios' ? (
        <Text style={styles.hint}>
          On iPhone, the Photos app often re-encodes images and removes hidden proof data. For reliable verification,
          use a saved capture below instead of picking from Photos.
        </Text>
      ) : null}

      {savedCaptures.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved captures on this device</Text>
          {savedCaptures.map((entry) => (
            <Pressable
              key={entry.captureId}
              style={styles.card}
              disabled={busy}
              onPress={() => runVerification(entry.uri)}
            >
              <Text style={styles.cardTitle}>{shortCaptureId(entry.captureId)}</Text>
              <Text style={styles.cardMeta}>{new Date(entry.createdAt).toLocaleString()}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>No saved captures yet. Register an image first, then verify it here.</Text>
      )}

      {busy ? <ActivityIndicator /> : <PrimaryButton title="Pick from photo library" onPress={pickAndRun} />}
      {msg ? <Text style={styles.err}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, backgroundColor: '#f6f8f9' },
  body: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 14, lineHeight: 20, opacity: 0.85 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e8ec',
  },
  cardTitle: { fontFamily: 'monospace', fontSize: 13 },
  cardMeta: { marginTop: 4, fontSize: 13, opacity: 0.75 },
  err: { color: '#b00020' },
});
