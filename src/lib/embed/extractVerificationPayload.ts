import * as FileSystem from 'expo-file-system/legacy';

import { parseTrailerPayload } from '@/lib/embed/embedCodec';
import { base64ToUint8Array } from '@/lib/media/hashImage';
import { EmbeddedVerificationPayloadSchema } from '@/types/verification';

export async function extractVerificationPayload(imageUri: string) {
  const b64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
  const raw = base64ToUint8Array(b64);
  const parsed = parseTrailerPayload(raw);
  if (!parsed) return { success: false as const, payload: null, error: 'No embedded trailer found' };
  const res = EmbeddedVerificationPayloadSchema.safeParse(parsed);
  if (!res.success) {
    return { success: false as const, payload: null, error: 'Invalid embedded payload shape' };
  }
  return { success: true as const, payload: res.data, error: null as string | null };
}
