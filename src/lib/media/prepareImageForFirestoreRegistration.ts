import * as ImageManipulator from 'expo-image-manipulator';

/** Full document must stay under 1 MiB; reserve space for JSON, metadata, and embed trailer growth. */
export const MAX_EMBEDDED_IMAGE_BASE64_CHARS = 980_000;

function resizeToMaxEdgeActions(width: number, height: number, maxEdge: number): ImageManipulator.Action[] {
  const longEdge = Math.max(width, height, 1);
  if (longEdge <= maxEdge) {
    return [];
  }
  if (width >= height) {
    return [{ resize: { width: maxEdge } }];
  }
  return [{ resize: { height: maxEdge } }];
}

/**
 * JPEG re-encode + optional downscale so embedded+base64 output can fit in a Firestore document.
 * Always starts from `sourceUri` each attempt to avoid stacked artifacts.
 */
export async function prepareJpegForFirestore(
  sourceUri: string,
  width: number,
  height: number,
  maxEdge: number,
  compress: number
): Promise<{ uri: string; width: number; height: number }> {
  const actions = resizeToMaxEdgeActions(width, height, maxEdge);
  const result = await ImageManipulator.manipulateAsync(sourceUri, actions, {
    compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}
