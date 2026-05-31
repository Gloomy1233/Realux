import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { verificationResultTitle } from '@/lib/verify/resultLabels';
import { useSessionStore } from '@/store/sessionStore';

export default function VerifyResultScreen() {
  const router = useRouter();
  const outcome = useSessionStore((s) => s.lastVerification);

  if (!outcome) {
    return (
      <View style={styles.center}>
        <Text>No result in memory. Run verification again.</Text>
        <PrimaryButton title="Verify" onPress={() => router.replace('/verify')} />
      </View>
    );
  }

  const d = outcome.details;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{verificationResultTitle(outcome.label)}</Text>
      <Text style={styles.section}>Checks</Text>
      <Text style={styles.row}>Payload found: {d.payloadFound ? 'yes' : 'no'}</Text>
      <Text style={styles.row}>Firebase record found: {d.firestoreRecordFound ? 'yes' : 'no'}</Text>
      <Text style={styles.row}>Media id match: {d.mediaIdMatched ? 'yes' : 'no'}</Text>
      <Text style={styles.row}>File + core hash match: {d.hashMatched ? 'yes' : 'no'}</Text>
      <Text style={styles.row}>RPC digest match: {d.rpcDigestMatched ? 'yes' : 'no'}</Text>
      <Text style={styles.row}>Checksum match: {d.checksumMatched ? 'yes' : 'no'}</Text>
      {outcome.serverVerdict ? <Text style={styles.row}>Server verdict: {outcome.serverVerdict}</Text> : null}
      {d.confidence != null ? <Text style={styles.row}>Confidence: {Math.round(d.confidence * 100)}%</Text> : null}
      {d.backendVerified != null ? <Text style={styles.row}>Backend certificate: {d.backendVerified ? 'valid' : 'not valid'}</Text> : null}
      {outcome.mediaId ? (
        <Text style={styles.mono} selectable>
          captureId: {outcome.mediaId}
        </Text>
      ) : null}
      {outcome.certificateId ? (
        <Text style={styles.mono} selectable>
          certificateId: {outcome.certificateId}
        </Text>
      ) : null}
      {d.notes.length ? (
        <>
          <Text style={styles.sectionNotes}>Notes</Text>
          {d.notes.map((n, i) => (
            <Text key={i} style={styles.note}>
              • {n}
            </Text>
          ))}
        </>
      ) : null}
      <PrimaryButton title="Verify another" onPress={() => router.replace('/verify')} />
      <PrimaryButton title="Home" onPress={() => router.replace('/home')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#f6f8f9' },
  container: { padding: 24, gap: 10, backgroundColor: '#f6f8f9' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  section: { fontWeight: '700', marginTop: 12 },
  sectionNotes: { fontWeight: '700', marginTop: 16 },
  row: { fontSize: 15, lineHeight: 22 },
  mono: { fontFamily: 'monospace', fontSize: 13, marginTop: 8 },
  note: { fontSize: 14, lineHeight: 20, opacity: 0.9 },
});
