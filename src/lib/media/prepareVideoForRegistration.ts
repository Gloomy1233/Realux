import * as FileSystem from 'expo-file-system/legacy';

import { isMp4Container, readVideoBytes } from '@/lib/authenticity/mp4Proof';

export type PreparedVideo = {
  uri: string;
  width: number;
  height: number;
  durationMs: number;
};

/**
 * Copies a local MP4 into cache and validates the container before registration.
 */
export async function prepareVideoForRegistration(
  sourceUri: string,
  width: number,
  height: number,
  durationMs: number
): Promise<PreparedVideo> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory unavailable');
  }

  const dest = `${cacheDir}realux-video-${Date.now()}.mp4`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });

  const bytes = await readVideoBytes(dest);
  if (!isMp4Container(bytes)) {
    throw new Error('Selected file is not a valid MP4 video.');
  }

  return {
    uri: dest,
    width: width > 0 ? width : 1,
    height: height > 0 ? height : 1,
    durationMs: durationMs > 0 ? durationMs : 1,
  };
}
