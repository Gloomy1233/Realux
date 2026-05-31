const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
export function utf8ToBytes(input) {
    return textEncoder.encode(input);
}
export function bytesToUtf8(input) {
    return textDecoder.decode(input);
}
export function bytesToBase64Url(bytes) {
    return Buffer.from(bytes).toString('base64url');
}
export function base64UrlToBytes(value) {
    return new Uint8Array(Buffer.from(value, 'base64url'));
}
export function canonicalJson(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
    }
    const entries = Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}
