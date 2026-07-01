import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

export type SaveToLibraryResult =
  | { ok: true; assetId?: string }
  | { ok: false; reason: string };

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
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    return { ok: true, assetId: asset.id };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Could not save the photo to your gallery.',
    };
  }
}

/**
 * Writes a local MP4 into the system photo library.
 */
export async function saveVideoToLibrary(fileUri: string): Promise<SaveToLibraryResult> {
  if (Platform.OS === 'web') {
    return { ok: true };
  }

  let access = await MediaLibrary.getPermissionsAsync(true);
  if (!access.granted) {
    access = await MediaLibrary.requestPermissionsAsync(true);
  }
  if (!access.granted) {
    return { ok: false, reason: 'Photo library access was denied, so the video was not saved to your gallery.' };
  }

  try {
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    return { ok: true, assetId: asset.id };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Could not save the video to your gallery.',
    };
  }
}
