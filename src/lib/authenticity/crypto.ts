import { p256 } from '@noble/curves/nist.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { keccak_512 } from '@noble/hashes/sha3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { AES } from '@stablelib/aes';
import { GCM } from '@stablelib/gcm';

import {
  base64UrlToBytes,
  bytesToBase64Url,
  canonicalJson,
  utf8ToBytes,
} from '@/lib/authenticity/encoding';

export function generateClientKeyPair() {
  const keys = p256.keygen();
  return {
    privateKey: bytesToBase64Url(keys.secretKey),
    publicKey: bytesToBase64Url(keys.publicKey),
  };
}

export function randomNonceBase64Url(bytes = 12): string {
  return bytesToBase64Url(randomBytes(bytes));
}

export function deriveSessionKey(params: {
  privateKey: string;
  peerPublicKey: string;
  salt: string;
  info: string;
}): Uint8Array {
  const shared = p256.getSharedSecret(base64UrlToBytes(params.privateKey), base64UrlToBytes(params.peerPublicKey));
  return hkdf(sha256, shared, base64UrlToBytes(params.salt), utf8ToBytes(params.info), 32);
}

export function encryptAes256Gcm(params: {
  key: Uint8Array;
  nonce: string;
  plaintext: Uint8Array;
  aad: string;
}): string {
  const cipher = new AES(params.key);
  const gcm = new GCM(cipher);
  const sealed = gcm.seal(base64UrlToBytes(params.nonce), params.plaintext, utf8ToBytes(params.aad));
  cipher.clean();
  gcm.clean();
  return bytesToBase64Url(sealed);
}

export function keccak512Base64Url(bytes: Uint8Array): string {
  return bytesToBase64Url(keccak_512(bytes));
}

export function hashCanonicalJson(value: unknown): string {
  return keccak512Base64Url(utf8ToBytes(canonicalJson(value)));
}
