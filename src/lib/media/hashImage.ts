import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { stripEmbeddedTrailer } from '@/lib/embed/embedCodec';

/**
 * SHA-256 of raw file bytes (Expo Crypto accepts Base64 input and hashes decoded bytes).
 */
export async function sha256File(uri: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, b64, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
}

/** SHA-256 of JPEG core (strips Realux trailer segment if present). */
export async function sha256ImageCore(uri: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const raw = base64ToUint8Array(b64);
  const core = stripEmbeddedTrailer(raw);
  const coreB64 = uint8ArrayToBase64(core);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, coreB64, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return globalThis.btoa(binary);
}
