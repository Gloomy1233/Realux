import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'realux_device_id_v1';
const DEVICE_SECRET_KEY = 'realux_device_secret_v1';

export const VERIFICATION_PIPELINE_VERSION = 'realux-proto-0.1';

export async function ensureDeviceIdentity(): Promise<{ deviceId: string; deviceSecret: string }> {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  let deviceSecret = await SecureStore.getItemAsync(DEVICE_SECRET_KEY);
  if (!deviceId) {
    deviceId = uuidv4();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  if (!deviceSecret) {
    deviceSecret = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${deviceId}|${Date.now()}|${Math.random()}`
    );
    await SecureStore.setItemAsync(DEVICE_SECRET_KEY, deviceSecret);
  }
  return { deviceId, deviceSecret };
}

export async function resetDeviceSecret(): Promise<{ deviceId: string; deviceSecret: string }> {
  const deviceId = (await SecureStore.getItemAsync(DEVICE_ID_KEY)) ?? uuidv4();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  const deviceSecret = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${deviceId}|reset|${Date.now()}|${Math.random()}`
  );
  await SecureStore.setItemAsync(DEVICE_SECRET_KEY, deviceSecret);
  return { deviceId, deviceSecret };
}

export async function readDeviceId(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}
