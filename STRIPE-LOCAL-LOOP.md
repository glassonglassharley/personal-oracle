# Vice to Value — Stripe local loop (test mode)

Plain terminal checklist. No agent needed. Every command is copy-paste; each
step says what "pass" looks like. Written 2026-09-11 against commit `7036cd0`.

**Read this first:** the local server (`server/index.js`) connects to the
`DATABASE_URL` in `.env`, which is the **production Neon database**. The test
below flips *your own* `users` row and adds rows to `processed_stripe_events`.
That is fine for your account; do not run it for anyone else's. Stripe itself
stays in test mode the whole time (`sk_test_` / `rk_test_` keys) — no real
money moves until you deliberately switch to live keys in Vercel.

---

## 0. One-time setup

```powershell
# Stripe CLI (not currently on PATH on this machine)
winget install Stripe.StripeCLI       # or: scoop install stripe
stripe login                          # opens the browser; pick the Vice to Value account, TEST mode
stripe whoami --format json           # pass: prints your account id, "livemode": false
```

In the Stripe Dashboard (test mode): create one Product "Vice to Value Pro"
with one **recurring monthly** price of $4.99. Copy its `price_...` id.

Create a **restricted key** (Developers → API keys → Create restricted key):
Checkout Sessions: Write, Customers: Write, Webhook endpoints: none needed.
Copy the `rk_test_...` value.

Append to `.env` (repo root — the server reads this file):

```
STRIPE_SECRET_KEY=rk_test_XXXXXXXX
STRIPE_PRICE_ID=price_XXXXXXXX
STRIPE_WEBHOOK_SECRET=            # filled in at step 2
```

---

## 1. Start the app (two terminals)

```powershell
# Terminal A — API on :3000
cd C:\Users\jmeny\personal-oracle\server
node index.js
# pass: "DB schema ready" then "Server on http://localhost:3000"
#       (this boot also applies the three migrations: subscription_status,
#        stripe_customer_id, processed_stripe_events)

# Terminal B — client on :5173 (proxies /api -> :3000)
cd C:\Users\jmeny\personal-oracle\client
npm run dev
```

Open http://localhost:5173, sign in with your normal account, go to
**Savings**. Pass: you see the blurred projection with the "$4.99 / month —
Go Pro" card. (If you already see the live chart, your row is already
`active` — check step 4 and reset with the SQL at the bottom.)

Note your numeric user id for later:

```powershell
# from the API, signed in — or run in the Neon SQL editor:
# SELECT id, name, subscription_status, stripe_customer_id FROM users ORDER BY id DESC LIMIT 10;
```

---

## 2. Start the webhook forwarder (Terminal C)

```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
# pass: "Ready! Your webhook signing secret is whsec_XXXX"
```

Put that `whsec_` value into `.env` as `STRIPE_WEBHOOK_SECRET`, then
**restart Terminal A** (`Ctrl+C`, `node index.js` again) — the server reads
`.env` at boot only.

---

## 3. Prove signature + routing with `stripe trigger` (cheap, no browser)

```powershell
stripe trigger customer.subscription.updated
```

Expected in Terminal C: `[200] POST http://localhost:3000/api/stripe/webhook`
Expected in Terminal A: `[STRIPE WEBHOOK] customer.subscription.updated evt_...: no user for {...}`

That `no user` / `unmatched` result is **correct**. `stripe trigger` builds a
throwaway customer that isn't mapped to any of your users, so the handler
verifies the signature, records the event id, and returns 200 without
touching a row. It proves: raw body arrives intact, secret is right, mount
order is right. It does **not** prove the flip — step 4 does.

Sanity check the negative path too:

```powershell
curl.exe -i -X POST http://localhost:3000/api/stripe/webhook -H "Content-Type: application/json" -H "stripe-signature: t=1,v1=bad" -d "{}"
# pass: HTTP/1.1 400  "Webhook Error: ..."
```

