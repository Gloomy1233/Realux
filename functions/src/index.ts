import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall, onRequest, type Request } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import type { Response } from 'express';

import { bytesToBase64Url, bytesToUtf8, canonicalJson } from './encoding.js';
import {
  decryptAes256Gcm,
  deriveSessionKey,
  generateP256KeyPair,
  hashCanonicalJson,
  keccak512Base64Url,
  publicKeyFromPrivate,
  randomBase64Url,
  signCertificate,
} from './crypto.js';
import { extractProofEnvelope, mimeTypeFromMetadata, stripKnownProofTrailers, contentTypeForMime } from './mediaProof.js';
import {
  CERTIFICATE_KEY_ID,
  CERTIFICATE_VERSION,
  CreateCaptureSessionRequestSchema,
  EncryptedProofPlaintextSchema,
  GetCertificateRequestSchema,
  RegisterCaptureRequestSchema,
  VerifyImageRequestSchema,
  VerifyVideoRequestSchema,
  type CertificatePayload,
  type MediaKind,
} from './schemas.js';

initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();

const SESSION_TTL_MS = 10 * 60 * 1000;
const HTTP_OPTIONS = { region: 'us-central1', invoker: 'public', cors: true } as const;
const CALLABLE_OPTIONS = { region: 'us-central1', invoker: 'public' } as const;
const PROTOTYPE_OWNER_UID = 'prototype-user';

function requestData(body: unknown): unknown {
  if (typeof body === 'string') {
    try {
      return requestData(JSON.parse(body));
    } catch {
      throw new HttpsError('invalid-argument', 'Request body must be valid JSON.');
    }
  }
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: unknown }).data;
  }
  return body;
}

function statusForErrorCode(code: string): number {
  switch (code) {
    case 'invalid-argument':
    case 'failed-precondition':
      return 400;
    case 'not-found':
      return 404;
    case 'permission-denied':
      return 403;
    default:
      return 500;
  }
}

function sendError(res: Response, e: unknown) {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'internal';
  const message = e instanceof Error ? e.message : 'Internal Server Error';
  logger.error('[realux] request failed', { code, message });
  res.status(statusForErrorCode(code)).json({ error: { status: code, message } });
}

function handleJsonRequest(
  req: Request,
  res: Response,
  handler: (data: unknown) => Promise<unknown>
) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  handler(requestData(req.body))
    .then((data) => res.status(200).json({ data }))
    .catch((e) => sendError(res, e));
}

async function readObjectBytes(storagePath: string): Promise<Uint8Array> {
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError('not-found', 'Uploaded image was not found in Cloud Storage.');
  }
  const [buf] = await file.download();
  return new Uint8Array(buf);
}

async function getCertificateSigningKey() {
  const ref = db.doc(`systemKeys/${CERTIFICATE_KEY_ID}`);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() as { privateKey: string; publicKey: string };
    return data;
  }
  const keys = generateP256KeyPair();
  await ref.set({
    ...keys,
    keyId: CERTIFICATE_KEY_ID,
    algorithm: 'ECDSA_P256_SHA256',
    createdAt: FieldValue.serverTimestamp(),
  });
  return keys;
}

async function createCaptureSessionData(data: unknown) {
  logger.info('createCaptureSession called', {
    dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
  });
  const input = CreateCaptureSessionRequestSchema.parse(data);
  const uid = input.ownerUid ?? PROTOTYPE_OWNER_UID;
  const mediaKind: MediaKind = input.mediaKind ?? 'image';
  const sessionId = crypto.randomUUID();
  const captureId = crypto.randomUUID();
  const serverKeys = generateP256KeyPair();
  const serverNonce = randomBase64Url(32);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const extension = mediaKind === 'video' ? 'mp4' : 'jpg';
  const storagePath = `captures/${uid}/${captureId}/registered.${extension}`;

  await db.doc(`captureSessions/${sessionId}`).set({
    sessionId,
    captureId,
    ownerUid: uid,
    deviceId: input.deviceId,
    mediaKind,
    serverPrivateKey: serverKeys.privateKey,
    serverPublicKey: serverKeys.publicKey,
    serverNonce,
    storagePath,
    status: 'created',
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });
  logger.info('createCaptureSession created session', {
    uid,
    sessionId,
    captureId,
    mediaKind,
    storagePath,
  });

  return {
    sessionId,
    captureId,
    serverPublicKey: serverKeys.publicKey,
    serverNonce,
    storagePath,
    mediaKind,
    expiresAt,
  };
}

export const createCaptureSessionPublic = onRequest(HTTP_OPTIONS, (req, res) => {
  return handleJsonRequest(req, res, createCaptureSessionData);
});

export const createCaptureSession = onCall(CALLABLE_OPTIONS, async (request) => {
  return createCaptureSessionData(request.data);
});

