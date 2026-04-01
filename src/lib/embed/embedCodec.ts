import type { EmbeddedVerificationPayload } from '@/types/verification';

/** Appended trailer after JPEG EOI; many decoders ignore trailing bytes (may be stripped by some hosts). */
export const EMBED_MAGIC = new TextEncoder().encode('\nREALUX_EMBED_V1:');

export function utf8JsonToBase64(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return globalThis.btoa(binary);
}

export function base64ToUtf8Json(b64: string): string {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function findTrailerIndex(raw: Uint8Array): number {
  // Search for "\nREALUX_EMBED_V1:" as UTF-8
  for (let i = 0; i <= raw.length - EMBED_MAGIC.length; i++) {
    let ok = true;
    for (let j = 0; j < EMBED_MAGIC.length; j++) {
      if (raw[i + j] !== EMBED_MAGIC[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export function stripEmbeddedTrailer(raw: Uint8Array): Uint8Array {
  const idx = findTrailerIndex(raw);
  if (idx < 0) return raw;
  return raw.slice(0, idx);
}

export function buildTrailerBytes(payload: EmbeddedVerificationPayload): Uint8Array {
  const json = JSON.stringify(payload);
  const b64 = utf8JsonToBase64(json);
  const tailText = new TextDecoder().decode(EMBED_MAGIC) + b64;
  return new TextEncoder().encode(tailText);
}

export function parseTrailerPayload(raw: Uint8Array): EmbeddedVerificationPayload | null {
  const idx = findTrailerIndex(raw);
  if (idx < 0) return null;
  const afterMagic = raw.slice(idx + EMBED_MAGIC.length);
  const b64 = new TextDecoder().decode(afterMagic).trim();
  try {
    const json = base64ToUtf8Json(b64);
    return JSON.parse(json) as EmbeddedVerificationPayload;
  } catch {
    return null;
  }
}
