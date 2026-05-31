import { base64UrlToBytes, bytesToBase64Url, bytesToUtf8 } from './encoding.js';
import { EmbeddedProofEnvelopeSchema } from './schemas.js';

const PROOF_MAGIC = new TextEncoder().encode('\nREALUX_PROOF_V2:');
const LEGACY_MAGIC = new TextEncoder().encode('\nREALUX_EMBED_V1:');
const PROOF_COM_PREFIX = 'REALUX_PROOF_V2:';

function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

function stripTrailingProof(raw: Uint8Array): Uint8Array {
  const proofIdx = findBytes(raw, PROOF_MAGIC);
  const legacyIdx = findBytes(raw, LEGACY_MAGIC);
  const indices = [proofIdx, legacyIdx].filter((i) => i >= 0);
  if (!indices.length) return raw;
  return raw.slice(0, Math.min(...indices));
}

function isStandaloneMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function isRealuxComComment(comment: Uint8Array): boolean {
  return bytesToUtf8(comment).startsWith(PROOF_COM_PREFIX);
}

function findSosStartIndex(raw: Uint8Array): number {
  if (raw.length < 2 || raw[0] !== 0xff || raw[1] !== 0xd8) return -1;

  let i = 2;
  while (i < raw.length) {
    if (raw[i] !== 0xff) return -1;

    const markerStart = i;
    let markerPos = i + 1;
    while (markerPos < raw.length && raw[markerPos] === 0xff) markerPos++;
    if (markerPos >= raw.length) return -1;

    const marker = raw[markerPos];
    if (marker === 0xda) return markerStart;
    if (marker === 0xd9) return -1;

    if (isStandaloneMarker(marker)) {
      i = markerPos + 1;
      continue;
    }

    if (markerPos + 3 >= raw.length) return -1;
    const len = (raw[markerPos + 1] << 8) | raw[markerPos + 2];
    if (len < 2) return -1;
    i = markerPos + 1 + len;
  }

  return -1;
}

function buildComSegment(comment: Uint8Array): Uint8Array {
  const segmentLength = comment.length + 2;
  if (segmentLength > 0xffff) {
    throw new Error('Realux proof comment exceeds JPEG COM segment limit.');
  }
  const out = new Uint8Array(4 + comment.length);
  out[0] = 0xff;
  out[1] = 0xfe;
  out[2] = (segmentLength >> 8) & 0xff;
  out[3] = segmentLength & 0xff;
  out.set(comment, 4);
  return out;
}

function parseProofPayload(encoded: string) {
  const parsed = JSON.parse(bytesToUtf8(base64UrlToBytes(encoded.trim())));
  return EmbeddedProofEnvelopeSchema.parse(parsed);
}

function extractFromComSegments(raw: Uint8Array) {
  let i = 0;
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xd8) {
    i = 2;
  }

  while (i < raw.length) {
    if (raw[i] !== 0xff) return null;

    let markerPos = i + 1;
    while (markerPos < raw.length && raw[markerPos] === 0xff) markerPos++;
    if (markerPos >= raw.length) return null;

    const marker = raw[markerPos];
    if (marker === 0xd9) return null;

    if (marker === 0xda) {
      if (markerPos + 3 >= raw.length) return null;
      const len = (raw[markerPos + 1] << 8) | raw[markerPos + 2];
      i = markerPos + 1 + len;
      while (i < raw.length - 1) {
        if (raw[i] === 0xff) {
          if (raw[i + 1] === 0x00) {
            i += 2;
            continue;
          }
          if (raw[i + 1] === 0xd9) return null;
        }
        i++;
      }
      return null;
    }

    if (isStandaloneMarker(marker)) {
      i = markerPos + 1;
      continue;
    }

    if (markerPos + 3 >= raw.length) return null;
    const len = (raw[markerPos + 1] << 8) | raw[markerPos + 2];
    if (len < 2) return null;
    const segStart = markerPos + 3;
    const segEnd = markerPos + 1 + len;
    if (segEnd > raw.length) return null;

    if (marker === 0xfe) {
      const comment = raw.slice(segStart, segEnd);
      const text = bytesToUtf8(comment);
      if (text.startsWith(PROOF_COM_PREFIX)) {
        return parseProofPayload(text.slice(PROOF_COM_PREFIX.length));
      }
    }

    i = segEnd;
  }

  return null;
}