Why not `stripe trigger checkout.session.completed`? The CLI fixture creates a
**one-time payment** session (`mode: 'payment'`), which the handler ignores by
design. Only a real subscription session from the app exercises the flip.

---

## 4. The real flip — buy Pro in test mode from the app

1. In the browser (still on Savings) click **Go Pro**.
   Pass: you land on `checkout.stripe.com` showing "Vice to Value Pro $4.99/month".
   Fail: an error line under the button — its text is the server's message
   (`Stripe is not configured...` means `.env` / restart; `already_pro` means
   your row is already active).
2. Pay with Stripe's test card: `4242 4242 4242 4242`, any future expiry, any
   CVC, any ZIP.
3. You return to `http://localhost:5173/savings?checkout=success...` and the
   card says "Payment received. Pro will unlock here shortly".
4. Terminal C shows, within a second or two:
   ```
   [200] POST .../api/stripe/webhook   checkout.session.completed
   [200] POST .../api/stripe/webhook   customer.subscription.created   (ignored, expected)
   [200] POST .../api/stripe/webhook   customer.subscription.updated   (may or may not fire)
   [200] POST .../api/stripe/webhook   invoice.paid ...                (ignored, expected)
   ```
   Terminal A shows: `[STRIPE WEBHOOK] checkout.session.completed evt_...: user <your id> -> active`
5. **Reload the Savings page.** Pass: the blur is gone, the growth chart and
   asset cards are live, "+ Add asset" works (that's the server-side gate,
   `/api/assets`, now returning 200 instead of 403).

Confirm in the database (Neon SQL editor):

```sql
SELECT id, subscription_status, stripe_customer_id FROM users WHERE id = <your id>;
-- pass: subscription_status = 'active', stripe_customer_id = 'cus_...'
SELECT id, type, processed_at FROM processed_stripe_events ORDER BY processed_at DESC LIMIT 5;
-- pass: one row per handled event above
```

---

## 5. Idempotency — replay the SAME event (this is the CTE/transaction test)

Do **not** use `stripe trigger` twice: two triggers are two different event
ids and both will legitimately process. You need the same `evt_` id delivered
again.

```powershell
# take the evt_ id of checkout.session.completed from Terminal C or A
stripe events resend evt_XXXXXXXX
```

Pass, all three:
- Terminal C: `[200] POST ...`
- Terminal A: **no** `-> active` line for it (no second UPDATE)
- The endpoint's JSON response (visible in the Dashboard → Developers →
  Webhooks → the local listener → that delivery) is
  `{"received":true,"duplicate":true}`
- `processed_stripe_events` still has exactly one row for that id.

Fail = a second `-> active` log line, or a 500. Bring me the Terminal A output.

---

## 6. Cancellation path (optional, 1 minute)

Dashboard (test mode) → Customers → your `cus_...` → the subscription → Cancel
subscription → **immediately**. Terminal A: `customer.subscription.deleted
evt_...: user <id> -> free`. Reload Savings: blur + card are back.

---

## Reset between runs

```sql
UPDATE users SET subscription_status = 'free' WHERE id = <your id>;
-- keep stripe_customer_id; it's correct and reusable
```

(To fully start over, also cancel the test subscription in the Dashboard so
the next Go Pro doesn't get `already_pro`.)

---

## When this passes: going live

1. Vercel → project env: `STRIPE_SECRET_KEY` (**live** restricted key),
   `STRIPE_PRICE_ID` (the **live** price — live and test catalogs are separate,
   recreate the product in live mode), `STRIPE_WEBHOOK_SECRET` (from step 2
   below, not the CLI one).
2. Dashboard (live mode) → Developers → Webhooks → Add endpoint:
   `https://vice-tracker-orpin.vercel.app/api/stripe/webhook`, events
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret into Vercel.
3. Push `main`, deploy, buy Pro on your own account with a real card, then
   cancel it from the Dashboard. Watch the row flip both ways.
