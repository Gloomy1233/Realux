import { embedProofEnvelope as embedJpegProof, extractProofEnvelope as extractJpegProof, stripKnownProofTrailers as stripJpegProof } from '@/lib/authenticity/jpegProof';
import { embedProofEnvelope as embedMp4Proof, extractProofEnvelope as extractMp4Proof, stripKnownProofTrailers as stripMp4Proof } from '@/lib/authenticity/mp4Proof';
import type { EmbeddedProofEnvelope } from '@/types/authenticity';
import type { MediaMimeType } from '@/types/authenticity';

export function stripKnownProofTrailers(raw: Uint8Array, mimeType: MediaMimeType): Uint8Array {
  return mimeType === 'video/mp4' ? stripMp4Proof(raw) : stripJpegProof(raw);
}

export function embedProofEnvelope(raw: Uint8Array, envelope: EmbeddedProofEnvelope, mimeType: MediaMimeType): Uint8Array {
  return mimeType === 'video/mp4' ? embedMp4Proof(raw, envelope) : embedJpegProof(raw, envelope);
}

export function extractProofEnvelope(raw: Uint8Array, mimeType?: MediaMimeType): EmbeddedProofEnvelope | null {
  if (mimeType === 'video/mp4') return extractMp4Proof(raw);
  if (mimeType === 'image/jpeg') return extractJpegProof(raw);

  const mp4 = extractMp4Proof(raw);
  if (mp4) return mp4;
  return extractJpegProof(raw);
}
