/**
 * Prototype RPC-style digest module.
 *
 * Concepts inspired by cryptographic mixing patterns discussed in
 * docs/RPC-SCIENTIFIC-PAPER-3.pdf (key expansion schedules, dynamic permutations,
 * XOR / modular arithmetic / rotations). This is a **simplified, unreviewed**
 * construction for local prototyping only—not a faithful or complete realization
 * of the paper’s formalism.
 *
 * Production plan: replace with server-side signed attestations (Cloud Functions).
 */

import * as Crypto from 'expo-crypto';

export const RPC_DIGEST_VERSION_PREFIX = 'rpc-proto-v1';

export type VerificationPackage = {
  mediaId: string;
  createdAt: number;
  nonce: string;
  userId: string;
  deviceId: string;
  verificationVersion: string;
  imageSha256Core: string;
  rpcDigest: string;
  rpcDigestShort: string;
  checksum: string;
  version: string;
};

export type CreateVerificationPackageParams = {
  imageSha256Core: string;
  mediaId: string;
  createdAt: number;
  nonce: string;
  userId: string;
  deviceId: string;
  verificationVersion: string;
  deviceSecret: string;
};

export type VerifyVerificationPackageParams = {
  package: VerificationPackage;
  deviceSecret: string;
};

function rotl32(x: number, r: number): number {
  x >>>= 0;
  return ((x << r) | (x >>> (32 - r))) >>> 0;
}

/**
 * Paper-inspired key expansion: stretch a short secret into a UInt32 schedule.
 * Simplified: no HKDF; uses iterative FNV-style mixing (prototype only).
 */
