import { z } from 'zod';

export const PROOF_VERSION = 'realux-proof-v2';
export const CERTIFICATE_VERSION = 'realux-certificate-v1';

export const MediaKindSchema = z.enum(['image', 'video']);
export type MediaKind = z.infer<typeof MediaKindSchema>;
export type MediaMimeType = 'image/jpeg' | 'video/mp4';

export const CaptureMetadataSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    mimeType: z.enum(['image/jpeg', 'video/mp4']),
    durationMs: z.number().int().positive().optional(),
    appVersion: z.string().min(1),
    deviceId: z.string().min(8),
    capturedAt: z.number().int().positive(),
    platform: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.mimeType === 'video/mp4' && !data.durationMs) {
      ctx.addIssue({
        code: 'custom',
        message: 'durationMs is required for video captures.',
        path: ['durationMs'],
      });
    }
  });

export const CaptureSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  captureId: z.string().uuid(),
  serverPublicKey: z.string(),
  serverNonce: z.string(),
  storagePath: z.string(),
  mediaKind: MediaKindSchema.optional(),
  expiresAt: z.number().int().positive(),
});

export const RegisterCaptureResponseSchema = z.object({
  captureId: z.string().uuid(),
  certificateId: z.string(),
  verdict: z.literal('verified_realux_capture'),
  signature: z.string(),
  keyId: z.string(),
});

export const EmbeddedProofEnvelopeSchema = z.object({
  version: z.literal(PROOF_VERSION),
  captureId: z.string().uuid(),
  sessionId: z.string().uuid(),
  keyId: z.string(),
  clientPublicKey: z.string(),
  nonce: z.string(),
  ciphertext: z.string(),
});

export const VerificationServerResponseSchema = z.object({
  verdict: z.enum(['verified_realux_capture', 'tampered_or_changed', 'unknown_provenance', 'suspicious']),
  confidence: z.number().min(0).max(1),
  captureId: z.string().uuid().optional(),
  certificateId: z.string().optional(),
  mediaKind: MediaKindSchema.optional(),
  checks: z
    .object({
      proofFound: z.boolean(),
      backendRecordFound: z.boolean(),
      imageHashOk: z.boolean(),
      fullFileHashOk: z.boolean(),
    })
    .optional(),
  reasons: z.array(z.string()),
});

export type CaptureMetadata = z.infer<typeof CaptureMetadataSchema>;
export type CaptureSessionResponse = z.infer<typeof CaptureSessionResponseSchema>;
export type RegisterCaptureResponse = z.infer<typeof RegisterCaptureResponseSchema>;
export type EmbeddedProofEnvelope = z.infer<typeof EmbeddedProofEnvelopeSchema>;
export type VerificationServerResponse = z.infer<typeof VerificationServerResponseSchema>;
