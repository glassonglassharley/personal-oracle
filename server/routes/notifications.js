const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

function normalizeTimezone(value) {
  const timezone = String(value || 'UTC').trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch (_) {
    return 'UTC';
  }
}

router.get('/config', (req, res) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    pushEnabled: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
});

router.put('/settings', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    const sets = [];
    const vals = [];

    if (req.body.timezone !== undefined) {
      sets.push(`timezone = $${vals.length + 1}`);
      vals.push(normalizeTimezone(req.body.timezone));
    }
    if (req.body.nightly_reminders_enabled !== undefined) {
      sets.push(`nightly_reminders_enabled = $${vals.length + 1}`);
      vals.push(Boolean(req.body.nightly_reminders_enabled));
    }

    if (sets.length === 0) return res.json({});

    vals.push(uid);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length}
       RETURNING id, timezone, nightly_reminders_enabled`,
      vals
    );

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/subscriptions', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    const subscription = req.body.subscription || req.body;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Valid push subscription required' });
    }

    await pool.query(
      `INSERT INTO notification_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             updated_at = NOW()`,
      [uid, endpoint, p256dh, auth]
    );

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/preferences', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.json({});
    const r = await pool.query(
      `SELECT nightly_reminders_enabled, notif_streak_risk, notif_streak_milestone,
              notif_badge_earned, notif_level_up, notif_weekly_summary
       FROM users WHERE id = $1`, [uid]
    );
    res.json(r.rows[0] || {});
  } catch (err) { next(err); }
});

router.put('/preferences', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    if (!uid) return res.status(404).json({ error: 'User not found' });
    const fields = ['notif_streak_risk','notif_streak_milestone','notif_badge_earned','notif_level_up','notif_weekly_summary'];
    const sets = [], vals = [uid];
    fields.forEach(f => {
      if (f in req.body) { sets.push(`${f} = $${vals.length + 1}`); vals.push(Boolean(req.body[f])); }
    });
    if (sets.length === 0) return res.json({ ok: true });
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, vals);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/subscriptions', async (req, res, next) => {
  try {
    const uid = await getInternalUserId(req.auth.userId);
    const endpoint = req.body.endpoint;
    if (endpoint) {
      await pool.query('DELETE FROM notification_subscriptions WHERE user_id = $1 AND endpoint = $2', [uid, endpoint]);
    } else {
      await pool.query('DELETE FROM notification_subscriptions WHERE user_id = $1', [uid]);
    }
    await pool.query('UPDATE users SET nightly_reminders_enabled = FALSE WHERE id = $1', [uid]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