function stripComProofSegments(raw: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let i = 0;

  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xd8) {
    chunks.push(raw.slice(0, 2));
    i = 2;
  } else {
    return raw;
  }

  while (i < raw.length) {
    if (raw[i] !== 0xff) {
      chunks.push(raw.slice(i));
      break;
    }

    const markerStart = i;
    let markerPos = i + 1;
    while (markerPos < raw.length && raw[markerPos] === 0xff) markerPos++;
    if (markerPos >= raw.length) {
      chunks.push(raw.slice(markerStart));
      break;
    }

    const marker = raw[markerPos];
    if (marker === 0xd9) {
      chunks.push(raw.slice(markerStart, markerPos + 1));
      break;
    }

    if (marker === 0xda) {
      if (markerPos + 3 >= raw.length) {
        chunks.push(raw.slice(markerStart));
        break;
      }
      const len = (raw[markerPos + 1] << 8) | raw[markerPos + 2];
      const sosEnd = markerPos + 1 + len;
      chunks.push(raw.slice(markerStart, sosEnd));
      let scanStart = sosEnd;
      i = sosEnd;
      while (i < raw.length - 1) {
        if (raw[i] === 0xff) {
          if (raw[i + 1] === 0x00) {
            i += 2;
            continue;
          }
          if (raw[i + 1] === 0xd9) {
            chunks.push(raw.slice(scanStart, i + 2));
            i = raw.length;
            break;
          }
        }
        i++;
      }
      if (i < raw.length) chunks.push(raw.slice(scanStart));
      break;
    }

    if (isStandaloneMarker(marker)) {
      chunks.push(raw.slice(markerStart, markerPos + 1));
      i = markerPos + 1;
      continue;
    }

    if (markerPos + 3 >= raw.length) {
      chunks.push(raw.slice(markerStart));
      break;
    }

    const len = (raw[markerPos + 1] << 8) | raw[markerPos + 2];
    if (len < 2) {
      chunks.push(raw.slice(markerStart));
      break;
    }
    const segEnd = markerPos + 1 + len;
    if (segEnd > raw.length) {
      chunks.push(raw.slice(markerStart));
      break;
    }

    if (marker === 0xfe) {
      const comment = raw.slice(markerPos + 3, segEnd);
      if (isRealuxComComment(comment)) {
        i = segEnd;
        continue;
      }
    }

    chunks.push(raw.slice(markerStart, segEnd));
    i = segEnd;
  }

  const total = chunks.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function stripKnownProofTrailers(raw: Uint8Array): Uint8Array {
  return stripComProofSegments(stripTrailingProof(raw));
}

export function embedProofEnvelope(raw: Uint8Array, envelope: unknown): Uint8Array {
  const canonical = stripKnownProofTrailers(raw);
  const sosStart = findSosStartIndex(canonical);
  if (sosStart < 0) {
    throw new Error('Invalid JPEG: start-of-scan marker not found.');
  }

  const payload = new TextEncoder().encode(
    `${PROOF_COM_PREFIX}${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(envelope)))}`
  );
  const com = buildComSegment(payload);
  const out = new Uint8Array(canonical.length + com.length);
  out.set(canonical.slice(0, sosStart));
  out.set(com, sosStart);
  out.set(canonical.slice(sosStart), sosStart + com.length);
  return out;
}

export function extractProofEnvelope(raw: Uint8Array) {
  const trailerIdx = findBytes(raw, PROOF_MAGIC);
  if (trailerIdx >= 0) {
    const encoded = bytesToUtf8(raw.slice(trailerIdx + PROOF_MAGIC.length)).trim();
    return parseProofPayload(encoded);
  }

  return extractFromComSegments(raw);
}
