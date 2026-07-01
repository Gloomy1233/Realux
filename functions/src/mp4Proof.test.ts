import assert from 'node:assert/strict';
import test from 'node:test';

import { bytesToBase64Url, utf8ToBytes } from './encoding.js';
import {
  embedProofEnvelope,
  extractProofEnvelope,
  isMp4Container,
  stripKnownProofTrailers,
} from './mp4Proof.js';
import { PROOF_VERSION } from './schemas.js';

const envelope = {
  version: PROOF_VERSION,
  captureId: '00000000-0000-4000-8000-000000000003',
  sessionId: '00000000-0000-4000-8000-000000000004',
  keyId: 'p256',
  clientPublicKey: 'abc',
  nonce: 'def',
  ciphertext: 'ghi',
};

function minimalMp4(): Uint8Array {
  return new Uint8Array([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, 0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
    0x00, 0x00, 0x00, 0x08, 0x6d, 0x64, 0x61, 0x74,
  ]);
}

test('detects minimal MP4 container', () => {
  assert.equal(isMp4Container(minimalMp4()), true);
  assert.equal(isMp4Container(utf8ToBytes('not-mp4')), false);
});

test('extracts Realux v2 proof envelope from MP4 trailer', () => {
  const raw = utf8ToBytes(`mp4-bytes\nREALUX_PROOF_V2:${bytesToBase64Url(utf8ToBytes(JSON.stringify(envelope)))}`);
  assert.deepEqual(extractProofEnvelope(raw), envelope);
  assert.equal(new TextDecoder().decode(stripKnownProofTrailers(raw)), 'mp4-bytes');
});

test('embeds and extracts Realux v2 proof envelope from MP4 uuid box', () => {
  const embedded = embedProofEnvelope(minimalMp4(), envelope);
  assert.notDeepEqual(embedded, minimalMp4());
  assert.deepEqual(extractProofEnvelope(embedded), envelope);
  assert.deepEqual(stripKnownProofTrailers(embedded), minimalMp4());
});

test('uuid proof is inserted before mdat', () => {
  const embedded = embedProofEnvelope(minimalMp4(), envelope);
  let offset = 0;
  const order: string[] = [];
  while (offset + 8 <= embedded.length) {
    const size =
      ((embedded[offset] << 24) |
        (embedded[offset + 1] << 16) |
        (embedded[offset + 2] << 8) |
        embedded[offset + 3]) >>>
      0;
    const type = String.fromCharCode(
      embedded[offset + 4],
      embedded[offset + 5],
      embedded[offset + 6],
      embedded[offset + 7]
    );
    order.push(type);
    if (size < 8) break;
    offset += size;
  }
  const uuidIndex = order.indexOf('uuid');
  const mdatIndex = order.indexOf('mdat');
  assert.ok(uuidIndex >= 0);
  assert.ok(mdatIndex > uuidIndex);
});
