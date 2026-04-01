import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

export type SaveToLibraryResult = { ok: true } | { ok: false; reason: string };

/**
 * Writes a local image file into the system photo library so it appears in Gallery / Photos.
 */
export async function saveCaptureToPhotoLibrary(fileUri: string): Promise<SaveToLibraryResult> {
  if (Platform.OS === 'web') {
    return { ok: true };
  }

  let access = await MediaLibrary.getPermissionsAsync(true);
  if (!access.granted) {
    access = await MediaLibrary.requestPermissionsAsync(true);
  }
  if (!access.granted) {
    return { ok: false, reason: 'Photo library access was denied, so the image was not saved to your gallery.' };
  }

  try {
    await MediaLibrary.saveToLibraryAsync(fileUri);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Could not save the photo to your gallery.',
    };
  }
}
