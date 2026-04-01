import { doc, getDoc } from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/config';
import { MediaRecordSchema, type MediaRecord } from '@/types/verification';

export async function fetchMediaRecord(mediaId: string): Promise<MediaRecord | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'media', mediaId));
  if (!snap.exists()) return null;
  const data = snap.data();
  const parsed = MediaRecordSchema.safeParse({
    ...data,
    _serverWriteAt: undefined,
  });
  if (!parsed.success) return null;
  return parsed.data;
}
