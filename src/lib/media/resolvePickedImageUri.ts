import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

import { findVaultEntryByPhotosAssetId } from '@/lib/authenticity/proofVault';
import { persistCameraCaptureToCache } from '@/lib/media/persistCaptureUri';

type PickedAsset = {
  uri: string;
  assetId?: string | null;
};

/**
 * iOS often re-encodes gallery picks and drops Realux proof bytes. Prefer the
 * Photos sandbox file when available, or a locally vaulted copy from registration.
 */
export async function resolvePickedImageUri(asset: PickedAsset): Promise<string> {
  if (Platform.OS === 'ios' && asset.assetId) {
    const vaulted = await findVaultEntryByPhotosAssetId(asset.assetId);
    if (vaulted) {
      return vaulted.uri;
    }

    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset.assetId, {
        shouldDownloadFromNetwork: true,
      });
      if (info.localUri) {
        return persistCameraCaptureToCache(info.localUri);
      }
    } catch {
      // Fall back to the picker-provided URI below.
    }
  }

  return persistCameraCaptureToCache(asset.uri);
}
