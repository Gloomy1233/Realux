import { extractVerificationPayload } from '@/lib/embed/extractVerificationPayload';
import { fetchMediaRecord } from '@/lib/firebase/fetchMediaRecord';
import { sha256File, sha256ImageCore } from '@/lib/media/hashImage';
import {
  buildRpcDigestInput,
  computeVerificationChecksum,
  createRpcDigest,
} from '@/lib/rpc/rpcVerifier';
import type { MediaRecord, VerificationDetail, VerificationOutcome } from '@/types/verification';

function fillRpcDigestRecord(record: MediaRecord): Uint8Array {
  return buildRpcDigestInput({
    imageSha256Core: record.imageSha256Core,
    mediaId: record.mediaId,
    createdAt: record.createdAt,
    nonce: record.nonce,
    userId: record.ownerUid,
    deviceId: record.deviceId,
    verificationVersion: record.verificationVersion,
  });
}

function emptyDetails(): VerificationDetail {
  return {
    payloadFound: false,
    firestoreRecordFound: false,
    hashMatched: false,
    rpcDigestMatched: false,
    checksumMatched: false,
    mediaIdMatched: false,
    notes: [],
  };
}

/**
 * Client-side verification: confirms the selected file still matches a `media` record
 * authored through this app prototype (not cryptographic provenance in the strong sense).
 */
export async function verifyImageAgainstFirebase(params: {
  localUri: string;
  deviceSecret: string;
}): Promise<VerificationOutcome> {
  const details = emptyDetails();
  const ext = await extractVerificationPayload(params.localUri);
  if (!ext.success || !ext.payload) {
    details.notes.push(ext.error ?? 'No embedded registration data found.');
    return { label: 'unknown_provenance', details, mediaId: undefined };
  }
  details.payloadFound = true;
  const payload = ext.payload;

  const record = await fetchMediaRecord(payload.mediaId);
  if (!record) {
    details.notes.push('No Firebase record for this mediaId.');
    return { label: 'not_verified', details, mediaId: payload.mediaId };
  }
  details.firestoreRecordFound = true;
  details.mediaIdMatched = payload.mediaId === record.mediaId;

  const fullHash = await sha256File(params.localUri);
  const coreHash = await sha256ImageCore(params.localUri);

  details.hashMatched = fullHash === record.sha256 && coreHash === record.imageSha256Core;
  if (coreHash !== payload.imageSha256Core) {
    details.notes.push('Core image hash does not match embedded payload (re-encoding or truncation suspected).');
  }
  if (fullHash !== record.sha256) {
    details.notes.push('Full file hash does not match stored registration bytes.');
  }

  const digestInput = fillRpcDigestRecord(record);
  const recomputed = createRpcDigest(digestInput, params.deviceSecret);

  details.rpcDigestMatched = recomputed === record.rpcDigest && payload.rpcDigest === record.rpcDigest;
  if (!details.rpcDigestMatched) {
    details.notes.push('RPC digest mismatch (secret rotation, tampering, or different device binding).');
  }

  const checksumExpected = await computeVerificationChecksum({
    mediaId: record.mediaId,
    imageSha256Core: record.imageSha256Core,
    createdAt: record.createdAt,
    nonce: record.nonce,
    userId: record.ownerUid,
    deviceId: record.deviceId,
    verificationVersion: record.verificationVersion,
    rpcDigest: recomputed,
  });
  details.checksumMatched =
    checksumExpected === record.checksum && checksumExpected === payload.checksum;
  if (!details.checksumMatched) {
    details.notes.push('Checksum mismatch.');
  }

  if (payload.userId !== record.ownerUid) {
    details.notes.push('Embedded user id does not match record owner.');
  }

  const ownerOk = payload.userId === record.ownerUid;

  const allMatch =
    details.payloadFound &&
    details.firestoreRecordFound &&
    details.mediaIdMatched &&
    details.hashMatched &&
    details.rpcDigestMatched &&
    details.checksumMatched &&
    ownerOk;

  if (allMatch) {
    details.notes.push('All checks matched the stored registration for this app.');
    return { label: 'verified', details, mediaId: payload.mediaId, firestoreRecord: record };
  }

  if (details.payloadFound && details.firestoreRecordFound) {
    return { label: 'tampered_or_changed', details, mediaId: payload.mediaId, firestoreRecord: record };
  }

  return { label: 'not_verified', details, mediaId: payload.mediaId, firestoreRecord: record };
}
