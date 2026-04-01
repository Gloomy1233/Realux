import { doc, setDoc } from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/config';

export async function ensureUserAndDeviceDocs(params: { uid: string; deviceId: string; email: string | null }) {
  const db = getFirebaseDb();
  const ts = Date.now();
  await setDoc(
    doc(db, 'users', params.uid),
    {
      uid: params.uid,
      email: params.email,
      updatedAt: ts,
    },
    { merge: true }
  );
  await setDoc(
    doc(db, 'devices', params.deviceId),
    {
      deviceId: params.deviceId,
      ownerUid: params.uid,
      updatedAt: ts,
    },
    { merge: true }
  );
}
