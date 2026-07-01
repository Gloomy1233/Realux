import { firebaseEmulatorHosts, readFirebaseConfigFromEnv } from '@/lib/firebase/env';
import {
  CaptureSessionResponseSchema,
  RegisterCaptureResponseSchema,
  type CaptureMetadata,
  type CaptureSessionResponse,
  type MediaKind,
  type RegisterCaptureResponse,
} from '@/types/authenticity';

const FUNCTIONS_REGION = 'us-central1';

function logCallableDebug(event: string, details: Record<string, unknown>) {
  if (__DEV__) {
    console.log(`[Realux callable] ${event}`, details);
  }
}

function callableUrl(name: string): string {
  const { projectId } = readFirebaseConfigFromEnv();
  const emu = firebaseEmulatorHosts();
  if (emu) {
    return `http://${emu.functionsHost}:${emu.functionsPort}/${projectId}/${FUNCTIONS_REGION}/${name}`;
  }
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/${name}`;
}

export async function callPublicFunction<TResponse>(name: string, data: unknown): Promise<TResponse> {
  const url = callableUrl(name);
  const emu = firebaseEmulatorHosts();
  logCallableDebug('request', {
    name,
    url,
    emulator: Boolean(emu),
    hasAuthorization: false,
    dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });
  const responseText = await res.text();
  let json: { data?: unknown; result?: unknown; error?: { message?: string; status?: string } } | null = null;
  try {
    json = responseText ? JSON.parse(responseText) : null;
  } catch {
    json = null;
  }

  logCallableDebug('response', {
    name,
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get('content-type'),
    bodyPreview: responseText.slice(0, 600),
  });

  const parsed = json as
    | { data?: unknown; result?: unknown; error?: { message?: string; status?: string } }
    | null;

  if (!res.ok || parsed?.error) {
    const errorStatus = parsed?.error?.status ? ` (${parsed.error.status})` : '';
    const bodyPreview = responseText.trim().slice(0, 180);
    const message = parsed?.error?.message
      ? `${parsed.error?.message}${errorStatus}`
      : `Callable ${name} failed with HTTP ${res.status}${bodyPreview ? `: ${bodyPreview}` : ''}`;
    throw new Error(message);
  }

  const payload = parsed && 'data' in parsed ? parsed.data : parsed?.result;
  if (typeof payload === 'undefined') {
    throw new Error(`Callable ${name} returned an invalid response.`);
  }
  return payload as TResponse;
}

export async function createCaptureSession(deviceId: string): Promise<CaptureSessionResponse> {
  const res = await callPublicFunction('createCaptureSessionPublic', { deviceId });
  return CaptureSessionResponseSchema.parse(res);
}

export async function createCaptureSessionForOwner(
  deviceId: string,
  ownerUid: string,
  mediaKind: MediaKind = 'image'
): Promise<CaptureSessionResponse> {
  const res = await callPublicFunction('createCaptureSessionPublic', { deviceId, ownerUid, mediaKind });
  return CaptureSessionResponseSchema.parse(res);
}

export async function commitCaptureRegistration(params: {
  captureId: string;
  sessionId: string;
  storagePath: string;
  clientPublicKey: string;
  metadata: CaptureMetadata;
  imageBase64?: string;
  videoBase64?: string;
}): Promise<RegisterCaptureResponse> {
  const res = await callPublicFunction('registerCapturePublic', params);
  return RegisterCaptureResponseSchema.parse(res);
}
