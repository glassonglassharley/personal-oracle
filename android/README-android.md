# Personal Oracle — Android (TWA via Bubblewrap)

This folder contains the configuration needed to wrap the Personal Oracle PWA as a
Trusted Web Activity (TWA) and submit it to Google Play.

---

## Prerequisites

Install these before running any build commands:

| Tool | Version | Download |
|------|---------|----------|
| JDK | 11+ | https://adoptium.net |
| Android Studio | Latest | https://developer.android.com/studio |
| Bubblewrap CLI | (already installed globally) | `npm i -g @bubblewrap/cli` |

---

## Step 1 — Update the production URL

Once your domain is confirmed (e.g. `vicespending.com`), open `twa-manifest.json`
and replace every occurrence of `TODO_vicespending.com` with the real domain:

```
"host": "vicespending.com",
"iconUrl": "https://vicespending.com/icon-512.png",
"maskableIconUrl": "https://vicespending.com/icon-512.png",
"webManifestUrl": "https://vicespending.com/manifest.json"
```

---

## Step 2 — Scaffold the Android project

Run from this `android/` directory:

```bash
bubblewrap init --manifest=https://vicespending.com/manifest.json
```

Bubblewrap will ask a few questions — the values in `twa-manifest.json` are the
answers. Accept defaults or copy values from that file.

This generates the full Android project (Gradle wrapper, `app/`, `AndroidManifest.xml`, etc.).

---

## Step 3 — Generate a signing keystore (first time only)

```bash
keytool -genkeypair -v \
  -keystore android.keystore \
  -alias android \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Keep `android.keystore` **out of git** — it's in `.gitignore`.

---

## Step 4 — Build the AAB

```bash
bubblewrap build
```

This produces `app-release-bundle.aab` in the project root, ready for upload to
Google Play Console.

---

## Step 5 — Set up Digital Asset Links

For the TWA to work without a browser URL bar, you must verify domain ownership
via Digital Asset Links.

1. Get the SHA-256 fingerprint of your signing key:
   ```bash
   keytool -list -v -keystore android.keystore -alias android
   ```
2. Paste the fingerprint into `assetlinks.json`.
3. Deploy `assetlinks.json` to your site at:
   ```
   https://vicespending.com/.well-known/assetlinks.json
   ```
   In Vercel, add a route in `vercel.json`:
   ```json
   { "source": "/.well-known/assetlinks.json", "destination": "/assetlinks.json" }
   ```
   and place `assetlinks.json` in `client/public/.well-known/`.

---

## Files in this directory

| File | Purpose |
|------|---------|
| `twa-manifest.json` | Bubblewrap configuration (edit host URL before use) |
| `assetlinks.json` | Digital Asset Links placeholder (fill in SHA-256 fingerprint) |
| `android.keystore` | Signing key — generated in Step 3, **never commit** |
| `README-android.md` | This file |
