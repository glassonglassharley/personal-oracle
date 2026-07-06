# Personal Oracle

Track your spending habits. Own your choices.

This repository is a monorepo for the **Vice to Value** product family:

| App | Folder | Description |
|---|---|---|
| **Personal Oracle** | `client/` + `server/` | Habit/vice spending tracker |
| **Growth Mirror** | `apps/training-log/` | Fitness, nutrition, and wellness log |
| **Income Growth Tracker** | `apps/pre-game/` | Income sources and daily action tracking |
| **Debt Assassination** | `apps/debt-assassination/` | Debt snowball payoff tracker |

See [`apps/README.md`](apps/README.md) for per-app dev commands and deployment notes.

---

## Personal Oracle (main app)

A full-stack web app to log, analyze, and reduce habitual spending — alcohol, coffee, cigarettes, anything you want to track. Built with Node/Express, PostgreSQL, React/Vite, and Clerk for authentication.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL (via `pg`) |
| Auth | Clerk (Node SDK + React SDK) |
| Frontend | React + Vite |
| Charts | Chart.js + react-chartjs-2 |

---

## Prerequisites

- Node.js 18+
- A PostgreSQL database (see [Provisioning Postgres](#provisioning-postgres))
- A Clerk account (see [Clerk Setup](#clerk-setup))

---

## Provisioning Postgres

### Option A — Supabase (free tier, hosted)

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. After the project provisions, go to **Settings → Database → Connection string → URI**.
3. Copy the URI — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. Use this as `DATABASE_URL` in your `.env`.

> Note: Supabase requires SSL. If you see SSL errors, append `?sslmode=require` to the connection string.

### Option B — Railway (free tier, hosted)

1. Go to [railway.app](https://railway.app) and create a new project.
2. Click **+ New → Database → Add PostgreSQL**.
3. Go to the Postgres service → **Connect** tab → copy the **DATABASE_URL**.
4. Use it as `DATABASE_URL` in your `.env`.

### Option C — Local Postgres

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16
createdb vice_tracker
# DATABASE_URL=postgresql://localhost:5432/vice_tracker
```

---

## Clerk Setup

1. Go to [clerk.com](https://clerk.com) and create a free application.
2. Choose your sign-in methods (email/password recommended; social logins optional).
3. In the Clerk dashboard, go to **API Keys**:
   - Copy **Publishable key** → `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`
   - Copy **Secret key** → `CLERK_SECRET_KEY`
4. Under **JWT Templates** (optional but recommended): create a template named `default` if you want custom claims. The app works without this.

---

## Environment Variables

Copy `.env.example` to `.env` at the project root and fill in your values:

```bash
cp .env.example .env
```

```
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> `VITE_CLERK_PUBLISHABLE_KEY` is the same value as `CLERK_PUBLISHABLE_KEY` — Vite requires the `VITE_` prefix to expose env vars to the browser bundle.

---

## Installation & Running

```bash
# 1. Install all dependencies (root + server + client)
npm run install:all

# 2. Start both servers concurrently
npm run dev
```

- API server: http://localhost:3000
- Frontend dev server: http://localhost:5173

The database schema is created automatically on first server start (using `CREATE TABLE IF NOT EXISTS`). No migrations needed.

---

## First-Time User Flow

1. Open http://localhost:5173 — you'll see the Clerk sign-in screen.
2. Create an account (email + password, or a configured social provider).
3. On sign-in, the server automatically creates a `users` record mapped to your Clerk ID.
4. You'll land on the **Vice Manager** page with a prompt to add your first vice.
5. Add a vice, then start logging entries on the **Log** page.

---

## API Reference

All routes require a valid Clerk session token in the `Authorization: Bearer <token>` header. All data is scoped to the authenticated user.

| Method | Path | Description |
|---|---|---|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me` | Update name |
| DELETE | `/api/users/me` | Delete account + all data |
| GET | `/api/vices` | List your vices |
| POST | `/api/vices` | Create a vice |
| PUT | `/api/vices/:id` | Update a vice |
| DELETE | `/api/vices/:id` | Delete a vice + all its entries |
| GET | `/api/entries?vice_id=&from=&to=` | List entries (optional date range) |
| POST | `/api/entries` | Upsert an entry (create or update by vice+date) |
| DELETE | `/api/entries/:id` | Delete a single entry |
| GET | `/api/stats/:vice_id` | Computed stats (today/week/month/year + averages) |
| GET | `/api/savings/:vice_id?days=365` | Savings projections + milestones |

---

## Deploying to Vercel

### Environment variables

Add these in the Vercel dashboard under **Project → Settings → Environment Variables**:

**Required:**

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your Supabase/Railway connection string |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same value as `CLERK_PUBLISHABLE_KEY` — the `VITE_` prefix is required for Vite to expose it to the browser bundle |

**Optional (enables AI insights, push notifications, and bank import):**

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys. Enables weekly AI insights, quit plans, and Wrapped AI summaries. |
| `VAPID_PUBLIC_KEY` | Generate with `node -e "require('web-push').generateVAPIDKeys()"` |
| `VAPID_PRIVATE_KEY` | Same command as above |
| `VAPID_SUBJECT` | Your contact email, e.g. `mailto:you@example.com` |
| `CRON_SECRET` | Any random string — used to authenticate Vercel cron jobs |
| `PLAID_CLIENT_ID` | [dashboard.plaid.com](https://dashboard.plaid.com) |
| `PLAID_SECRET` | Plaid dashboard → Credentials |
| `PLAID_ENV` | `sandbox` for testing, `production` for live bank data |

> Supabase users: append `?sslmode=require` to `DATABASE_URL` if you see SSL connection errors.

### Deploy steps

1. Push the project to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Vercel will auto-detect the `vercel.json` at the root. No framework preset needed.
4. Add the environment variables listed above in the **Environment Variables** section before clicking deploy.
5. Click **Deploy**.

Vercel will:
- Run `cd client && npm install && npm run build` and serve the output from `client/dist` as the static frontend
- Deploy `api/index.js` as a Node.js serverless function that handles all `/api/*` traffic
- Route everything else to the React SPA (`index.html`)

The database schema is created automatically on the first request to the API (idempotent `CREATE TABLE IF NOT EXISTS`), so no manual migration step is needed after deploy.

### How the routing works

```
vercel.json
  rewrites: /api/:path*  →  api/index.js  (Express serverless function)
  everything else        →  client/dist   (Vite SPA, falls back to index.html)
```

---

## Project Structure

```
personal-oracle/
├── apps/
│   ├── training-log/     # Growth Mirror (fitness/wellness PWA)
│   ├── pre-game/         # Income Growth Tracker (Next.js)
│   ├── debt-assassination/
│   └── README.md
├── .env.example
├── vercel.json           # Personal Oracle Vercel routing + build config
├── package.json          # root: server deps hoisted here for Vercel bundling
├── api/
│   └── index.js          # Vercel serverless entry — exports Express app
├── server/
│   ├── app.js            # Express app setup (no listen — shared by local + serverless)
│   ├── index.js          # local dev only: requires app, calls listen
│   ├── db.js             # pg Pool + schema init
│   ├── utils.js          # ownership helpers
│   ├── middleware/
│   │   └── auth.js       # ensureUser (auto-create on first login)
│   └── routes/
│       ├── users.js
│       ├── vices.js
│       ├── entries.js
│       ├── stats.js
│       └── savings.js
└── client/
    ├── vite.config.js    # proxies /api → localhost:3000 in local dev
    └── src/
        ├── App.jsx       # ClerkProvider, routing, NavBar
        ├── useApi.js     # fetch wrapper that injects Bearer token
        └── pages/
            ├── Dashboard.jsx
            ├── LogEntry.jsx
            ├── Savings.jsx
            └── ViceManager.jsx
```
