import {
  buildRpcDigestInput,
  computeVerificationChecksum,
  createRpcDigest,
  rpcDigestShortFromFull,
} from '@/lib/rpc/rpcVerifier';
import { verifyImageAgainstFirebase } from '@/lib/verify/verifyImageAgainstFirebase';
import * as Extract from '@/lib/embed/extractVerificationPayload';
import * as Fetch from '@/lib/firebase/fetchMediaRecord';
import * as Hash from '@/lib/media/hashImage';

jest.mock('../../firebase/fetchMediaRecord', () => ({
  fetchMediaRecord: jest.fn(),
}));

jest.mock('../../embed/extractVerificationPayload', () => ({
  extractVerificationPayload: jest.fn(),
}));

jest.mock('../../media/hashImage', () => ({
  sha256File: jest.fn(),
  sha256ImageCore: jest.fn(),
  base64ToUint8Array: jest.fn(),
  uint8ArrayToBase64: jest.fn(),
}));

const mockedExtract = jest.mocked(Extract);
const mockedFetch = jest.mocked(Fetch);
const mockedHash = jest.mocked(Hash);

describe('verifyImageAgainstFirebase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns unknown_provenance when no payload', async () => {
    mockedExtract.extractVerificationPayload.mockResolvedValue({
      success: false,
      payload: null,
      error: 'none',
    });
    const r = await verifyImageAgainstFirebase({ localUri: 'file:///x', deviceSecret: 's' });
    expect(r.label).toBe('unknown_provenance');
    expect(r.details.payloadFound).toBe(false);
  });

  it('returns verified when Firebase record matches recomputed digests', async () => {
    const mediaId = '123e4567-e89b-12d3-a456-426614174000';
    const core = '0'.repeat(64);
    const secret = 'device-secret';
    const digest = createRpcDigest(
      buildRpcDigestInput({
        imageSha256Core: core,
        mediaId,
        createdAt: 1,
        nonce: 'n',
        userId: 'uid',
        deviceId: 'did',
        verificationVersion: 'realux-proto-0.1',
      }),
      secret
    );
    const checksum = await computeVerificationChecksum({
      mediaId,
      imageSha256Core: core,
      createdAt: 1,
      nonce: 'n',
      userId: 'uid',
      deviceId: 'did',
      verificationVersion: 'realux-proto-0.1',
      rpcDigest: digest,
    });

    mockedExtract.extractVerificationPayload.mockResolvedValue({
      success: true,
      payload: {
        mediaId,
        rpcDigest: digest,
        rpcDigestShort: rpcDigestShortFromFull(digest),
        checksum,
        version: 'embed-payload-v1',
        nonce: 'n',
        createdAt: 1,
        userId: 'uid',
        deviceId: 'did',
        verificationVersion: 'realux-proto-0.1',
        imageSha256Core: core,
      },
      error: null,
    });
    mockedFetch.fetchMediaRecord.mockResolvedValue({
      mediaId,
      ownerUid: 'uid',
      deviceId: 'did',
      registeredImageBase64: 'YmFpcw==',
      sha256: 'full',
      rpcDigest: digest,
      checksum,
      createdAt: 1,
      width: 100,
      height: 100,
      mimeType: 'image/jpeg',
      verificationVersion: 'realux-proto-0.1',
      embeddedPayloadPreview: {
        mediaId,
        rpcDigestShort: rpcDigestShortFromFull(digest),
        checksum,
        version: 'embed-payload-v1',
      },
      nonce: 'n',
      imageSha256Core: core,
    });
    mockedHash.sha256File.mockResolvedValue('full');
    mockedHash.sha256ImageCore.mockResolvedValue(core);

    const r = await verifyImageAgainstFirebase({ localUri: 'file:///x', deviceSecret: secret });
    expect(r.label).toBe('verified');
  });
});
