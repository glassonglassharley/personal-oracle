# Personal Growth Archive

Personal fitness tracker PWA. Vite + React frontend, Vercel serverless API, Upstash Redis (via Vercel KV) for storage.

## Setup

### Environment Variables

| Variable | Description |
|---|---|
| `LOG_SECRET` | Your passphrase — entered on first open, stored in localStorage |
| `KV_REST_API_URL` | Set automatically when you link a Vercel KV store |
| `KV_REST_API_TOKEN` | Set automatically when you link a Vercel KV store |
| `HIGGSFIELD_API_KEY` | API key for Higgsfield image generation (avatar feature) |

### Deploy

```bash
npm install
npm run build        # verify build
vercel --prod        # deploy
vercel storage add kv  # create KV store (name it training-log-kv)
vercel env add LOG_SECRET production  # set your passphrase
vercel --prod        # redeploy with env vars
```

---

## Add to iPhone Home Screen (PWA)

1. Open your deployed URL in **Safari** on your iPhone
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Name it "Personal Growth Archive" → tap **Add**

It will appear as a full-screen app with no browser chrome.

---

## Roadmap

### Local Odysseus dashboard assistant

Connect the deployed dashboard assistant to the local Odysseus model without exposing Odysseus directly.

Preferred route:

```txt
Vercel app -> Cloudflare/ngrok tunnel -> local secret-protected proxy -> Odysseus local API
```

Implementation notes:

- Add a tiny local Node proxy at `scripts/odysseus-proxy.js`.
- Proxy listens on `http://localhost:8787`.
- Proxy exposes `POST /v1/chat/completions`.
- Require `x-odysseus-secret`.
- Expected secret comes from local `ODYSSEUS_SECRET`.
- Forward authorized requests to `ODYSSEUS_BASE_URL`, defaulting to `http://localhost:11434/v1/chat/completions`.
- Do not point a tunnel directly at Odysseus.
- Update `api/log.js` so AI requests include `x-odysseus-secret: process.env.ODYSSEUS_SECRET` only when that env var exists.
- Keep regular OpenAI-compatible behavior working when `ODYSSEUS_SECRET` is not set.

Vercel env vars:

```txt
AI_BASE_URL=https://YOUR-TUNNEL.trycloudflare.com/v1/chat/completions
AI_API_KEY=local
AI_MODEL=odysseus
ODYSSEUS_SECRET=your_long_random_secret
```

Local desktop env vars:

```txt
ODYSSEUS_SECRET=your_long_random_secret
ODYSSEUS_BASE_URL=http://localhost:11434/v1/chat/completions
ODYSSEUS_API_KEY=local
```

Run locally:

```powershell
npm run odysseus:proxy
cloudflared tunnel --url http://localhost:8787
```

Privacy note: the tunnel provider is still in the path, so keep the tunnel URL private, require the secret header, rotate the secret if it leaks, and keep dashboard payloads small.

---

## Apple Health Shortcut Setup

Create a Shortcut that logs a workout from Apple Health automatically.

### Steps

1. Open the **Shortcuts** app → tap **+** to create a new shortcut
2. Add action: **Find Health Samples** → Category: **Workouts**, Sort: **Start Date descending**, Limit: **1**
3. Add action: **Get Variable** → select the workout from step 2
4. Add action: **Get Contents of URL**
   - **URL**: `https://YOUR-APP.vercel.app/api/log`
   - **Method**: `POST`
   - **Headers**: `Content-Type` → `application/json`
   - **Request Body**: `JSON`
     - `secret` → your `LOG_SECRET` passphrase
     - `entry` → a dictionary:
       - `type` → `Workout Activity Type` (from Health sample)
       - `duration` → `Duration` (in minutes — divide seconds by 60)
       - `intensity` → `3` (hardcode or adjust)
       - `date` → `Start Date` (from Health sample, ISO format)
       - `notes` → `"Logged via Apple Health"`
5. Add to **Automation**: Settings → Shortcuts → Automation → **New Automation** → **Workout** → **Ends** → run the shortcut

After every workout tracked in Apple Health, the shortcut fires and POSTs the entry to your log automatically.

### Manual Shortcut (simpler)

If full automation is too complex, create a one-tap shortcut that opens your Personal Growth Archive URL directly:

1. Shortcuts → **+** → **Open URL** → `https://YOUR-APP.vercel.app`
2. Name it "Log Workout" and add to Home Screen
