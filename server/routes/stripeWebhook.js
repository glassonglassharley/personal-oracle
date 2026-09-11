const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getStripe } = require('../lib/stripe');

// Stripe subscription.status -> users.subscription_status. Anything not
// listed (incomplete, paused) leaves the row untouched. past_due stays
// 'active' as a grace period — tune here, nowhere else.
const SUBSCRIPTION_STATUS_MAP = {
  active: 'active',
  trialing: 'active',
  past_due: 'active',
  canceled: 'free',
  unpaid: 'free',
  incomplete_expired: 'free',
};

function stripeId(value) {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id || null;
}

function numericOrNull(value) {
  return /^\d+$/.test(String(value ?? '')) ? parseInt(value, 10) : null;
}

// Primary: stripe_customer_id set by /api/checkout. Fallbacks: the user id we
// stamped on the subscription metadata, then the session's client_reference_id.
async function resolveUserId(client, { customerId, metadataUserId, clientReferenceId }) {
  if (customerId) {
    const r = await client.query('SELECT id FROM users WHERE stripe_customer_id = $1', [customerId]);
    if (r.rows[0]) return r.rows[0].id;
  }
  for (const candidate of [numericOrNull(metadataUserId), numericOrNull(clientReferenceId)]) {
    if (candidate == null) continue;
    const r = await client.query('SELECT id FROM users WHERE id = $1', [candidate]);
    if (r.rows[0]) return r.rows[0].id;
  }
  return null;
}

// Returns { userId lookup keys, nextStatus } or null when the event type is
// one we don't act on.
function planFor(event) {
  const obj = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
      if (obj.mode !== 'subscription') return null;
      return {
        keys: { customerId: stripeId(obj.customer), clientReferenceId: obj.client_reference_id },
        nextStatus: 'active',
      };
    case 'customer.subscription.updated':
      return {
        keys: { customerId: stripeId(obj.customer), metadataUserId: obj.metadata?.vtv_user_id },
        nextStatus: SUBSCRIPTION_STATUS_MAP[obj.status] ?? null,
      };
    case 'customer.subscription.deleted':
      return {
        keys: { customerId: stripeId(obj.customer), metadataUserId: obj.metadata?.vtv_user_id },
        nextStatus: 'free',
      };
    default:
      return null;
  }
}

// POST /api/stripe/webhook — mounted in app.js ABOVE express.json() so the raw
// body reaches constructEvent intact. No session auth: the signature is the auth.
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET is not set');
    return res.status(503).send('Webhook not configured');
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, req.get('stripe-signature'), secret);
  } catch (err) {
    console.warn('[STRIPE WEBHOOK] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const plan = planFor(event);
  if (!plan || !plan.nextStatus) {
    return res.json({ received: true, ignored: event.type });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const marker = await client.query(
      'INSERT INTO processed_stripe_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id',
      [event.id, event.type]
    );
    if (marker.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ received: true, duplicate: true });
    }

    const userId = await resolveUserId(client, plan.keys);
    if (!userId) {
      // Keep the marker so this exact event isn't retried forever; a human
      // can reconcile from the log.
      await client.query('COMMIT');
      console.error(`[STRIPE WEBHOOK] ${event.type} ${event.id}: no user for`, plan.keys);
      return res.json({ received: true, unmatched: true });
    }

    await client.query(
      'UPDATE users SET subscription_status = $1 WHERE id = $2',
      [plan.nextStatus, userId]
    );
    await client.query('COMMIT');
    console.log(`[STRIPE WEBHOOK] ${event.type} ${event.id}: user ${userId} -> ${plan.nextStatus}`);
    res.json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[STRIPE WEBHOOK] ${event.type} ${event.id} failed:`, err.stack || err.message);
    // Non-2xx so Stripe retries; the rolled-back marker lets the retry process.
    res.status(500).send('Webhook processing failed');
  } finally {
    client.release();
  }
});

module.exports = router;
