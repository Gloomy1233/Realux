import * as FileSystem from 'expo-file-system/legacy';

/**
 * Camera / ImagePicker often return URIs under dirs the OS or Expo may clean up before the next screen runs.
 * Copy into our cache so hashing + embedding can read the file reliably.
 */
export async function persistCameraCaptureToCache(sourceUri: string): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory unavailable');
  }
  const dest = `${cacheDir}realux-capture-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}
