const pool = require('../db');
const { getInternalUserId } = require('../utils');

// Single source of truth for the paid tier. Every Pro check — route guards,
// the /me payload, anything else — goes through here so the rule lives in
// exactly one place.
async function isPro(userId) {
  const uid = await getInternalUserId(userId);
  if (!uid) return false;
  const r = await pool.query('SELECT subscription_status FROM users WHERE id = $1', [uid]);
  return r.rows[0]?.subscription_status === 'active';
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