async function registerCaptureData(data: unknown) {
  const input = RegisterCaptureRequestSchema.parse(data);
  const sessionRef = db.doc(`captureSessions/${input.sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new HttpsError('not-found', 'Capture session does not exist.');
  }
  const session = sessionSnap.data() as {
    captureId: string;
    ownerUid: string;
    deviceId: string;
    serverPrivateKey: string;
    serverNonce: string;
    storagePath: string;
    status: string;
    expiresAt: number;
  };
  const uid = session.ownerUid ?? PROTOTYPE_OWNER_UID;
  if (session.captureId !== input.captureId || session.storagePath !== input.storagePath) {
    throw new HttpsError('permission-denied', 'Capture session does not match this upload.');
  }
  if (session.status !== 'created' || session.expiresAt < Date.now()) {
    throw new HttpsError('failed-precondition', 'Capture session is no longer valid.');
  }

  let raw: Uint8Array;
  const mimeType = mimeTypeFromMetadata(input.metadata);
  const contentType = contentTypeForMime(mimeType);
  const inlineBase64 = mimeType === 'video/mp4' ? input.videoBase64 : input.imageBase64;
  if (inlineBase64) {
    const buf = Buffer.from(inlineBase64, 'base64');
    raw = new Uint8Array(buf);
    await bucket.file(input.storagePath).save(buf, { contentType });
  } else {
    raw = await readObjectBytes(input.storagePath);
  }
  const envelope = extractProofEnvelope(raw, mimeType);
  if (!envelope) {
    throw new HttpsError('failed-precondition', 'No Realux proof envelope found in media file.');
  }
  if (
    envelope.captureId !== input.captureId ||
    envelope.sessionId !== input.sessionId ||
    envelope.clientPublicKey !== input.clientPublicKey
  ) {
    throw new HttpsError('failed-precondition', 'Embedded proof does not match registration request.');
  }

  const sessionKey = deriveSessionKey({
    privateKey: session.serverPrivateKey,
    peerPublicKey: input.clientPublicKey,
    salt: session.serverNonce,
    info: `realux-capture:${input.captureId}`,
  });
  const plaintextBytes = decryptAes256Gcm({
    key: sessionKey,
    nonce: envelope.nonce,
    ciphertext: envelope.ciphertext,
    aad: `${input.captureId}:${input.sessionId}`,
  });
  const proof = EncryptedProofPlaintextSchema.parse(JSON.parse(bytesToUtf8(plaintextBytes)));

  const coreBytes = stripKnownProofTrailers(raw, mimeType);
  const imageHash = keccak512Base64Url(coreBytes);
  const fullFileHash = keccak512Base64Url(raw);
  const metadataHash = hashCanonicalJson(input.metadata);
  if (
    proof.ownerUid !== uid ||
    proof.deviceId !== input.metadata.deviceId ||
    proof.serverNonce !== session.serverNonce ||
    proof.imageHash !== imageHash ||
    proof.metadataHash !== metadataHash
  ) {
    throw new HttpsError('failed-precondition', 'Encrypted proof does not match uploaded media.');
  }

  const signingKey = await getCertificateSigningKey();
  const issuedAt = Date.now();
  const certificatePayload: CertificatePayload = {
    version: CERTIFICATE_VERSION,
    captureId: input.captureId,
    ownerUid: uid,
    deviceId: input.metadata.deviceId,
    imageHash,
    fullFileHash,
    metadataHash,
    storagePath: input.storagePath,
    issuedAt,
    status: 'verified_realux_capture',
  };
  const signature = signCertificate(certificatePayload, signingKey.privateKey);
  const certificateId = input.captureId;
  const proofHash = keccak512Base64Url(new TextEncoder().encode(canonicalJson(envelope)));

  await db.runTransaction(async (tx) => {
    tx.set(db.doc(`captures/${input.captureId}`), {
      captureId: input.captureId,
      ownerUid: uid,
      deviceId: input.metadata.deviceId,
      storagePath: input.storagePath,
      imageHash,
      fullFileHash,
      metadataHash,
      proofHash,
      certificateId,
      status: 'registered',
      createdAt: issuedAt,
      metadata: input.metadata,
      _serverWriteAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`certificates/${certificateId}`), {
      certificateId,
      captureId: input.captureId,
      ownerUid: uid,
      payload: certificatePayload,
      signature,
      signatureAlgorithm: 'ECDSA_P256_SHA256',
      keyId: CERTIFICATE_KEY_ID,
      publicKey: publicKeyFromPrivate(signingKey.privateKey),
      issuedAt,
      _serverWriteAt: FieldValue.serverTimestamp(),
    });
    tx.update(sessionRef, { status: 'registered', registeredAt: FieldValue.serverTimestamp() });
  });

  return {
    captureId: input.captureId,
    certificateId,
    verdict: 'verified_realux_capture',
    signature,
    keyId: CERTIFICATE_KEY_ID,
  };
}

export const registerCapturePublic = onRequest(HTTP_OPTIONS, (req, res) => {
  return handleJsonRequest(req, res, registerCaptureData);
});

export const registerCapture = onCall(CALLABLE_OPTIONS, async (request) => {
  return registerCaptureData(request.data);
});

async function verifyMediaData(data: unknown, mediaKind: MediaKind) {
  const input =
    mediaKind === 'video'
      ? VerifyVideoRequestSchema.parse(data)
      : VerifyImageRequestSchema.parse(data);
  const mimeType = mediaKind === 'video' ? 'video/mp4' : 'image/jpeg';
  const inlineBase64 =
    mediaKind === 'video'
      ? 'videoBase64' in input
        ? input.videoBase64
        : undefined
      : 'imageBase64' in input
        ? input.imageBase64
        : undefined;
  const raw = input.storagePath
    ? await readObjectBytes(input.storagePath)
    : new Uint8Array(Buffer.from(inlineBase64 ?? '', 'base64'));
  const reasons: string[] = [];
  const envelope = extractProofEnvelope(raw, mimeType);
  if (!envelope) {
    return {
      verdict: 'unknown_provenance',
      confidence: 0,
      mediaKind,
      reasons: ['No Realux proof envelope found.'],
    };
  }

  const recordSnap = await db.doc(`captures/${envelope.captureId}`).get();
  if (!recordSnap.exists) {
    return {
      verdict: 'unknown_provenance',
      confidence: 0,
      captureId: envelope.captureId,
      mediaKind,
      reasons: ['No backend capture record.'],
    };
  }
  const record = recordSnap.data() as {
    ownerUid: string;
    imageHash: string;
    fullFileHash: string;
    storagePath: string;
    certificateId: string;
    status: string;
    metadata?: { mimeType?: string };
  };
  const imageHash = keccak512Base64Url(stripKnownProofTrailers(raw, mimeType));
  const fullFileHash = keccak512Base64Url(raw);
  const imageHashOk = imageHash === record.imageHash;
  const fullFileHashOk = fullFileHash === record.fullFileHash;
  if (!imageHashOk) reasons.push('Canonical media hash changed.');
  if (!fullFileHashOk) reasons.push('Exact file bytes changed or were re-encoded.');
  if (record.status !== 'registered') reasons.push('Capture record is not currently registered.');
  if (record.metadata?.mimeType && record.metadata.mimeType !== mimeType) {
    reasons.push('Media type does not match the registered capture record.');
  }

  const verdict = imageHashOk && fullFileHashOk && record.status === 'registered'
    ? 'verified_realux_capture'
    : 'tampered_or_changed';
  const confidence = verdict === 'verified_realux_capture' ? 0.98 : imageHashOk ? 0.55 : 0.1;

  await db.collection('verificationEvents').add({
    uid: record.ownerUid ?? PROTOTYPE_OWNER_UID,
    captureId: envelope.captureId,
    verdict,
    confidence,
    mediaKind,
    reasons,
    clientStoragePath: input.storagePath ?? null,
    createdAt: Timestamp.now(),
  });

  return {
    verdict,
    confidence,
    captureId: envelope.captureId,
    certificateId: record.certificateId,
    mediaKind,
    checks: {
      proofFound: true,
      backendRecordFound: true,
      imageHashOk,
      fullFileHashOk,
    },
    reasons: reasons.length ? reasons : ['All backend checks matched this Realux capture.'],
  };
}

async function verifyImageData(data: unknown) {
  return verifyMediaData(data, 'image');
}

async function verifyVideoData(data: unknown) {
  return verifyMediaData(data, 'video');
}

export const verifyImagePublic = onRequest(HTTP_OPTIONS, (req, res) => {
  return handleJsonRequest(req, res, verifyImageData);
});

export const verifyImage = onCall(CALLABLE_OPTIONS, async (request) => {
  return verifyImageData(request.data);
});

export const verifyVideoPublic = onRequest(HTTP_OPTIONS, (req, res) => {
  return handleJsonRequest(req, res, verifyVideoData);
});

export const verifyVideo = onCall(CALLABLE_OPTIONS, async (request) => {
  return verifyVideoData(request.data);
});

async function getCertificateData(data: unknown) {
  const input = GetCertificateRequestSchema.parse(data);
  const snap = await db.doc(`certificates/${input.captureId}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Certificate not found.');
  }
  return snap.data();
}

export const getCertificatePublic = onRequest(HTTP_OPTIONS, (req, res) => {
  return handleJsonRequest(req, res, getCertificateData);
});

export const getCertificate = onCall(CALLABLE_OPTIONS, async (request) => {
  return getCertificateData(request.data);
});
