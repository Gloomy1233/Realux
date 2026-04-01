import {
  buildTrailerBytes,
  findTrailerIndex,
  parseTrailerPayload,
  stripEmbeddedTrailer,
} from '@/lib/embed/embedCodec';
import type { EmbeddedVerificationPayload } from '@/types/verification';

const samplePayload: EmbeddedVerificationPayload = {
  mediaId: '123e4567-e89b-12d3-a456-426614174000',
  rpcDigest: 'rpc-proto-v1:abcdef',
  rpcDigestShort: 'abcdef',
  checksum: 'chk',
  version: 'embed-payload-v1',
  nonce: 'n',
  createdAt: 1,
  userId: 'u',
  deviceId: 'd',
  verificationVersion: 'realux-proto-0.1',
  imageSha256Core: '0'.repeat(64),
};

describe('embedCodec', () => {
  it('roundtrips JSON payload through trailer bytes', () => {
    const jpegCore = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const trailer = buildTrailerBytes(samplePayload);
    const raw = new Uint8Array(jpegCore.length + trailer.length);
    raw.set(jpegCore);
    raw.set(trailer, jpegCore.length);
    expect(findTrailerIndex(raw)).toBe(jpegCore.length);
    const parsed = parseTrailerPayload(raw);
    expect(parsed?.mediaId).toBe(samplePayload.mediaId);
    expect(parsed?.checksum).toBe(samplePayload.checksum);
    const stripped = stripEmbeddedTrailer(raw);
    expect(stripped).toEqual(jpegCore);
  });
});
