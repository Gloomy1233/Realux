import * as FileSystem from 'expo-file-system/legacy';

import { callPublicFunction } from '@/lib/authenticity/sessionClient';
import { VerificationServerResponseSchema, type VerificationServerResponse } from '@/types/authenticity';

export async function verifyVideoWithBackend(params: {
  localUri: string;
  uid: string;
}): Promise<VerificationServerResponse> {
  const videoBase64 = await FileSystem.readAsStringAsync(params.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const res = await callPublicFunction('verifyVideoPublic', { videoBase64 });
  return VerificationServerResponseSchema.parse(res);
}
