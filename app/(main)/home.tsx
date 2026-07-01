import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.lead}>
        Capture a new image or video to register it with Firebase, or verify a file already on your device.
      </Text>
      <PrimaryButton title="Capture image" onPress={() => router.push('/capture')} />
      <SecondaryButton title="Capture video" onPress={() => router.push('/capture-video' as Href)} />
      <SecondaryButton title="Verify image" onPress={() => router.push('/verify')} />
      <SecondaryButton title="Verify video" onPress={() => router.push('/verify-video' as Href)} />
      <SecondaryButton title="Recent images" onPress={() => router.push('/history')} />
      <SecondaryButton title="Settings" onPress={() => router.push('/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 14, backgroundColor: '#f6f8f9' },
  lead: { fontSize: 16, lineHeight: 23, marginBottom: 8, color: '#333' },
});
