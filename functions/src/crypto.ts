import { p256 } from '@noble/curves/nist.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { keccak_512 } from '@noble/hashes/sha3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { AES } from '@stablelib/aes';
import { GCM } from '@stablelib/gcm';
import { randomBytes } from 'node:crypto';

import { base64UrlToBytes, bytesToBase64Url, canonicalJson, utf8ToBytes } from './encoding.js';

export function randomBase64Url(bytes = 32): string {
  return bytesToBase64Url(randomBytes(bytes));
}

export function generateP256KeyPair() {
  const keys = p256.keygen();
  return {
    privateKey: bytesToBase64Url(keys.secretKey),
    publicKey: bytesToBase64Url(keys.publicKey),
  };
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

export function decryptAes256Gcm(params: {
  key: Uint8Array;
  nonce: string;
  ciphertext: string;
  aad: string;
}): Uint8Array {
  const cipher = new AES(params.key);
  const gcm = new GCM(cipher);
  const opened = gcm.open(base64UrlToBytes(params.nonce), base64UrlToBytes(params.ciphertext), utf8ToBytes(params.aad));
  cipher.clean();
  gcm.clean();
  if (!opened) {
    throw new Error('Invalid encrypted proof authentication tag.');
  }
  return opened;
}

export function keccak512Base64Url(bytes: Uint8Array): string {
  return bytesToBase64Url(keccak_512(bytes));
}

export function hashCanonicalJson(value: unknown): string {
  return keccak512Base64Url(utf8ToBytes(canonicalJson(value)));
}

export function signCertificate(payload: unknown, privateKey: string): string {
  const msg = utf8ToBytes(canonicalJson(payload));
  const sig = p256.sign(msg, base64UrlToBytes(privateKey), { format: 'der' });
  return bytesToBase64Url(sig);
}

export function publicKeyFromPrivate(privateKey: string): string {
  return bytesToBase64Url(p256.getPublicKey(base64UrlToBytes(privateKey)));
}
