import { collection, getDocs, query, where } from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/config';
import { MediaRecordSummarySchema, type MediaRecordSummary } from '@/types/verification';

export async function listUserMedia(uid: string): Promise<MediaRecordSummary[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, 'media'), where('ownerUid', '==', uid));
  const snap = await getDocs(q);
  const out: MediaRecordSummary[] = [];
  snap.forEach((docSnap) => {
    const parsed = MediaRecordSummarySchema.safeParse(docSnap.data());
    if (parsed.success) out.push(parsed.data);
  });
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}
