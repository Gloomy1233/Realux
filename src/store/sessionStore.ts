import type { User } from 'firebase/auth';
import { create } from 'zustand';

import type { VerificationOutcome } from '@/types/verification';

type SessionState = {
  firebaseConfigured: boolean;
  firebaseInitError: string | null;
  user: User | null;
  authReady: boolean;
  deviceId: string | null;
  deviceSecret: string | null;
  deviceReady: boolean;
  lastVerification: VerificationOutcome | null;
  setFirebaseStatus: (ok: boolean, error: string | null) => void;
  setUser: (user: User | null) => void;
  setAuthReady: (ready: boolean) => void;
  setDevice: (deviceId: string, deviceSecret: string) => void;
  setDeviceReady: (ready: boolean) => void;
  setLastVerification: (o: VerificationOutcome | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  firebaseConfigured: false,
  firebaseInitError: null,
  user: null,
  authReady: false,
  deviceId: null,
  deviceSecret: null,
  deviceReady: false,
  lastVerification: null,
  setFirebaseStatus: (firebaseConfigured, firebaseInitError) => set({ firebaseConfigured, firebaseInitError }),
  setUser: (user) => set({ user }),
  setAuthReady: (authReady) => set({ authReady }),
  setDevice: (deviceId, deviceSecret) => set({ deviceId, deviceSecret }),
  setDeviceReady: (deviceReady) => set({ deviceReady }),
  setLastVerification: (lastVerification) => set({ lastVerification }),
}));

export function sessionBootstrapComplete() {
  const s = useSessionStore.getState();
  return s.authReady && s.deviceReady;
}
