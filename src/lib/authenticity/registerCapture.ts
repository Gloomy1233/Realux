import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { canonicalJson, utf8ToBytes } from '@/lib/authenticity/encoding';
import {
  deriveSessionKey,
  encryptAes256Gcm,
  generateClientKeyPair,
  hashCanonicalJson,
  keccak512Base64Url,
  randomNonceBase64Url,
} from '@/lib/authenticity/crypto';
import { appendProofEnvelope, readImageBytes, stripKnownProofTrailers } from '@/lib/authenticity/jpegProof';
import * as FileSystem from 'expo-file-system/legacy';

import { commitCaptureRegistration, createCaptureSessionForOwner } from '@/lib/authenticity/sessionClient';
import { saveProofToVault } from '@/lib/authenticity/proofVault';
import { prepareJpegForFirestore } from '@/lib/media/prepareImageForFirestoreRegistration';
import { saveCaptureToPhotoLibrary } from '@/lib/media/saveCaptureToLibrary';
import { PROOF_VERSION, type CaptureMetadata } from '@/types/authenticity';

export async function registerCaptureWithBackend(params: {
  localUri: string;
  uid: string;
  deviceId: string;
  width: number;
  height: number;
}): Promise<{ captureId: string; certificateId: string; verdict: 'verified_realux_capture'; savedUri: string }> {
  const prepped = await prepareJpegForFirestore(params.localUri, params.width, params.height, 2048, 0.82);
  const session = await createCaptureSessionForOwner(params.deviceId, params.uid);
  const clientKeys = generateClientKeyPair();
  const sessionKey = deriveSessionKey({
    privateKey: clientKeys.privateKey,
    peerPublicKey: session.serverPublicKey,
    salt: session.serverNonce,
    info: `realux-capture:${session.captureId}`,
  });

  const metadata: CaptureMetadata = {
    width: prepped.width,
    height: prepped.height,
    mimeType: 'image/jpeg',
    appVersion: Constants.expoConfig?.version ?? 'dev',
    deviceId: params.deviceId,
    capturedAt: Date.now(),
    platform: Platform.OS,
  };
  const imageHash = keccak512Base64Url(stripKnownProofTrailers(await readImageBytes(prepped.uri)));
  const metadataHash = hashCanonicalJson(metadata);
  const encryptedPlaintext = {
    version: PROOF_VERSION,
    captureId: session.captureId,
    sessionId: session.sessionId,
    ownerUid: params.uid,
    deviceId: params.deviceId,
    imageHash,
    metadataHash,
    serverNonce: session.serverNonce,
    issuedAt: Date.now(),
  };
  const nonce = randomNonceBase64Url(12);
  const ciphertext = encryptAes256Gcm({
    key: sessionKey,
    nonce,
    plaintext: utf8ToBytes(canonicalJson(encryptedPlaintext)),
    aad: `${session.captureId}:${session.sessionId}`,
  });
  const proofUri = await appendProofEnvelope(prepped.uri, {
    version: PROOF_VERSION,
    captureId: session.captureId,
    sessionId: session.sessionId,
    keyId: 'p256-ecdh-aes256gcm-v1',
    clientPublicKey: clientKeys.publicKey,
    nonce,
    ciphertext,
  });

  const imageBase64 = await FileSystem.readAsStringAsync(proofUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const registered = await commitCaptureRegistration({
    captureId: session.captureId,
    sessionId: session.sessionId,
    storagePath: session.storagePath,
    clientPublicKey: clientKeys.publicKey,
    metadata,
    imageBase64,
  });

  if (Platform.OS !== 'web') {
    const saved = await saveCaptureToPhotoLibrary(proofUri);
    await saveProofToVault(
      session.captureId,
      proofUri,
      saved.ok ? saved.assetId : undefined
    );
    if (!saved.ok) {
      console.warn('[Realux] Registered in backend but could not save proof image to gallery:', saved.reason);
    }
  } else {
    await saveProofToVault(session.captureId, proofUri);
  }

  return {
    captureId: registered.captureId,
    certificateId: registered.certificateId,
    verdict: registered.verdict,
    savedUri: proofUri,
  };
}
