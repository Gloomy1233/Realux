# Realux

Expo (React Native) + TypeScript prototype for **registering camera captures in Firebase** and **verifying** that a selected image still matches the stored `media` record and embedded registration payload.

Registered images are stored **in Firestore** as **`registeredImageBase64`** on each `media` document (prototype only: stays under Firestore’s **~1 MiB per document** limit). **Firebase Storage is not used.**

This is **not** a production security product. Digests and device-bound secrets can be imitated by anyone who understands the client; **verification means consistency with records produced by this app and stored in your Firebase project**, not impossible-to-forge provenance.

## What this prototype verifies

- The file contains **embedded registration data** (a JSON payload in a **trailing segment** after the JPEG bytes).
- A **Firestore `media` document** exists for the embedded `mediaId` and belongs to the registered owner.
- **SHA-256** of the full on-disk bytes matches `media.sha256`, and the **core image** hash (JPEG without the trailer) matches `media.imageSha256Core`.
- **RPC-style digest** and **checksum** recomputed from stored context match the payload and Firestore (using the **current device secret**—resetting the secret in Settings will break verification for older captures).

Result labels (UI copy): **Verified**, **Not verified**, **Tampered or changed**, **Unknown provenance**.

## What it does *not* verify

- That the scene “really happened” or that no sophisticated adversary forged bytes, payload, and Firestore data.
- That hosting pipelines preserved the trailer (many services **re-encode** or strip appended metadata).

## RPC module

`src/lib/rpc/rpcVerifier.ts` is a **versioned, paper-inspired prototype** (key expansion–style scheduling, permutations, XOR / modular mixing, rotations). It is **not** a faithful or audited realization of `docs/RPC-SCIENTIFIC-PAPER-3.pdf`; place that PDF under `docs/` when available.

## Embedding

Primary channel: **append** `REALUX_EMBED_V1:` + base64(JSON) after the JPEG. A **pixel-domain fallback** is scaffolded in `src/lib/embed/pixelWatermarkStub.ts` (TODO).

## Setup

```bash
npm install
cp .env.example .env
# Fill EXPO_PUBLIC_FIREBASE_* from the Firebase console (Project settings → Your apps).
# `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` is still required by the Firebase JS config object even though this app does not upload to Storage.
```

Run the app:

```bash
npx expo start
```

## Firebase console

1. Enable **Authentication** → **Sign-in method** → turn **Email/Password** **on**. If it stays off, sign-in and sign-up will fail with `auth/operation-not-allowed` (“operation not allowed”).
2. Create a **Firestore** database.

This repo **does not** ship Firestore security rules: configure rules (or test-mode expiry) yourself in the console before production.

### App Check

- For local work, set `EXPO_PUBLIC_SKIP_APPCHECK=1` (see `.env.example`).
- For staging/production, **remove** skip, register **debug tokens** or platform attestation providers in the Firebase console, and enforce App Check on backend entry points. The client wires a `CustomProvider` when `EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN` is set (see `src/lib/firebase/appCheck.ts`).

TODO (production): replace the prototype provider with **Play Integrity / DeviceCheck / App Attest** flows appropriate to your release channels.

## Emulator workflow

From the project root (install [Firebase CLI](https://firebase.google.com/docs/cli) if needed):

```bash
npx firebase emulators:start --config firebase.json
```

Point the app at emulators with the variables in `.env.example` (`EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1`, Firestore/Auth host ports).

## Tests

```bash
npm test
```

## Production hardening (TODO)

- **Cloud Functions** (or another trusted service) to **sign** registration manifests; clients verify signatures instead of trusting client-only digests.
- **Firestore rules** and possibly move large blobs back to **Storage** with signed URLs.
- Replace trailer embedding with **signed sidecars** or **robust watermarking** where appropriate.
- **Durable Auth persistence** for React Native (see note in `src/lib/firebase/config.ts`).
- **App Check** with real attestation.

## License

Private / prototype—adjust as needed.
