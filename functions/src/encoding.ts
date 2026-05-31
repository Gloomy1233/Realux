const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function utf8ToBytes(input: string): Uint8Array {
  return textEncoder.encode(input);
}

export function bytesToUtf8(input: Uint8Array): string {
  return textDecoder.decode(input);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function base64UrlToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}
