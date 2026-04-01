import { z } from 'zod';

/** Product label for verification outcomes (do not use “AI detected”). */
export const VerificationResultLabelSchema = z.enum([
  'verified',
  'not_verified',
  'tampered_or_changed',
  'unknown_provenance',
]);

export type VerificationResultLabel = z.infer<typeof VerificationResultLabelSchema>;

export const EmbeddedVerificationPayloadSchema = z.object({
  mediaId: z.string().uuid(),
  rpcDigest: z.string().min(8),
  rpcDigestShort: z.string().min(4),
  checksum: z.string().min(4),
  version: z.string(),
  /** Echo fields for client-side recomputation */
  nonce: z.string(),
  createdAt: z.number().int(),
  userId: z.string(),
  deviceId: z.string(),
  verificationVersion: z.string(),
  /** SHA256 of core image bytes (base64, from expo-crypto), JPEG core before trailer. */
  imageSha256Core: z.string().min(32),
});

export type EmbeddedVerificationPayload = z.infer<typeof EmbeddedVerificationPayloadSchema>;

export const MediaRecordSchema = z.object({
  mediaId: z.string().uuid(),
  ownerUid: z.string(),
  deviceId: z.string(),
  /** Registered JPEG bytes (with embedded trailer), base64. Prototype only — Firestore ~1 MiB doc limit. */
  registeredImageBase64: z.string().min(1),
  sha256: z.string(),
  /** Full RPC digest as produced at registration time. */
  rpcDigest: z.string(),
  checksum: z.string(),
  createdAt: z.number().int(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mimeType: z.string(),
  verificationVersion: z.string(),
  embeddedPayloadPreview: z.object({
    mediaId: z.string(),
    rpcDigestShort: z.string(),
    checksum: z.string(),
    version: z.string(),
  }),
  nonce: z.string(),
  imageSha256Core: z.string(),
});

export type MediaRecord = z.infer<typeof MediaRecordSchema>;

/** List rows without the large base64 payload (see `listUserMedia`). */
export const MediaRecordSummarySchema = MediaRecordSchema.omit({ registeredImageBase64: true });
export type MediaRecordSummary = z.infer<typeof MediaRecordSummarySchema>;

export type VerificationDetail = {
  payloadFound: boolean;
  firestoreRecordFound: boolean;
  hashMatched: boolean;
  rpcDigestMatched: boolean;
  checksumMatched: boolean;
  mediaIdMatched: boolean;
  notes: string[];
};

export type VerificationOutcome = {
  label: VerificationResultLabel;
  details: VerificationDetail;
  mediaId?: string;
  firestoreRecord?: MediaRecord | null;
};
