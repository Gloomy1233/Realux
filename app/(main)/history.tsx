import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { listUserMedia } from '@/lib/firebase/listUserMedia';
import { useSessionStore } from '@/store/sessionStore';
import type { MediaRecordSummary } from '@/types/verification';

export default function HistoryScreen() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const [items, setItems] = useState<MediaRecordSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setRefreshing(true);
    try {
      const m = await listUserMedia(user.uid);
      setItems(m);
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.mediaId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No registered images yet. Capture one from the home screen.</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/history/${item.mediaId}`)}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.mediaId}
            </Text>
            <Text style={styles.meta}>
              {new Date(item.createdAt).toLocaleString()} · {item.width}×{item.height}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f6f8f9' },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e8ec',
  },
  cardTitle: { fontFamily: 'monospace', fontSize: 13 },
  meta: { marginTop: 6, fontSize: 13, opacity: 0.75 },
  empty: { textAlign: 'center', margin: 24, fontSize: 15, opacity: 0.8 },
});
