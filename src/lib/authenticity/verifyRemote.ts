import * as FileSystem from 'expo-file-system/legacy';

import { callPublicFunction } from '@/lib/authenticity/sessionClient';
import { VerificationServerResponseSchema, type VerificationServerResponse } from '@/types/authenticity';

export async function verifyImageWithBackend(params: {
  localUri: string;
  uid: string;
}): Promise<VerificationServerResponse> {
  const imageBase64 = await FileSystem.readAsStringAsync(params.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const res = await callPublicFunction('verifyImagePublic', { imageBase64 });
  return VerificationServerResponseSchema.parse(res);
}
