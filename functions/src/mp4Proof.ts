import { base64UrlToBytes, bytesToBase64Url, bytesToUtf8 } from './encoding.js';
import { EmbeddedProofEnvelopeSchema } from './schemas.js';

const PROOF_MAGIC = new TextEncoder().encode('\nREALUX_PROOF_V2:');
const PROOF_COM_PREFIX = 'REALUX_PROOF_V2:';

/** Dedicated Realux proof UUID for MP4 uuid boxes (f47ac10b-58cc-4372-a567-0e02b2c3d479). */
export const REALUX_MP4_PROOF_UUID = new Uint8Array([
  0xf4, 0x7a, 0xc1, 0x0b, 0x58, 0xcc, 0x43, 0x72, 0xa5, 0x67, 0x0e, 0x02, 0xb2, 0xc3, 0xd4, 0x79,
]);

type TopLevelBox = {
  start: number;
  size: number;
  type: string;
  headerEnd: number;
};

function readU32BE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] ?? 0) << 24) |
    ((data[offset + 1] ?? 0) << 16) |
    ((data[offset + 2] ?? 0) << 8) |
    (data[offset + 3] ?? 0)
  ) >>> 0;
}

function readBoxType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0, data[offset + 3] ?? 0);
}

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

function uuidMatches(data: Uint8Array, offset: number): boolean {
  for (let i = 0; i < REALUX_MP4_PROOF_UUID.length; i++) {
    if (data[offset + i] !== REALUX_MP4_PROOF_UUID[i]) return false;
  }
  return true;
}

function parseTopLevelBoxes(data: Uint8Array): TopLevelBox[] {
  const boxes: TopLevelBox[] = [];
  let offset = 0;
  while (offset + 8 <= data.length) {
    let size = readU32BE(data, offset);
    const type = readBoxType(data, offset + 4);
    let headerEnd = offset + 8;
    if (size === 1) {
      if (offset + 16 > data.length) break;
      const high = readU32BE(data, offset + 8);
      const low = readU32BE(data, offset + 12);
      size = high * 0x1_0000_0000 + low;
      headerEnd = offset + 16;
    } else if (size === 0) {
      size = data.length - offset;
    }
    if (size < 8) break;
    const end = offset + size;
    if (end > data.length) break;
    boxes.push({ start: offset, size, type, headerEnd });
    offset = end;
  }
  return boxes;
}

function isRealuxUuidBox(data: Uint8Array, box: TopLevelBox): boolean {
  if (box.type !== 'uuid') return false;
  if (box.headerEnd + 16 > box.start + box.size) return false;
  return uuidMatches(data, box.headerEnd);
}

function stripTrailingProof(raw: Uint8Array): Uint8Array {
  const proofIdx = findBytes(raw, PROOF_MAGIC);
  if (proofIdx < 0) return raw;
  return raw.slice(0, proofIdx);
}

function stripUuidProofBoxes(raw: Uint8Array): Uint8Array {
  const boxes = parseTopLevelBoxes(raw);
  if (!boxes.length) return raw;

  const chunks: Uint8Array[] = [];
  for (const box of boxes) {
    if (isRealuxUuidBox(raw, box)) continue;
    chunks.push(raw.slice(box.start, box.start + box.size));
  }

  if (!chunks.length) return new Uint8Array(0);
  const total = chunks.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function parseProofPayload(encoded: string) {
  const parsed = JSON.parse(bytesToUtf8(base64UrlToBytes(encoded.trim())));
  return EmbeddedProofEnvelopeSchema.parse(parsed);
}

function extractFromUuidBox(data: Uint8Array, box: TopLevelBox) {
  const payloadStart = box.headerEnd + 16;
  const payloadEnd = box.start + box.size;
  if (payloadStart >= payloadEnd) return null;
  const text = bytesToUtf8(data.slice(payloadStart, payloadEnd));
  if (!text.startsWith(PROOF_COM_PREFIX)) return null;
  return parseProofPayload(text.slice(PROOF_COM_PREFIX.length));
}

function buildUuidProofBox(payloadText: string): Uint8Array {
  const payload = new TextEncoder().encode(payloadText);
  const size = 8 + 16 + payload.length;
  const out = new Uint8Array(size);
  out[0] = (size >>> 24) & 0xff;
  out[1] = (size >>> 16) & 0xff;
  out[2] = (size >>> 8) & 0xff;
  out[3] = size & 0xff;
  out[4] = 'u'.charCodeAt(0);
  out[5] = 'u'.charCodeAt(0);
  out[6] = 'i'.charCodeAt(0);
  out[7] = 'd'.charCodeAt(0);
  out.set(REALUX_MP4_PROOF_UUID, 8);
  out.set(payload, 24);
  return out;
}

export function isMp4Container(raw: Uint8Array): boolean {
  const boxes = parseTopLevelBoxes(raw);
  return boxes.some((box) => box.type === 'ftyp');
}

export function stripKnownProofTrailers(raw: Uint8Array): Uint8Array {
  return stripUuidProofBoxes(stripTrailingProof(raw));
}

export function embedProofEnvelope(raw: Uint8Array, envelope: unknown): Uint8Array {
  const canonical = stripKnownProofTrailers(raw);
  if (!isMp4Container(canonical)) {
    throw new Error('Invalid MP4: ftyp box not found.');
  }

  const payloadText = `${PROOF_COM_PREFIX}${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(envelope)))}`;
  const proofBox = buildUuidProofBox(payloadText);
  const boxes = parseTopLevelBoxes(canonical);
  const mdat = boxes.find((box) => box.type === 'mdat');
  const insertAt = mdat?.start ?? canonical.length;

  const out = new Uint8Array(canonical.length + proofBox.length);
  out.set(canonical.slice(0, insertAt), 0);
  out.set(proofBox, insertAt);
  out.set(canonical.slice(insertAt), insertAt + proofBox.length);
  return out;
}

export function extractProofEnvelope(raw: Uint8Array) {
  const trailerIdx = findBytes(raw, PROOF_MAGIC);
  if (trailerIdx >= 0) {
    const encoded = bytesToUtf8(raw.slice(trailerIdx + PROOF_MAGIC.length)).trim();
    return parseProofPayload(encoded);
  }

  for (const box of parseTopLevelBoxes(raw)) {
    if (!isRealuxUuidBox(raw, box)) continue;
    const envelope = extractFromUuidBox(raw, box);
    if (envelope) return envelope;
  }

  return null;
}
