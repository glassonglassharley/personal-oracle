const { clerkClient } = require('@clerk/express');
const pool = require('../db');

async function ensureUser(req, res, next) {
  try {
    const { userId } = req.auth;
    if (!userId) return next();

    const existing = await pool.query(
      'SELECT id FROM users WHERE clerk_user_id = $1', [userId]
    );

    if (existing.rows.length === 0) {
      let name = req.demoUsername ? `Demo ${req.demoUsername}` : 'User';
      if (!req.demoUsername) {
        try {
          const u = await clerkClient.users.getUser(userId);
          name = [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                 u.emailAddresses[0]?.emailAddress?.split('@')[0] || 'User';
        } catch (_) {}
      }
      await pool.query(
        'INSERT INTO users (clerk_user_id, name) VALUES ($1, $2)', [userId, name]
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { ensureUser };
