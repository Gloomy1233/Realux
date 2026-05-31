import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadString } from 'firebase/storage';

import { getFirebaseStorage } from '@/lib/firebase/config';

export async function uploadJpegToStorage(uri: string, storagePath: string): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  await uploadString(ref(getFirebaseStorage(), storagePath), base64, 'base64', {
    contentType: 'image/jpeg',
    customMetadata: {
      realux: 'capture-proof-v2',
    },
  });
}
