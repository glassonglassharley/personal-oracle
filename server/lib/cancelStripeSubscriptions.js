const pool = require('../db');
const { getStripe } = require('./stripe');

// Statuses with nothing left to cancel. Everything else (active, trialing,
// past_due, unpaid, incomplete, paused) still bills or can resume billing.
const TERMINAL = new Set(['canceled', 'incomplete_expired']);

// Called by both account-deletion paths BEFORE the users row is deleted. Any
// failure throws so the caller aborts the delete: a deleted user who is still
// being charged is worse than a delete that has to be retried. Cancellation is
// immediate, not at period end — once the account is gone there is nothing
// left to serve for the remainder of the period.
async function cancelStripeSubscriptionsForUser(uid) {
  const r = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [uid]);
  const customerId = r.rows[0]?.stripe_customer_id;
  if (!customerId) return { customerId: null, canceled: [] };

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    // A customer exists but Stripe isn't configured here: we cannot prove the
    // billing is stopped, so refuse rather than orphan a paying subscription.
    throw Object.assign(
      new Error('Cannot delete this account right now: billing is not reachable. Please try again later.'),
      { status: 503, cause: err }
    );
  }

  let subs;
  try {
    subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  } catch (err) {
    throw Object.assign(
      new Error('Cannot delete this account right now: billing lookup failed. Please try again later.'),
      { status: 502, cause: err }
    );
  }

  const canceled = [];
  for (const sub of subs.data) {
    if (TERMINAL.has(sub.status)) continue;
    try {
      await stripe.subscriptions.cancel(sub.id);
      canceled.push(sub.id);
    } catch (err) {
      // Stripe returns resource_missing / already-canceled variants as errors;
      // re-check before treating it as fatal so a retry of a half-done cancel
      // does not get stuck forever.
      const fresh = await stripe.subscriptions.retrieve(sub.id).catch(() => null);
      if (fresh && TERMINAL.has(fresh.status)) { canceled.push(sub.id); continue; }
      throw Object.assign(
        new Error('Cannot delete this account right now: your subscription could not be canceled. Please try again later.'),
        { status: 502, cause: err }
      );
    }
  }

  if (canceled.length) console.log(`[account delete] user ${uid}: canceled Stripe subscription(s) ${canceled.join(', ')}`);
  return { customerId, canceled };
}

module.exports = { cancelStripeSubscriptionsForUser };
