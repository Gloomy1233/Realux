import {
  RPC_DIGEST_VERSION_PREFIX,
  buildRpcDigestInput,
  createRpcDigest,
  createVerificationPackage,
  verifyVerificationPackage,
} from '@/lib/rpc/rpcVerifier';

describe('rpcVerifier', () => {
  it('createRpcDigest is deterministic for the same inputs', () => {
    const input = new TextEncoder().encode('hello-realux');
    const a = createRpcDigest(input, 'secret-a');
    const b = createRpcDigest(input, 'secret-a');
    expect(a).toBe(b);
    expect(a.startsWith(`${RPC_DIGEST_VERSION_PREFIX}:`)).toBe(true);
  });

  it('changes digest when secret changes', () => {
    const input = new TextEncoder().encode('payload');
    const a = createRpcDigest(input, 's1');
    const b = createRpcDigest(input, 's2');
    expect(a).not.toBe(b);
  });

  it('createVerificationPackage + verifyVerificationPackage roundtrip', async () => {
    const pkg = await createVerificationPackage({
      imageSha256Core: '0'.repeat(64),
      mediaId: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: 1700000000000,
      nonce: 'nonce',
      userId: 'uid',
      deviceId: 'did',
      verificationVersion: 'realux-proto-0.1',
      deviceSecret: 'dev-secret',
    });
    expect(await verifyVerificationPackage({ package: pkg, deviceSecret: 'dev-secret' })).toBe(true);
    expect(await verifyVerificationPackage({ package: pkg, deviceSecret: 'wrong' })).toBe(false);
  });

  it('buildRpcDigestInput matches canonical field order', () => {
    const bytes = buildRpcDigestInput({
      imageSha256Core: 'a',
      mediaId: 'b',
      createdAt: 1,
      nonce: 'c',
      userId: 'd',
      deviceId: 'e',
      verificationVersion: 'v',
    });
    expect(new TextDecoder().decode(bytes)).toBe('a|b|1|c|d|e|v');
  });
});
