const express = require('express');
const router = express.Router();
const pool = require('../db');

const REMINDER_HOUR = Number(process.env.NIGHTLY_REMINDER_HOUR || 21);

function authCron(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return next();
  const auth = req.get('authorization') || '';
  const headerSecret = req.get('x-cron-secret') || '';
  if (auth === `Bearer ${secret}` || headerSecret === secret) return next();
  return res.status(401).json({ error: 'Unauthorized cron request' });
}

// Returns the configured webpush instance, or null if VAPID keys are missing/web-push fails to load.
function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  try {
    const webpush = require('web-push');
    const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@vice-tracker.local';
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return webpush;
  } catch (err) {
    console.error('web-push load failed:', err.message);
    return null;
  }
}

function localDateParts(timezone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

function previousDateString(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function zeroFillUserDay(userId, dateString) {
  const result = await pool.query(
    `INSERT INTO entries (vice_id, date, quantity, price_per_unit)
     SELECT v.id, $2::date, 0, v.default_price
     FROM vices v
     WHERE v.user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM entries e WHERE e.vice_id = v.id AND e.date = $2::date
       )`,
    [userId, dateString]
  );
  return result.rowCount || 0;
}

async function sendReminder(user, webpush) {
  if (!webpush || !user.nightly_reminders_enabled) return 0;

  const subscriptions = await pool.query(
    'SELECT id, endpoint, p256dh, auth FROM notification_subscriptions WHERE user_id = $1',
    [user.id]
  );
  if (subscriptions.rows.length === 0) return 0;

  const payload = JSON.stringify({
    title: 'Track tonight',
    body: 'Quick reminder: log your vices for today. If you skip it, Vice Spending will count the missed day as 0.',
    url: '/log',
  });

  let sent = 0;
  for (const sub of subscriptions.rows) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM notification_subscriptions WHERE id = $1', [sub.id]);
      } else {
        console.error('Push reminder failed:', err.message);
      }
    }
  }
  return sent;
}

// ── /api/cron/streak-check — run at 8pm per user's timezone ──────────────
// Sends "streak at risk" push if user has streak ≥ 3 and hasn't logged today
router.all('/streak-check', authCron, async (req, res, next) => {
  try {
    const { sendPushToUser } = require('../utils');
    const STREAK_RISK_HOUR = 20; // 8pm
    const users = await pool.query(
      `SELECT id, timezone, notif_streak_risk FROM users WHERE nightly_reminders_enabled = TRUE`
    );
    let sent = 0;
    for (const user of users.rows) {
      if (user.notif_streak_risk === false) continue;
      const local = localDateParts(user.timezone || 'UTC');
      if (local.hour !== STREAK_RISK_HOUR) continue;

      // Check today's entries
      const todayCheck = await pool.query(`
        SELECT COUNT(*)::int AS cnt FROM entries e
        JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1 AND e.date = $2
      `, [user.id, local.date]);
      if (todayCheck.rows[0].cnt > 0) continue;

      // Compute current streak
      const recentRows = await pool.query(`
        SELECT e.date::text, SUM(e.quantity)::float AS qty
        FROM entries e JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1
        GROUP BY e.date ORDER BY e.date DESC LIMIT 60
      `, [user.id]);
      let streak = 0;
      const dateSet = {};
      recentRows.rows.forEach(r => { dateSet[r.date] = r.qty === 0; });
      const d = new Date(local.date + 'T00:00:00');
      d.setDate(d.getDate() - 1); // start from yesterday (today not logged)
      for (let i = 0; i < 60; i++) {
        const ds = d.toISOString().split('T')[0];
        if (ds in dateSet) { if (dateSet[ds]) streak++; else break; }
        else break;
        d.setDate(d.getDate() - 1);
      }
      if (streak < 3) continue;

      await sendPushToUser(user.id, {
        title: '⚠️ Streak at risk',
        body: `Your ${streak}-day streak is on the line — log today to keep it alive`,
        url: '/log',
      });
      sent++;
    }
    res.json({ ok: true, sent });
  } catch (err) { next(err); }
});

