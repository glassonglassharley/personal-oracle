const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');
const { evaluateTree, seedBase, markCelebrated } = require('../lib/treeGrowth');

// Server-owned key inside companion_state. Clients never write it: PUT
// strips it from the body and keeps the stored value.
const GROWTH_KEY = '_growth';

async function getMyId(clerkUserId) {
  const id = await getInternalUserId(clerkUserId);
  if (!id) throw Object.assign(new Error('User not found'), { status: 404 });
  return id;
}

function todayIn(timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function publicState(state) {
  if (!state || typeof state !== 'object') return state || {};
  const { [GROWTH_KEY]: _omit, ...rest } = state;
  return rest;
}

// GET /api/companion — returns companion state + live growth data
router.get('/', async (req, res, next) => {
  try {
    const userId = await getMyId(req.auth.userId);

    const { rows } = await pool.query(
      'SELECT companion_type, companion_state, created_at, savings_balance, timezone FROM users WHERE id = $1',
      [userId]
    );
    const user = rows[0];
    if (!user.companion_type) return res.json({ companion_type: null });

    const totalSaved = Number(user.savings_balance || 0);
    const today = todayIn(user.timezone);

    // One row per logged day. A day is clean when every vice was logged at 0.
    const daysQ = await pool.query(`
      SELECT e.date::date::text AS date,
             (MAX(e.quantity) = 0
              AND COUNT(DISTINCT e.vice_id) = (SELECT COUNT(*) FROM vices WHERE user_id = $1)) AS clean
      FROM entries e
      JOIN vices v ON v.id = e.vice_id
      WHERE v.user_id = $1 AND e.date <= $2::date
      GROUP BY e.date::date
      ORDER BY 1
    `, [userId, today]);
    const days = daysQ.rows.map(r => ({ date: r.date, clean: r.clean === true }));
    const firstEntry = days[0]?.date || null;

    let daysTracked = 0;
    if (firstEntry) {
      daysTracked = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${firstEntry}T00:00:00Z`)) / 86400000) + 1;
    }

    const state = user.companion_state || {};
    let tree = null;
    let evaluated = null;
    if (user.companion_type === 'tree') {
      const [seriesQ, debtQ] = await Promise.all([
        pool.query(`
          SELECT balance
          FROM savings_balance_history
          WHERE user_id = $1 AND (account_id = '__combined__' OR account_id IS NULL)
          ORDER BY COALESCE(snapshot_date, recorded_at::date), COALESCE(captured_at, recorded_at)
        `, [userId]),
        pool.query(
          'SELECT COALESCE(SUM(amount), 0) AS paid FROM debt_payments WHERE user_id = $1 AND amount > 0 AND paid_at <= NOW()',
          [userId]
        ),
      ]);

      evaluated = evaluateTree({
        species: state.species || 'oak',
        savingsSeries: seriesQ.rows.map(r => Number(r.balance)),
        currentSavings: totalSaved,
        debtPaid: Number(debtQ.rows[0]?.paid || 0),
        days,
        today,
        accountCreatedAt: user.created_at ? new Date(user.created_at).toISOString() : null,
        firstEntryDate: firstEntry ? `${firstEntry}T00:00:00Z` : null,
        legacySavings: totalSaved,
        stored: state[GROWTH_KEY] || null,
      });

      if (evaluated.changed) {
        await pool.query(
          `UPDATE users
           SET companion_state = jsonb_set(COALESCE(companion_state, '{}'::jsonb), '{${GROWTH_KEY}}', $1::jsonb)
           WHERE id = $2 AND companion_type = 'tree'`,
          [JSON.stringify(evaluated.state), userId]
        );
      }
      tree = { ...evaluated.view, seedBase: seedBase(userId) };
    }

    const stats = evaluated?.stats;
    const cleanDays = stats ? stats.cleanDays : days.filter(d => d.clean).length;
    const streak = stats ? stats.streak : currentStreak(days, today);
    const charLevel = Math.min(50, Math.floor(cleanDays / 5) + 1);
    const charXp = (cleanDays % 5) / 5;
    const currentMonth = new Date().getMonth() + 1;

    const milestones = tree
      ? tree.timeline.map(m => ({ text: m.text, at: m.at }))
      : buildMilestones(totalSaved, cleanDays, streak, daysTracked);

    res.json({
      companion_type: user.companion_type,
      companion_state: publicState(state),
      growth: {
        charLevel,
        charXp,
        totalSaved,
        cleanDays,
        streak,
        daysTracked,
        isDecember: currentMonth === 12,
        hasFlowers: tree ? tree.features.blossom > 0 : streak >= 7,
        milestones,
        tree,
      },
    });
  } catch (err) { next(err); }
});

// PUT /api/companion — save companion config
router.put('/', async (req, res, next) => {
  try {
    const userId = await getMyId(req.auth.userId);
    const { companion_type, companion_state } = req.body;
    if (!companion_type) return res.status(400).json({ error: 'companion_type required' });

    const current = await pool.query('SELECT companion_type, companion_state FROM users WHERE id = $1', [userId]);
    const prev = current.rows[0] || {};
    const next = { ...publicState(companion_state || {}) };
    const storedGrowth = prev.companion_state?.[GROWTH_KEY];
    if (storedGrowth) {
      next[GROWTH_KEY] = storedGrowth;
    } else if (!prev.companion_type && companion_type === 'tree') {
      // Brand-new companion: starts as a seedling. (Trees that existed before
      // the growth model have no stored state and get their legacy floor.)
      next[GROWTH_KEY] = { v: 1, g: 0, at: new Date().toISOString(), peakAt: null, reached: {}, celebrated: [] };
    }

    await pool.query(
      'UPDATE users SET companion_type = $1, companion_state = $2 WHERE id = $3',
      [companion_type, JSON.stringify(next), userId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/companion/celebrated — the client played these milestone
// animations; never play them again.
router.post('/celebrated', async (req, res, next) => {
  try {
    const userId = await getMyId(req.auth.userId);
    const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter(k => typeof k === 'string').slice(0, 32) : [];
    const { rows } = await pool.query('SELECT companion_state FROM users WHERE id = $1', [userId]);
    const stored = rows[0]?.companion_state?.[GROWTH_KEY];
    if (!stored || !keys.length) return res.json({ ok: true });
    const updated = markCelebrated(stored, keys);
    await pool.query(
      `UPDATE users
       SET companion_state = jsonb_set(COALESCE(companion_state, '{}'::jsonb), '{${GROWTH_KEY}}', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(updated), userId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function currentStreak(days, today) {
  const clean = new Set(days.filter(d => d.clean).map(d => d.date));
  let streak = 0;
  const cur = new Date(`${today}T00:00:00Z`);
  while (clean.has(cur.toISOString().slice(0, 10))) {
    streak++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return streak;
}

function buildMilestones(totalSaved, cleanDays, streak, daysTracked) {
  const events = [];
  if (daysTracked >= 1) events.push({ text: 'Started your journey' });
  if (daysTracked >= 7) events.push({ text: 'One week of tracking' });
  if (daysTracked >= 30) events.push({ text: 'One full month tracked' });
  if (cleanDays >= 1) events.push({ text: 'First clean day logged' });
  if (cleanDays >= 7) events.push({ text: 'Reached level 2' });
  if (totalSaved >= 50) events.push({ text: 'Unlocked Tier I gear' });
  if (streak >= 7) events.push({ text: `${streak}-day streak — power surge!` });
  if (totalSaved >= 150) events.push({ text: 'Unlocked Tier II gear' });
  if (cleanDays >= 30) events.push({ text: 'Reached level 7' });
  if (totalSaved >= 500) events.push({ text: 'Unlocked Tier III gear' });
  if (cleanDays >= 50) events.push({ text: 'Reached level 11' });
  if (totalSaved >= 1500) events.push({ text: 'Unlocked legendary gear' });
  if (cleanDays >= 100) events.push({ text: 'Century clean days — legendary status!' });
  return events.slice(-8);
}

module.exports = router;
