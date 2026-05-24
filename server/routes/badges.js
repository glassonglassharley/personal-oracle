const express = require('express');
const router = express.Router();
const pool = require('../db');

// A "combined clean day" = all entries logged that day have quantity = 0.
// Gaps (days with no entries) do not break a clean streak — same policy as wrapped.js.
// Consistency King requires an entry on every calendar day (gaps break it).

router.get('/', async (req, res, next) => {
  try {
    const userRow = await pool.query(
      'SELECT id FROM users WHERE clerk_user_id = $1', [req.auth.userId]
    );
    const userId = userRow.rows[0]?.id;
    if (!userId) return res.json(emptyResult());

    const entries = await pool.query(`
      SELECT e.date, e.quantity::float, e.price_per_unit::float
      FROM entries e
      JOIN vices v ON v.id = e.vice_id
      WHERE v.user_id = $1
      ORDER BY e.date ASC
    `, [userId]);

    const rows = entries.rows;
    if (rows.length === 0) return res.json(emptyResult());

    // ── Build by-date map ───────────────────────────────────────────────────
    const byDate = {};
    rows.forEach(r => {
      const d = dateStr(r.date);
      if (!byDate[d]) byDate[d] = { spend: 0, allClean: true };
      byDate[d].spend += r.quantity * r.price_per_unit;
      if (r.quantity > 0) byDate[d].allClean = false;
    });

    const sortedDates = Object.keys(byDate).sort();
    const firstDate = sortedDates[0];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // All calendar days from first entry through today
    const allDates = [];
    for (let d = new Date(firstDate + 'T00:00:00'); d <= today; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }

    // ── Streak walk (gaps don't break clean streak) ─────────────────────────
    let cleanStreak = 0;
    let longestStreak = 0;
    let first7 = null, first30 = null, first100 = null;

    for (const d of allDates) {
      const info = byDate[d];
      if (!info) continue;             // no entry → gap, skip
      if (info.allClean) {
        cleanStreak++;
        if (cleanStreak > longestStreak) longestStreak = cleanStreak;
        if (cleanStreak >= 7   && !first7)   first7   = d;
        if (cleanStreak >= 30  && !first30)  first30  = d;
        if (cleanStreak >= 100 && !first100) first100 = d;
      } else {
        cleanStreak = 0;              // spent something → break streak
      }
    }
    const currentStreak = cleanStreak;

    // ── Consistency King (any entry every calendar day for 30 days) ─────────
    let consStreak = 0;
    let consistencyDate = null;
    for (const d of allDates) {
      if (byDate[d]) {
        consStreak++;
        if (consStreak >= 30 && !consistencyDate) consistencyDate = d;
      } else {
        consStreak = 0;
      }
    }

    // ── Savings ─────────────────────────────────────────────────────────────
    const spendDays = Object.values(byDate).filter(d => !d.allClean);
    const avgDailySpend = spendDays.length > 0
      ? spendDays.reduce((s, d) => s + d.spend, 0) / spendDays.length
      : 0;

    const totalCleanDays = Object.values(byDate).filter(d => d.allClean).length;
    const totalSavings = totalCleanDays * avgDailySpend;

    // Date when savings first crossed each threshold (using final avgDailySpend)
    let cleanCount = 0;
    let s100 = null, s500 = null, s1000 = null;
    for (const d of sortedDates) {
      if (byDate[d].allClean) {
        cleanCount++;
        const sv = cleanCount * avgDailySpend;
        if (sv >= 100  && !s100)  s100  = d;
        if (sv >= 500  && !s500)  s500  = d;
        if (sv >= 1000 && !s1000) s1000 = d;
      }
    }

    // ── First clean day ─────────────────────────────────────────────────────
    const firstCleanDate = sortedDates.find(d => byDate[d].allClean) || null;

    // ── 1 Year of Logging ───────────────────────────────────────────────────
    const daysLogging = Math.floor(
      (today - new Date(firstDate + 'T00:00:00')) / 86400000
    );
    const yearEarned = daysLogging >= 365;
    const yearDate = yearEarned
      ? new Date(new Date(firstDate + 'T00:00:00').getTime() + 365 * 86400000)
          .toISOString().split('T')[0]
      : null;

    // ── Assemble badges ─────────────────────────────────────────────────────
    const badges = [
      {
        id: 'first_clean_day',
        name: 'First Clean Day',
        description: 'Log your first clean day on any vice',
        emoji: '✨',
        earned: !!firstCleanDate,
        earned_at: firstCleanDate,
      },
      {
        id: 'streak_7',
        name: '7 Day Streak',
        description: '7 consecutive clean days',
        emoji: '🔥',
        earned: !!first7,
        earned_at: first7,
      },
      {
        id: 'streak_30',
        name: '30 Day Streak',
        description: '30 consecutive clean days',
        emoji: '⚡',
        earned: !!first30,
        earned_at: first30,
      },
      {
        id: 'streak_100',
        name: '100 Day Streak',
        description: '100 consecutive clean days',
        emoji: '💎',
        earned: !!first100,
        earned_at: first100,
      },
      {
        id: 'saved_100',
        name: '$100 Saved',
        description: 'Save $100 from clean days',
        emoji: '💰',
        earned: totalSavings >= 100,
        earned_at: s100,
      },
      {
        id: 'saved_500',
        name: '$500 Saved',
        description: 'Save $500 from clean days',
        emoji: '💵',
        earned: totalSavings >= 500,
        earned_at: s500,
      },
      {
        id: 'saved_1000',
        name: '$1,000 Saved',
        description: 'Save $1,000 from clean days',
        emoji: '🏆',
        earned: totalSavings >= 1000,
        earned_at: s1000,
      },
      {
        id: 'year_logging',
        name: '1 Year of Logging',
        description: 'Tracked your spending for a full year',
        emoji: '📅',
        earned: yearEarned,
        earned_at: yearDate,
      },
      {
        id: 'consistency_king',
        name: 'Consistency King',
        description: 'Logged every single day for 30 days',
        emoji: '👑',
        earned: !!consistencyDate,
        earned_at: consistencyDate,
      },
    ];

    res.json({
      current_streak: currentStreak,
      longest_streak: longestStreak,
      total_clean_days: totalCleanDays,
      total_savings: Math.round(totalSavings * 100) / 100,
      badges,
    });
  } catch (err) { next(err); }
});

