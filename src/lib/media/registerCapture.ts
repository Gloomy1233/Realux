import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { embedVerificationPayload } from '@/lib/embed/embedVerificationPayload';
import { saveMediaRecord } from '@/lib/firebase/saveMediaRecord';
import {
  MAX_EMBEDDED_IMAGE_BASE64_CHARS,
  prepareJpegForFirestore,
} from '@/lib/media/prepareImageForFirestoreRegistration';
import { createVerificationPackage } from '@/lib/rpc/rpcVerifier';
import { sha256File, sha256ImageCore } from '@/lib/media/hashImage';
import { saveCaptureToPhotoLibrary } from '@/lib/media/saveCaptureToLibrary';
import { VERIFICATION_PIPELINE_VERSION } from '@/lib/security/deviceSecrets';
import type { EmbeddedVerificationPayload } from '@/types/verification';

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

  let maxEdge = 2048;
  let compress = 0.8;
  let workUri = params.localUri;
  let workW = params.width;
  let workH = params.height;
  let registeredImageBase64 = '';
  let fullSha = '';
  let pkg!: Awaited<ReturnType<typeof createVerificationPackage>>;
  let outUri = '';

  for (let attempt = 0; attempt < 16; attempt++) {
    const prepped = await prepareJpegForFirestore(
      params.localUri,
      params.width,
      params.height,
      maxEdge,
      compress
    );
    workUri = prepped.uri;
    workW = prepped.width;
    workH = prepped.height;

    const imageSha256Core = await sha256ImageCore(workUri);

    pkg = await createVerificationPackage({
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

    outUri = await embedVerificationPayload(workUri, embedded);
    fullSha = await sha256File(outUri);

    registeredImageBase64 = await FileSystem.readAsStringAsync(outUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (registeredImageBase64.length <= MAX_EMBEDDED_IMAGE_BASE64_CHARS) {
      break;
    }

    maxEdge = Math.max(640, Math.floor(maxEdge * 0.88));
    compress = Math.max(0.48, compress - 0.055);
  }

  if (registeredImageBase64.length > MAX_EMBEDDED_IMAGE_BASE64_CHARS) {
    throw new Error(
      'Image is still too large for Firestore (1 MiB document limit) after compression. Try a darker scene or lower resolution capture.'
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
    width: workW,
    height: workH,
    mimeType: 'image/jpeg',
    verificationVersion: VERIFICATION_PIPELINE_VERSION,
    embeddedPayloadPreview: {
      mediaId,
      rpcDigestShort: pkg.rpcDigestShort,
      checksum: pkg.checksum,
      version: pkg.version,
    },
    nonce,
    imageSha256Core: pkg.imageSha256Core,
  });

  if (Platform.OS !== 'web') {
    const saved = await saveCaptureToPhotoLibrary(outUri);
    if (!saved.ok) {
      console.warn('[Realux] Registered in Firebase but could not save to gallery:', saved.reason);
    }
  }

  return { mediaId };
}
