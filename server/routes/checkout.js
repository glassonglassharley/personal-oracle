const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');
const { isPro } = require('../lib/entitlements');
const { getStripe, getProPriceId } = require('../lib/stripe');

// Fixed label so every Pro checkout groups together in the Stripe Dashboard.
const INTEGRATION_IDENTIFIER = 'vtv-pro-checkout-qmxrtwkd';

function appUrl() {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
}

// Reuse the Stripe customer if this user already has one, otherwise create it
// and pin it to the row. The conditional UPDATE means two concurrent first
// checkouts can't each attach a different customer — the loser re-reads.
async function ensureStripeCustomer(stripe, uid) {
  const r = await pool.query('SELECT stripe_customer_id, email, name FROM users WHERE id = $1', [uid]);
  const user = r.rows[0];
  if (!user) return null;
  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    ...(user.email ? { email: user.email } : {}),
    ...(user.name ? { name: user.name } : {}),
    metadata: { vtv_user_id: String(uid) },
  });

  const upd = await pool.query(
    'UPDATE users SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL RETURNING stripe_customer_id',
    [customer.id, uid]
  );
  if (upd.rows.length > 0) return customer.id;

  const again = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [uid]);
  return again.rows[0]?.stripe_customer_id || customer.id;
}

// POST /api/checkout — start a Stripe Checkout Session for the Pro subscription.
router.post('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.status(404).json({ error: 'User not found' });

    if (await isPro(req.auth.userId)) {
      return res.status(409).json({ error: 'already_pro' });
    }

    const stripe = getStripe();
    const priceId = getProPriceId();
    const customerId = await ensureStripeCustomer(stripe, uid);
    if (!customerId) return res.status(404).json({ error: 'User not found' });

    const base = appUrl();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: String(uid),
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { vtv_user_id: String(uid) } },
      success_url: `${base}/savings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/savings?checkout=cancel`,
      integration_identifier: INTEGRATION_IDENTIFIER,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
