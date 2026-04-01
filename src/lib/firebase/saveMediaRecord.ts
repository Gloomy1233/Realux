import { doc, setDoc } from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/config';
import type { MediaRecord } from '@/types/verification';

export async function saveMediaRecord(record: MediaRecord): Promise<void> {
  const db = getFirebaseDb();
  await setDoc(doc(db, 'media', record.mediaId), record);
}
