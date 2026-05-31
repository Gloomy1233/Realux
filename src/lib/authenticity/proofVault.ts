import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const INDEX_KEY = 'realux:proof-vault-index';

export type ProofVaultEntry = {
  captureId: string;
  uri: string;
  createdAt: number;
  photosAssetId?: string;
};

async function readIndex(): Promise<ProofVaultEntry[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProofVaultEntry[];
  } catch {
    return [];
  }
}

async function writeIndex(entries: ProofVaultEntry[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export async function saveProofToVault(
  captureId: string,
  proofUri: string,
  photosAssetId?: string
): Promise<ProofVaultEntry> {
  const dir = `${FileSystem.documentDirectory}realux-proofs/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${captureId}.jpg`;
  await FileSystem.copyAsync({ from: proofUri, to: dest });

  const entry: ProofVaultEntry = {
    captureId,
    uri: dest,
    createdAt: Date.now(),
    photosAssetId,
  };

  const index = await readIndex();
  await writeIndex([entry, ...index.filter((item) => item.captureId !== captureId)]);
  return entry;
}

export async function listProofVaultEntries(): Promise<ProofVaultEntry[]> {
  const index = await readIndex();
  const valid: ProofVaultEntry[] = [];

  for (const entry of index) {
    const info = await FileSystem.getInfoAsync(entry.uri);
    if (info.exists) valid.push(entry);
  }

  if (valid.length !== index.length) {
    await writeIndex(valid);
  }

  return valid.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getProofVaultEntry(captureId: string): Promise<ProofVaultEntry | null> {
  const entries = await listProofVaultEntries();
  return entries.find((entry) => entry.captureId === captureId) ?? null;
}

export async function findVaultEntryByPhotosAssetId(assetId: string): Promise<ProofVaultEntry | null> {
  const entries = await listProofVaultEntries();
  return entries.find((entry) => entry.photosAssetId === assetId) ?? null;
}
