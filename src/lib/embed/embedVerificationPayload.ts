import * as FileSystem from 'expo-file-system/legacy';

import { buildTrailerBytes, findTrailerIndex } from '@/lib/embed/embedCodec';
import { base64ToUint8Array, uint8ArrayToBase64 } from '@/lib/media/hashImage';
import type { EmbeddedVerificationPayload } from '@/types/verification';

/**
 * Append a compact JSON payload after the image bytes (trailer strategy).
 * Limitation: some platforms re-encode uploads and strip trailers—see README.
 * TODO(production): server-side canonical bytes + signed manifest instead of trailers only.
 */
export async function embedVerificationPayload(
  imageUri: string,
  payload: EmbeddedVerificationPayload
): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
  let raw = base64ToUint8Array(b64);
  const idx = findTrailerIndex(raw);
  if (idx >= 0) {
    raw = raw.slice(0, idx);
  }
  const trailer = buildTrailerBytes(payload);
  const out = new Uint8Array(raw.length + trailer.length);
  out.set(raw);
  out.set(trailer, raw.length);
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory unavailable');
  }
  const outPath = `${cacheDir}realux-emb-${payload.mediaId}.jpg`;
  await FileSystem.writeAsStringAsync(outPath, uint8ArrayToBase64(out), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outPath;
}
