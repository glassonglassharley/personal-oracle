const { clerkClient } = require('@clerk/express');
const pool = require('../db');
const { getInternalUserId } = require('../utils');

// Owner allowlist: comma-separated emails in PRO_ALLOWLIST_EMAILS. Parsed on
// every call so a Vercel env change takes effect without a code change.
// Unset or empty means nobody is allowlisted and only Stripe status counts.
function allowlistedEmails() {
  return new Set(
    String(process.env.PRO_ALLOWLIST_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Email for the account. Prefer the users.email column (set by password /
// magic-link signup and protected by a unique index). Clerk-created rows have
// no email stored locally, so fall back to Clerk for those identities only.
async function emailFor(userId, rowEmail) {
  if (rowEmail) return String(rowEmail).trim().toLowerCase();
  const identity = String(userId || '');
  if (!identity || /^\d+$/.test(identity) || identity.startsWith('username:') || identity.startsWith('wallet:')) {
    return null;
  }
  try {
    const u = await clerkClient.users.getUser(identity);
    const primary = u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId) || u.emailAddresses?.[0];
    return primary?.emailAddress ? String(primary.emailAddress).trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

// Single source of truth for the paid tier. Every Pro check — route guards,
// the /me payload, anything else — goes through here so the rule lives in
// exactly one place. Pro = active Stripe subscription OR email on the owner
// allowlist; the allowlist never blocks a paid user.
//
// PAYWALLS DISABLED FOR NOW: short-circuited to always return true so every
// account gets Pro features. The real check is preserved below, commented
// out, so this can be flipped back on by restoring it.
async function isPro(userId) {
  return true;
  /* eslint-disable no-unreachable */
  const uid = await getInternalUserId(userId);
  if (!uid) return false;
  const r = await pool.query('SELECT subscription_status, email FROM users WHERE id = $1', [uid]);
  const row = r.rows[0];
  if (!row) return false;
  if (row.subscription_status === 'active') return true;

  const allow = allowlistedEmails();
  if (allow.size === 0) return false;
  const email = await emailFor(userId, row.email);
  return Boolean(email && allow.has(email));
  /* eslint-enable no-unreachable */
}

// Express guard for Pro-only routes. `feature` is echoed in the body so the
// client can name what was gated.
function requirePro(feature) {
  return async (req, res, next) => {
    try {
      if (await isPro(req.auth.userId)) return next();
      res.status(403).json({ error: 'pro_required', feature });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { isPro, requirePro };