// ── /api/cron/weekly-summary — run Sunday at 9am per user's timezone ─────
router.all('/weekly-summary', authCron, async (req, res, next) => {
  try {
    const { sendPushToUser } = require('../utils');
    const SUMMARY_HOUR = 9;
    const users = await pool.query(
      `SELECT id, timezone, notif_weekly_summary FROM users WHERE nightly_reminders_enabled = TRUE`
    );
    let sent = 0;
    for (const user of users.rows) {
      if (user.notif_weekly_summary === false) continue;
      const local = localDateParts(user.timezone || 'UTC');
      const dayOfWeek = new Date(local.date + 'T00:00:00').getDay();
      if (dayOfWeek !== 0 || local.hour !== SUMMARY_HOUR) continue;

      const weekAgo = new Date(local.date + 'T00:00:00');
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const statsRow = await pool.query(`
        SELECT
          COUNT(DISTINCT CASE WHEN e.quantity = 0 THEN e.date END)::int AS clean_days,
          COALESCE(SUM(e.quantity * e.price_per_unit), 0)::float AS total_spend
        FROM entries e JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1 AND e.date >= $2 AND e.date <= $3
      `, [user.id, weekAgoStr, local.date]);

      const { clean_days, total_spend } = statsRow.rows[0];

      // Quick streak count
      const recentRows = await pool.query(`
        SELECT e.date::text, SUM(e.quantity)::float AS qty
        FROM entries e JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1
        GROUP BY e.date ORDER BY e.date DESC LIMIT 30
      `, [user.id]);
      let streak = 0;
      const dateSet = {};
      recentRows.rows.forEach(r => { dateSet[r.date] = r.qty === 0; });
      const d = new Date(local.date + 'T00:00:00');
      for (let i = 0; i < 30; i++) {
        const ds = d.toISOString().split('T')[0];
        if (ds in dateSet) { if (dateSet[ds]) streak++; else break; }
        else if (i === 0) { d.setDate(d.getDate() - 1); continue; }
        else break;
        d.setDate(d.getDate() - 1);
      }

      await sendPushToUser(user.id, {
        title: '📊 Weekly summary',
        body: `${clean_days} clean days · $${total_spend.toFixed(0)} spent · ${streak}-day streak`,
        url: '/',
      });
      sent++;
    }
    res.json({ ok: true, sent });
  } catch (err) { next(err); }
});

router.all('/nightly', authCron, async (req, res, next) => {
  try {
    const webpush = configureWebPush();
    const users = await pool.query(
      `SELECT id, timezone, nightly_reminders_enabled, last_nightly_reminder_date, last_zero_fill_date
       FROM users`
    );

    let zeroEntriesCreated = 0;
    let remindersSent = 0;
    const touchedUsers = [];

    for (const user of users.rows) {
      const timezone = user.timezone || 'UTC';
      const local = localDateParts(timezone);
      const yesterday = previousDateString(local.date);

      if (String(user.last_zero_fill_date || '').slice(0, 10) !== yesterday) {
        zeroEntriesCreated += await zeroFillUserDay(user.id, yesterday);
        await pool.query('UPDATE users SET last_zero_fill_date = $1 WHERE id = $2', [yesterday, user.id]);
      }

      if (
        user.nightly_reminders_enabled &&
        local.hour === REMINDER_HOUR &&
        String(user.last_nightly_reminder_date || '').slice(0, 10) !== local.date
      ) {
        remindersSent += await sendReminder(user, webpush);
        await pool.query('UPDATE users SET last_nightly_reminder_date = $1 WHERE id = $2', [local.date, user.id]);
      }

      touchedUsers.push(user.id);
    }

    res.json({
      ok: true,
      users_checked: touchedUsers.length,
      zero_entries_created: zeroEntriesCreated,
      reminders_sent: remindersSent,
      push_ready: Boolean(webpush),
      reminder_hour: REMINDER_HOUR,
    });
  } catch (err) { next(err); }
});

module.exports = router;
