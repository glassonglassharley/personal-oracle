const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

async function getMyId(clerkUserId) {
  const id = await getInternalUserId(clerkUserId);
  if (!id) throw Object.assign(new Error('User not found'), { status: 404 });
  return id;
}

// GET /api/companion — returns companion state + live growth data
router.get('/', async (req, res, next) => {
  try {
    const userId = await getMyId(req.auth.userId);

    const { rows } = await pool.query(
      'SELECT companion_type, companion_state, created_at, savings_balance FROM users WHERE id = $1',
      [userId]
    );
    const user = rows[0];
    if (!user.companion_type) return res.json({ companion_type: null });

    // Actual savings balance (user-entered on Savings page)
    const totalSaved = Number(user.savings_balance || 0);

    // Clean days = dates where ALL vices were explicitly logged with quantity = 0
    const cleanQ = await pool.query(`
      SELECT COUNT(*) AS clean_days
      FROM (
        SELECT e.date::date
        FROM entries e
        JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1
        GROUP BY e.date::date
        HAVING
          MAX(e.quantity) = 0
          AND COUNT(DISTINCT e.vice_id) = (SELECT COUNT(*) FROM vices WHERE user_id = $1)
      ) clean_dates
    `, [userId]);
    const cleanDays = Number(cleanQ.rows[0]?.clean_days || 0);

    // First entry date (for daysTracked)
    const savQ = await pool.query(`
      SELECT MIN(e.date) AS first_entry
      FROM entries e
      JOIN vices v ON v.id = e.vice_id
      WHERE v.user_id = $1
    `, [userId]);
    const firstEntry = savQ.rows[0]?.first_entry;

    // Days tracked since first entry
    let daysTracked = 0;
    if (firstEntry) {
      const diff = Date.now() - new Date(firstEntry).getTime();
      daysTracked = Math.floor(diff / 86400000) + 1;
    }

    // Current streak = consecutive clean days (ALL vices logged at 0) ending today
    const streakQ = await pool.query(`
      SELECT e.date::date AS d
      FROM entries e
      JOIN vices v ON v.id = e.vice_id
      WHERE v.user_id = $1
      GROUP BY e.date::date
      HAVING
        MAX(e.quantity) = 0
        AND COUNT(DISTINCT e.vice_id) = (SELECT COUNT(*) FROM vices WHERE user_id = $1)
      ORDER BY d DESC
    `, [userId]);

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cleanSet = new Set(streakQ.rows.map(r => new Date(r.d).toISOString().split('T')[0]));
    const cur = new Date(today);
    while (cleanSet.has(cur.toISOString().split('T')[0])) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }

    const treeGrowthState =
      totalSaved < 50 ? 1 :
      totalSaved < 150 ? 2 :
      totalSaved < 500 ? 3 :
      totalSaved < 1500 ? 4 : 5;

    const charLevel = Math.min(50, Math.floor(cleanDays / 5) + 1);
    const charXp = (cleanDays % 5) / 5;
    const currentMonth = new Date().getMonth() + 1;

    // Milestone history for timeline
    const milestones = buildMilestones(totalSaved, cleanDays, streak, daysTracked, user.companion_type);

    res.json({
      companion_type: user.companion_type,
      companion_state: user.companion_state,
      growth: {
        treeGrowthState,
        charLevel,
        charXp,
        totalSaved,
        cleanDays,
        streak,
        daysTracked,
        isDecember: currentMonth === 12,
        hasFlowers: streak >= 7,
        milestones,
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

    await pool.query(
      'UPDATE users SET companion_type = $1, companion_state = $2 WHERE id = $3',
      [companion_type, JSON.stringify(companion_state || {}), userId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function buildMilestones(totalSaved, cleanDays, streak, daysTracked, type) {
  const isTree = type === 'tree';
  const events = [];

  if (daysTracked >= 1) events.push({ day: 1, text: 'Started your journey' });
  if (daysTracked >= 7) events.push({ day: 7, text: 'One week of tracking' });
  if (daysTracked >= 30) events.push({ day: 30, text: 'One full month tracked' });
  if (cleanDays >= 1) events.push({ day: cleanDays, text: isTree ? 'First clean day — a seed planted' : 'First clean day logged' });
  if (cleanDays >= 7) events.push({ day: cleanDays, text: isTree ? 'A 7-day streak — first leaves appeared' : 'Reached level 2' });
  if (totalSaved >= 50) events.push({ day: daysTracked, text: isTree ? '$50 saved — first branch grew' : 'Unlocked Tier I gear' });
  if (streak >= 7) events.push({ day: daysTracked, text: isTree ? `${streak}-day streak — flowers are blooming` : `${streak}-day streak — power surge!` });
  if (totalSaved >= 150) events.push({ day: daysTracked, text: isTree ? '$150 saved — grew tall and strong' : 'Unlocked Tier II gear' });
  if (cleanDays >= 30) events.push({ day: cleanDays, text: isTree ? '30 clean days — canopy spreading wide' : 'Reached level 7' });
  if (totalSaved >= 500) events.push({ day: daysTracked, text: isTree ? '$500 saved — a mature tree' : 'Unlocked Tier III gear' });
  if (cleanDays >= 50) events.push({ day: cleanDays, text: isTree ? '50 clean days — bearing fruit' : 'Reached level 11' });
  if (totalSaved >= 1500) events.push({ day: daysTracked, text: isTree ? '$1500 saved — fully majestic' : 'Unlocked legendary gear' });
  if (cleanDays >= 100) events.push({ day: cleanDays, text: isTree ? '100 clean days — ancient and wise' : 'Century clean days — legendary status!' });

  return events.slice(-8);
}

module.exports = router;
