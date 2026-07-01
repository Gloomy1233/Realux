import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadString } from 'firebase/storage';

import { getFirebaseStorage } from '@/lib/firebase/config';

/** React Native–compatible Storage upload (uploadBytes/Blob is not supported). */
export async function uploadMp4ToStorage(uri: string, storagePath: string): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  await uploadString(ref(getFirebaseStorage(), storagePath), base64, 'base64', {
    contentType: 'video/mp4',
    customMetadata: {
      realux: 'capture-proof-v2',
    },
  });
}
