import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#f6f8f9' },
        headerTintColor: '#0d3d3d',
      }}>
      <Stack.Screen name="home" options={{ title: 'Realux' }} />
      <Stack.Screen name="capture" options={{ title: 'Capture' }} />
      <Stack.Screen name="process" options={{ title: 'Processing', headerBackTitle: 'Back' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify image' }} />
      <Stack.Screen name="verify-result" options={{ title: 'Verification result' }} />
      <Stack.Screen name="history" options={{ title: 'Recent images' }} />
      <Stack.Screen name="history/[mediaId]" options={{ title: 'Media detail' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