function expandKey(secret: string, scheduleWords: number): Uint32Array {
  const enc = new TextEncoder().encode(secret);
  const schedule = new Uint32Array(Math.max(16, scheduleWords));
  let h = 0x811c9dc5;
  for (let i = 0; i < enc.length; i++) {
    h ^= enc[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  schedule[0] = h;
  for (let i = 1; i < schedule.length; i++) {
    const p = schedule[i - 1]!;
    schedule[i] = (Math.imul(p, 0x85ebca6b) ^ rotl32(p, 13)) >>> 0;
  }
  return schedule;
}

/**
 * Build a dynamic permutation over indices, seeded from the expanded schedule.
 * Similar in spirit to keyed permutations used in some cipher designs (prototype).
 */
function buildPermutation(byteLength: number, schedule: Uint32Array): Uint32Array {
  const perm = new Uint32Array(byteLength);
  for (let i = 0; i < byteLength; i++) perm[i] = i;
  let seedIdx = 0;
  for (let i = byteLength - 1; i > 0; i--) {
    const j = (schedule[seedIdx % schedule.length]! ^ i) % (i + 1);
    seedIdx++;
    const t = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = t!;
  }
  return perm;
}

/**
 * Derive a deterministic, versioned digest from input bytes + device-bound secret.
 */
export function createRpcDigest(input: Uint8Array, secret: string): string {
  const n = input.byteLength;
  const scheduleWords = 8 + (n >> 4);
  const schedule = expandKey(secret, scheduleWords);

  const blockSize = Math.max(32, (schedule[0]! % 64) + 32);
  const work = new Uint8Array(Math.max(blockSize, n));
  work.set(input);
  const perm = buildPermutation(work.length, schedule);
  const words = new Uint32Array(work.buffer, work.byteOffset, work.byteLength >> 2);

  for (let round = 0; round < 8; round++) {
    for (let w = 0; w < words.length; w++) {
      const k = schedule[(w + round) % schedule.length]!;
      let x = words[w]!;
      x ^= k;
      x = (x + rotl32(k, w % 32)) >>> 0;
      x = rotl32(x, (k % 31) + 1);
      words[w] = x;
    }
    const tmp = new Uint8Array(work.length);
    for (let i = 0; i < work.length; i++) {
      tmp[i] = work[perm[i]!]!;
    }
    work.set(tmp);
  }

  let acc = schedule[0]!;
  for (let i = 0; i < work.length; i++) {
    acc = (acc ^ work[i]!) >>> 0;
    acc = (Math.imul(acc, 0x27d4eb2d) + rotl32(acc, 5)) >>> 0;
  }
  for (let i = 0; i < words.length; i++) {
    acc ^= words[i]!;
    acc = rotl32(acc, 7);
  }

  const digestBytes = new Uint8Array(32);
  const dv = new DataView(digestBytes.buffer);
  for (let i = 0; i < 8; i++) {
    dv.setUint32(i * 4, acc ^ schedule[i % schedule.length]!, false);
    acc = rotl32(acc, 11) ^ Math.imul(i + 1, 0x9e3779b1);
  }
  const hex = [...digestBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${RPC_DIGEST_VERSION_PREFIX}:${hex}`;
}

/** Canonical byte string fed into {@link createRpcDigest} for registration and verification. */
export function buildRpcDigestInput(params: Omit<CreateVerificationPackageParams, 'deviceSecret'>): Uint8Array {
  const parts = [
    params.imageSha256Core,
    params.mediaId,
    String(params.createdAt),
    params.nonce,
    params.userId,
    params.deviceId,
    params.verificationVersion,
  ];
  return new TextEncoder().encode(parts.join('|'));
}

export function rpcDigestShortFromFull(full: string): string {
  const idx = full.indexOf(':');
  const body = idx >= 0 ? full.slice(idx + 1) : full;
  return body.slice(0, 16);
}

export async function computeVerificationChecksum(fields: {
  mediaId: string;
  imageSha256Core: string;
  createdAt: number;
  nonce: string;
  userId: string;
  deviceId: string;
  verificationVersion: string;
  rpcDigest: string;
}): Promise<string> {
  const canonical = [
    fields.mediaId,
    fields.imageSha256Core,
    String(fields.createdAt),
    fields.nonce,
    fields.userId,
    fields.deviceId,
    fields.verificationVersion,
    fields.rpcDigest,
  ].join('|');
  const full = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
  return full.slice(0, 24);
}

export async function createVerificationPackage(
  params: CreateVerificationPackageParams
): Promise<VerificationPackage> {
  const digestInput = buildRpcDigestInput(params);
  const rpcDigest = createRpcDigest(digestInput, params.deviceSecret);
  const rpcDigestShort = rpcDigestShortFromFull(rpcDigest);
  const version = 'embed-payload-v1';
  const base: Omit<VerificationPackage, 'checksum'> = {
    mediaId: params.mediaId,
    createdAt: params.createdAt,
    nonce: params.nonce,
    userId: params.userId,
    deviceId: params.deviceId,
    verificationVersion: params.verificationVersion,
    imageSha256Core: params.imageSha256Core,
    rpcDigest,
    rpcDigestShort,
    version,
  };
  const checksum = await computeVerificationChecksum({
    mediaId: base.mediaId,
    imageSha256Core: base.imageSha256Core,
    createdAt: base.createdAt,
    nonce: base.nonce,
    userId: base.userId,
    deviceId: base.deviceId,
    verificationVersion: base.verificationVersion,
    rpcDigest: base.rpcDigest,
  });
  return { ...base, checksum };
}

/** Recompute digest + checksum and compare to the package (prototype self-check). */
export async function verifyVerificationPackage(params: VerifyVerificationPackageParams): Promise<boolean> {
  const p = params.package;
  const expectedDigest = createRpcDigest(
    buildRpcDigestInput({
      imageSha256Core: p.imageSha256Core,
      mediaId: p.mediaId,
      createdAt: p.createdAt,
      nonce: p.nonce,
      userId: p.userId,
      deviceId: p.deviceId,
      verificationVersion: p.verificationVersion,
    }),
    params.deviceSecret
  );
  const expectedChecksum = await computeVerificationChecksum({
    mediaId: p.mediaId,
    imageSha256Core: p.imageSha256Core,
    createdAt: p.createdAt,
    nonce: p.nonce,
    userId: p.userId,
    deviceId: p.deviceId,
    verificationVersion: p.verificationVersion,
    rpcDigest: expectedDigest,
  });
  return expectedDigest === p.rpcDigest && expectedChecksum === p.checksum;
}
