import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { embedVerificationPayload } from '@/lib/embed/embedVerificationPayload';
import { saveMediaRecord } from '@/lib/firebase/saveMediaRecord';
import { createVerificationPackage } from '@/lib/rpc/rpcVerifier';
import { sha256File, sha256ImageCore } from '@/lib/media/hashImage';
import { saveCaptureToPhotoLibrary } from '@/lib/media/saveCaptureToLibrary';
import { VERIFICATION_PIPELINE_VERSION } from '@/lib/security/deviceSecrets';
import type { EmbeddedVerificationPayload } from '@/types/verification';

const FIRESTORE_DOC_MAX_BYTES = 1_048_576;

export async function registerCaptureWithFirebase(params: {
  localUri: string;
  uid: string;
  deviceId: string;
  deviceSecret: string;
  width: number;
  height: number;
}): Promise<{ mediaId: string }> {
  const mediaId = uuidv4();
  const createdAt = Date.now();
  const nonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${mediaId}|${createdAt}|${Math.random()}`
  );

  const imageSha256Core = await sha256ImageCore(params.localUri);

  const pkg = await createVerificationPackage({
    imageSha256Core,
    mediaId,
    createdAt,
    nonce,
    userId: params.uid,
    deviceId: params.deviceId,
    verificationVersion: VERIFICATION_PIPELINE_VERSION,
    deviceSecret: params.deviceSecret,
  });

  const embedded: EmbeddedVerificationPayload = {
    mediaId: pkg.mediaId,
    rpcDigest: pkg.rpcDigest,
    rpcDigestShort: pkg.rpcDigestShort,
    checksum: pkg.checksum,
    version: pkg.version,
    nonce: pkg.nonce,
    createdAt: pkg.createdAt,
    userId: pkg.userId,
    deviceId: pkg.deviceId,
    verificationVersion: pkg.verificationVersion,
    imageSha256Core: pkg.imageSha256Core,
  };

  const outUri = await embedVerificationPayload(params.localUri, embedded);
  const fullSha = await sha256File(outUri);

  const registeredImageBase64 = await FileSystem.readAsStringAsync(outUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const approxDocBytes = registeredImageBase64.length * 0.75 + 4096;
  if (approxDocBytes > FIRESTORE_DOC_MAX_BYTES) {
    throw new Error(
      'Image is too large for a single Firestore document after encoding (~1 MiB limit). Reduce capture quality or use Storage again later.'
    );
  }

  await saveMediaRecord({
    mediaId,
    ownerUid: params.uid,
    deviceId: params.deviceId,
    registeredImageBase64,
    sha256: fullSha,
    rpcDigest: pkg.rpcDigest,
    checksum: pkg.checksum,
    createdAt,
    width: params.width,
    height: params.height,
    mimeType: 'image/jpeg',
    verificationVersion: VERIFICATION_PIPELINE_VERSION,
    embeddedPayloadPreview: {
      mediaId,
      rpcDigestShort: pkg.rpcDigestShort,
      checksum: pkg.checksum,
      version: pkg.version,
    },
    nonce,
    imageSha256Core,
  });

  if (Platform.OS !== 'web') {
    const saved = await saveCaptureToPhotoLibrary(outUri);
    if (!saved.ok) {
      console.warn('[Realux] Registered in Firebase but could not save to gallery:', saved.reason);
    }
  }

  return { mediaId };
}
