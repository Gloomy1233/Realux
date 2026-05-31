import { p256 } from '@noble/curves/nist.js';
import { AES } from '@stablelib/aes';
import { GCM } from '@stablelib/gcm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { base64UrlToBytes, bytesToBase64Url, bytesToUtf8 } from './encoding.js';
import { decryptAes256Gcm, deriveSessionKey, generateP256KeyPair, publicKeyFromPrivate, signCertificate, } from './crypto.js';
test('derives matching P-256 HKDF session keys', () => {
    const server = generateP256KeyPair();
    const client = generateP256KeyPair();
    const salt = bytesToBase64Url(new Uint8Array(32).fill(4));
    const a = deriveSessionKey({
        privateKey: server.privateKey,
        peerPublicKey: client.publicKey,
        salt,
        info: 'realux-test',
    });
    const b = deriveSessionKey({
        privateKey: client.privateKey,
        peerPublicKey: server.publicKey,
        salt,
        info: 'realux-test',
    });
    assert.deepEqual(a, b);
    assert.equal(a.byteLength, 32);
});
test('decrypts AES-256-GCM proof payloads', () => {
    const key = new Uint8Array(32).fill(7);
    const nonce = new Uint8Array(12).fill(8);
    const plaintext = new TextEncoder().encode('proof');
    const aad = new TextEncoder().encode('capture:session');
    const cipher = new AES(key);
    const gcm = new GCM(cipher);
    const sealed = gcm.seal(nonce, plaintext, aad);
    const opened = decryptAes256Gcm({
        key,
        nonce: bytesToBase64Url(nonce),
        ciphertext: bytesToBase64Url(sealed),
        aad: 'capture:session',
    });
    assert.equal(bytesToUtf8(opened), 'proof');
});
test('signs certificate payloads with P-256', () => {
    const keys = generateP256KeyPair();
    const payload = { captureId: 'abc', issuedAt: 123 };
    const sig = signCertificate(payload, keys.privateKey);
    const ok = p256.verify(base64UrlToBytes(sig), new TextEncoder().encode('{"captureId":"abc","issuedAt":123}'), base64UrlToBytes(publicKeyFromPrivate(keys.privateKey)), {
        format: 'der',
    });
    assert.equal(ok, true);
});
