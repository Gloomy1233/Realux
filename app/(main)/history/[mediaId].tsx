import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { fetchMediaRecord } from '@/lib/firebase/fetchMediaRecord';
import type { MediaRecord } from '@/types/verification';

export default function MediaDetailScreen() {
  const { mediaId } = useLocalSearchParams<{ mediaId: string }>();
  const [rec, setRec] = useState<MediaRecord | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mediaId) return;
      const r = await fetchMediaRecord(mediaId);
      if (!cancelled) setRec(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  if (rec === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!rec) {
    return (
      <View style={styles.center}>
        <Text>Record not found or you do not have access.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.mono} selectable>
        {rec.mediaId}
      </Text>
      <Text style={styles.row}>Created: {new Date(rec.createdAt).toLocaleString()}</Text>
      <Text style={styles.row}>Dimensions: {rec.width}×{rec.height}</Text>
      <Text style={styles.row}>MIME: {rec.mimeType}</Text>
      <Text style={styles.row}>SHA-256 (registered file): {rec.sha256}</Text>
      <Text style={styles.row}>Core SHA-256 (image before trailer): {rec.imageSha256Core}</Text>
      <Text style={styles.row}>
        Image in Firestore (base64 length): {rec.registeredImageBase64.length} chars (~
        {Math.round((rec.registeredImageBase64.length * 3) / 4 / 1024)} KiB raw)
      </Text>
      <Image
        accessibilityLabel="Registered JPEG from Firestore"
        source={{ uri: `data:image/jpeg;base64,${rec.registeredImageBase64}` }}
        style={styles.preview}
        resizeMode="contain"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { padding: 24, gap: 10, backgroundColor: '#f6f8f9' },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  row: { fontSize: 14, lineHeight: 20 },
  preview: { width: '100%', height: 280, borderRadius: 12, backgroundColor: '#e1e8ec' },
});