function emptyResult() {
  return {
    current_streak: 0,
    longest_streak: 0,
    total_clean_days: 0,
    total_savings: 0,
    badges: [
      { id: 'first_clean_day', name: 'First Clean Day',   emoji: '✨', description: 'Log your first clean day on any vice',        earned: false, earned_at: null },
      { id: 'streak_7',        name: '7 Day Streak',       emoji: '🔥', description: '7 consecutive clean days',                    earned: false, earned_at: null },
      { id: 'streak_30',       name: '30 Day Streak',      emoji: '⚡', description: '30 consecutive clean days',                   earned: false, earned_at: null },
      { id: 'streak_100',      name: '100 Day Streak',     emoji: '💎', description: '100 consecutive clean days',                  earned: false, earned_at: null },
      { id: 'saved_100',       name: '$100 Saved',         emoji: '💰', description: 'Save $100 from clean days',                   earned: false, earned_at: null },
      { id: 'saved_500',       name: '$500 Saved',         emoji: '💵', description: 'Save $500 from clean days',                   earned: false, earned_at: null },
      { id: 'saved_1000',      name: '$1,000 Saved',       emoji: '🏆', description: 'Save $1,000 from clean days',                 earned: false, earned_at: null },
      { id: 'year_logging',    name: '1 Year of Logging',  emoji: '📅', description: 'Tracked your spending for a full year',       earned: false, earned_at: null },
      { id: 'consistency_king',name: 'Consistency King',   emoji: '👑', description: 'Logged every single day for 30 days',         earned: false, earned_at: null },
    ],
  };
}

function dateStr(raw) {
  if (!raw) return '';
  const s = raw.toISOString ? raw.toISOString() : String(raw);
  return s.split('T')[0];
}

module.exports = router;
