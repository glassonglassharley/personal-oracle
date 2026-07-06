const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

// DELETE /api/account — remove Plaid items, delete all DB rows, delete Clerk user
router.delete('/', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.status(404).json({ error: 'User not found' });

    const identity = String(req.auth.userId || '');

    // 1. Remove Plaid connections (best-effort, before DB deletion)
    try {
      const { rows: plaidRows } = await pool.query(
        'SELECT access_token FROM plaid_connections WHERE user_id = $1',
        [uid]
      );
      if (plaidRows.length > 0 && process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) {
        const { PlaidApi, Configuration, PlaidEnvironments } = require('plaid');
        const plaidClient = new PlaidApi(new Configuration({
          basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
          baseOptions: {
            headers: {
              'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
              'PLAID-SECRET': process.env.PLAID_SECRET,
            },
          },
        }));
        await Promise.allSettled(
          plaidRows.map(row => plaidClient.itemRemove({ access_token: row.access_token }))
        );
      }
    } catch (_) {}

    // 2. Delete all DB rows in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // entries → vices (FK — delete entries first)
      await client.query(
        'DELETE FROM entries WHERE vice_id IN (SELECT id FROM vices WHERE user_id = $1)', [uid]
      );
      await client.query('DELETE FROM vices WHERE user_id = $1', [uid]);
      for (const tbl of [
        'goals', 'badges', 'user_xp', 'insights_cache', 'voice_tokens',
        'notification_subscriptions', 'push_subscriptions', 'coach_usage',
        'savings_entries', 'plaid_connections', 'magic_links', 'user_assets',
        'challenges',
      ]) {
        await client.query(`DELETE FROM ${tbl} WHERE user_id = $1`, [uid]).catch(() => {});
      }
      await client.query(
        'DELETE FROM friendships WHERE requester_id = $1 OR addressee_id = $1', [uid]
      ).catch(() => {});
      await client.query('DELETE FROM users WHERE id = $1', [uid]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // 3. Delete Clerk user — only for real Clerk-auth accounts (not VT JWT, username:, or wallet:)
    const isClerkUser = !req.vtAuth && !req.walletAuth && !req.usernameAuth
      && !identity.startsWith('username:') && !identity.startsWith('wallet:');
    if (isClerkUser) {
      try {
        const { clerkClient } = require('@clerk/express');
        await clerkClient.users.deleteUser(identity);
      } catch (_) {}
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/account/export — comprehensive JSON export of all user data
router.get('/export', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.status(404).json({ error: 'User not found' });

    const [userRow, vices, logs, goals, badges, xp, assets] = await Promise.all([
      pool.query(`
        SELECT auth_username, name, email, companion_type, companion_state,
               savings_balance, savings_updated_at, timezone, created_at,
               nightly_reminders_enabled, partner_privacy
        FROM users WHERE id = $1
      `, [uid]).then(r => r.rows[0] || {}),

      pool.query(`
        SELECT name, emoji, unit_label, default_price::float, category,
               monthly_budget::float, plaid_categories, created_at
        FROM vices WHERE user_id = $1 ORDER BY name
      `, [uid]).then(r => r.rows),

      pool.query(`
        SELECT v.name AS vice, v.emoji, e.date::text,
               e.quantity::float, e.price_per_unit::float,
               (e.quantity * e.price_per_unit)::float AS total_spent,
               e.note, e.created_at
        FROM entries e
        JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1
        ORDER BY e.date DESC, v.name
      `, [uid]).then(r => r.rows),

      pool.query(`
        SELECT title, target_amount::float, created_at, completed_at
        FROM goals WHERE user_id = $1 ORDER BY created_at DESC
      `, [uid]).then(r => r.rows),

      pool.query(`
        SELECT badge_id, earned_at FROM badges WHERE user_id = $1 ORDER BY earned_at DESC
      `, [uid]).then(r => r.rows),

      pool.query(`
        SELECT total_xp, level, updated_at FROM user_xp WHERE user_id = $1
      `, [uid]).then(r => r.rows[0] || null),

      pool.query(`
        SELECT name, emoji, category, annual_return_pct, description, created_at
        FROM user_assets WHERE user_id = $1 ORDER BY name
      `, [uid]).then(r => r.rows),
    ]);

    const data = {
      exported_at: new Date().toISOString(),
      profile: {
        username: userRow.auth_username,
        display_name: userRow.name,
        email: userRow.email,
        timezone: userRow.timezone,
        joined_at: userRow.created_at,
      },
      companion: {
        type: userRow.companion_type,
        state: userRow.companion_state,
      },
      savings: {
        balance: parseFloat(userRow.savings_balance || 0),
        updated_at: userRow.savings_updated_at,
      },
      xp,
      vices,
      logs,
      goals,
      badges,
      assets,
      settings: {
        nightly_reminders_enabled: userRow.nightly_reminders_enabled,
        partner_privacy: userRow.partner_privacy,
      },
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="personal-oracle-export-${dateStr}.json"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (err) { next(err); }
});

module.exports = router;
