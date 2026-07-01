import { z } from 'zod';
export const PROOF_VERSION = 'realux-proof-v2';
export const CERTIFICATE_VERSION = 'realux-certificate-v1';
export const CERTIFICATE_KEY_ID = 'realux-p256-cert-v1';
export const MediaKindSchema = z.enum(['image', 'video']);
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
export const CreateCaptureSessionRequestSchema = z.object({
    deviceId: z.string().min(8),
    ownerUid: z.string().min(1).optional(),
    mediaKind: MediaKindSchema.optional().default('image'),
});
export const RegisterCaptureRequestSchema = z.object({
    captureId: z.string().uuid(),
    sessionId: z.string().uuid(),
    storagePath: z.string().min(1),
    clientPublicKey: z.string().min(40),
    metadata: CaptureMetadataSchema,
    /** Mobile app sends JPEG as base64 to avoid React Native Storage Blob limitations. */
    imageBase64: z.string().min(1).optional(),
    /** Video captures are uploaded to Cloud Storage first; base64 is optional for small test files. */
    videoBase64: z.string().min(1).optional(),
});
export const VerifyImageRequestSchema = z.object({
    storagePath: z.string().min(1).optional(),
    imageBase64: z.string().min(1).optional(),
});
export const VerifyVideoRequestSchema = z.object({
    storagePath: z.string().min(1).optional(),
    videoBase64: z.string().min(1).optional(),
});
export const GetCertificateRequestSchema = z.object({
    captureId: z.string().uuid(),
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
export const EncryptedProofPlaintextSchema = z.object({
    version: z.literal(PROOF_VERSION),
    captureId: z.string().uuid(),
    sessionId: z.string().uuid(),
    ownerUid: z.string(),
    deviceId: z.string(),
    imageHash: z.string().min(32),
    metadataHash: z.string().min(32),
    serverNonce: z.string(),
    issuedAt: z.number().int().positive(),
});
export const CaptureRecordSchema = z.object({
    captureId: z.string().uuid(),
    ownerUid: z.string(),
    deviceId: z.string(),
    storagePath: z.string(),
    imageHash: z.string(),
    fullFileHash: z.string(),
    metadataHash: z.string(),
    proofHash: z.string(),
    certificateId: z.string(),
    status: z.enum(['registered', 'revoked']),
    createdAt: z.number().int().positive(),
    metadata: CaptureMetadataSchema,
});
export const CertificatePayloadSchema = z.object({
    version: z.literal(CERTIFICATE_VERSION),
    captureId: z.string().uuid(),
    ownerUid: z.string(),
    deviceId: z.string(),
    imageHash: z.string(),
    fullFileHash: z.string(),
    metadataHash: z.string(),
    storagePath: z.string(),
    issuedAt: z.number().int().positive(),
    status: z.literal('verified_realux_capture'),
});
export const VerificationVerdictSchema = z.enum([
    'verified_realux_capture',
    'tampered_or_changed',
    'unknown_provenance',
    'suspicious',
]);
