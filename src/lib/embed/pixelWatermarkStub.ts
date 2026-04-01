/**
 * Pixel-domain fallback watermark (scaffold only).
 *
 * Planned approach (not implemented in this prototype pass):
 * - Choose a deterministic raster region (e.g. lower-right 32×32 after resize).
 * - Encode bits into LSBs of Y channel in YCbCr space to limit visibility.
 * - Protect with error correction and keyed spreading inspired by lightweight
 *   steganographic constructions (distinct from the RPC paper digest).
 *
 * Limitations today:
 * - Lossy recompression, cropping, and color shifts can destroy LSB payloads.
 * - Requires native image buffer access beyond `expo-image-manipulator` resize.
 *
 * TODO(production): integrate a vetted watermarking pipeline or omit in favor of
 * server-signed manifests + perceptual hashing aux data.
 */

export type PixelWatermarkPlan = {
  regionWidth: number;
  regionHeight: number;
  bitCapacity: number;
};

export const PLANNED_WATERMARK: PixelWatermarkPlan = {
  regionWidth: 32,
  regionHeight: 32,
  bitCapacity: 256,
};

export async function embedPixelWatermarkStub(_imageUri: string, _payloadUtf8: string): Promise<string> {
  throw new Error('Pixel watermark not implemented — metadata trailer is the active channel.');
}

export async function extractPixelWatermarkStub(_imageUri: string): Promise<string | null> {
  return null;
}
