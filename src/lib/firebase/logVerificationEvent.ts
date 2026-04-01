import { collection, addDoc } from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/config';
import type { VerificationResultLabel } from '@/types/verification';

export async function logVerificationEvent(params: {
  uid: string;
  mediaId: string | undefined;
  label: VerificationResultLabel;
  detailsJson: object;
}) {
  const db = getFirebaseDb();
  await addDoc(collection(db, 'verificationEvents'), {
    uid: params.uid,
    mediaId: params.mediaId ?? null,
    label: params.label,
    details: params.detailsJson,
    clientTs: Date.now(),
  });
}
