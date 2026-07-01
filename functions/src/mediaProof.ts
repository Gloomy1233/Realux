import {
  embedProofEnvelope as embedJpegProof,
  extractProofEnvelope as extractJpegProof,
  stripKnownProofTrailers as stripJpegProof,
} from './jpegProof.js';
import { embedProofEnvelope as embedMp4Proof, extractProofEnvelope as extractMp4Proof, stripKnownProofTrailers as stripMp4Proof } from './mp4Proof.js';

export type MediaMimeType = 'image/jpeg' | 'video/mp4';

export function mimeTypeFromMetadata(metadata: { mimeType: string }): MediaMimeType {
  if (metadata.mimeType === 'video/mp4') return 'video/mp4';
  return 'image/jpeg';
}

export function stripKnownProofTrailers(raw: Uint8Array, mimeType: MediaMimeType): Uint8Array {
  return mimeType === 'video/mp4' ? stripMp4Proof(raw) : stripJpegProof(raw);
}

export function embedProofEnvelope(raw: Uint8Array, envelope: unknown, mimeType: MediaMimeType): Uint8Array {
  return mimeType === 'video/mp4' ? embedMp4Proof(raw, envelope) : embedJpegProof(raw, envelope);
}

export function extractProofEnvelope(raw: Uint8Array, mimeType?: MediaMimeType) {
  if (mimeType === 'video/mp4') return extractMp4Proof(raw);
  if (mimeType === 'image/jpeg') return extractJpegProof(raw);

  const mp4 = extractMp4Proof(raw);
  if (mp4) return mp4;
  return extractJpegProof(raw);
}

export function contentTypeForMime(mimeType: MediaMimeType): string {
  return mimeType;
}
