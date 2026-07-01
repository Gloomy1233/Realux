import { embedProofEnvelope as embedJpegProof, extractProofEnvelope as extractJpegProof, stripKnownProofTrailers as stripJpegProof, } from './jpegProof.js';
import { embedProofEnvelope as embedMp4Proof, extractProofEnvelope as extractMp4Proof, stripKnownProofTrailers as stripMp4Proof } from './mp4Proof.js';
export function mimeTypeFromMetadata(metadata) {
    if (metadata.mimeType === 'video/mp4')
        return 'video/mp4';
    return 'image/jpeg';
}
export function stripKnownProofTrailers(raw, mimeType) {
    return mimeType === 'video/mp4' ? stripMp4Proof(raw) : stripJpegProof(raw);
}
export function embedProofEnvelope(raw, envelope, mimeType) {
    return mimeType === 'video/mp4' ? embedMp4Proof(raw, envelope) : embedJpegProof(raw, envelope);
}
export function extractProofEnvelope(raw, mimeType) {
    if (mimeType === 'video/mp4')
        return extractMp4Proof(raw);
    if (mimeType === 'image/jpeg')
        return extractJpegProof(raw);
    const mp4 = extractMp4Proof(raw);
    if (mp4)
        return mp4;
    return extractJpegProof(raw);
}
export function contentTypeForMime(mimeType) {
    return mimeType;
}
