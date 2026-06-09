const express = require('express');
const router = express.Router();
const pool = require('../db');
const { awardXP, sendPushToUser, getInternalUserId } = require('../utils');

// Bonus XP for streak milestone badges on top of the base badge XP
const STREAK_MILESTONE_XP = { streak_3: 50, streak_7: 100, streak_30: 250, streak_100: 500 };
const BASE_BADGE_XP = 75;

const BADGE_DEFS = [
  { id: 'first_log',       emoji: '✨', name: 'First Log',        description: 'Logged your first entry ever' },
  { id: 'streak_3',        emoji: '🔥', name: '3-Day Streak',     description: '3 consecutive clean days' },
  { id: 'streak_7',        emoji: '⚡', name: '7-Day Streak',     description: '7 consecutive clean days' },
  { id: 'streak_30',       emoji: '🌱', name: '30-Day Streak',    description: '30 consecutive clean days' },
  { id: 'streak_100',      emoji: '👑', name: '100-Day Streak',   description: '100 consecutive clean days' },
  { id: 'saved_100',       emoji: '💰', name: '$100 Saved',       description: 'Moved $100 into your savings account' },
  { id: 'saved_500',       emoji: '💵', name: '$500 Saved',       description: 'Moved $500 into your savings account' },
  { id: 'saved_1000',      emoji: '🏆', name: '$1,000 Saved',     description: 'Moved $1,000 into your savings account' },
  { id: 'logged_30_days',  emoji: '📅', name: '30 Days Logged',   description: 'Logged entries on 30 distinct days' },
  { id: 'plaid_connected', emoji: '🏦', name: 'Bank Connected',   description: 'Connected a bank account via Plaid' },
];

// ── Shared stats computation ────────────────────────────────────────────────
async function computeUserStats(userId) {
  const [entryRows, plaidRow, userRow] = await Promise.all([
    pool.query(`
      SELECT e.date, e.quantity::float, e.price_per_unit::float
      FROM entries e JOIN vices v ON v.id = e.vice_id
      WHERE v.user_id = $1
      ORDER BY e.date ASC
    `, [userId]),
    pool.query('SELECT 1 FROM plaid_connections WHERE user_id = $1 LIMIT 1', [userId]),
    pool.query('SELECT savings_balance FROM users WHERE id = $1', [userId]),
  ]);

  const rows = entryRows.rows;

  // By-date map: date → { allClean, spend }
  const byDate = {};
  rows.forEach(r => {
    const d = dateStr(r.date);
    if (!byDate[d]) byDate[d] = { allClean: true, spend: 0 };
    byDate[d].spend += r.quantity * r.price_per_unit;
    if (r.quantity > 0) byDate[d].allClean = false;
  });

  const sortedDates = Object.keys(byDate).sort();
  const totalLoggedDays = sortedDates.length;
  const totalCleanDays  = sortedDates.filter(d => byDate[d].allClean).length;

  // Avg daily spend (vice days only)
  const spendDays = Object.values(byDate).filter(d => !d.allClean);
  const avgDailySpend = spendDays.length > 0
    ? spendDays.reduce((s, d) => s + d.spend, 0) / spendDays.length
    : 0;
  const totalSavings = totalCleanDays * avgDailySpend;

  // Streak walk (gaps skip, vice day resets)
  let cleanStreak = 0, longestStreak = 0, currentStreak = 0;
  const firstDate = sortedDates[0];
  if (firstDate) {
    const today = new Date();
    const allDates = [];
    for (let d = new Date(firstDate + 'T00:00:00'); d <= today; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
    for (const d of allDates) {
      const info = byDate[d];
      if (!info) continue;
      if (info.allClean) {
        cleanStreak++;
        if (cleanStreak > longestStreak) longestStreak = cleanStreak;
      } else {
        cleanStreak = 0;
      }
    }
    currentStreak = cleanStreak;
  }

  const actualSavings = Number(userRow.rows[0]?.savings_balance || 0);

  return {
    totalLoggedDays,
    totalCleanDays,
    totalSavings: Math.round(totalSavings * 100) / 100,
    actualSavings: Math.round(actualSavings * 100) / 100,
    currentStreak,
    longestStreak,
    hasAnyEntry: rows.length > 0,
    plaidConnected: plaidRow.rowCount > 0,
  };
}

function earnedBadgeIds(stats) {
  const ids = new Set();
  if (stats.hasAnyEntry)          ids.add('first_log');
  if (stats.currentStreak >= 3)   ids.add('streak_3');
  if (stats.currentStreak >= 7)   ids.add('streak_7');
  if (stats.currentStreak >= 30)  ids.add('streak_30');
  if (stats.currentStreak >= 100) ids.add('streak_100');
  if (stats.actualSavings >= 100)  ids.add('saved_100');
  if (stats.actualSavings >= 500)  ids.add('saved_500');
  if (stats.actualSavings >= 1000) ids.add('saved_1000');
  if (stats.totalLoggedDays >= 30) ids.add('logged_30_days');
  if (stats.plaidConnected)       ids.add('plaid_connected');
  return ids;
}

function badgeProgress(badgeId, stats) {
  switch (badgeId) {
    case 'streak_3':        return { value: stats.currentStreak, max: 3 };
    case 'streak_7':        return { value: stats.currentStreak, max: 7 };
    case 'streak_30':       return { value: stats.currentStreak, max: 30 };
    case 'streak_100':      return { value: stats.currentStreak, max: 100 };
    case 'saved_100':       return { value: stats.actualSavings, max: 100 };
    case 'saved_500':       return { value: stats.actualSavings, max: 500 };
    case 'saved_1000':      return { value: stats.actualSavings, max: 1000 };
    case 'logged_30_days':  return { value: stats.totalLoggedDays, max: 30 };
    default:                return null;
  }
}

// ── POST /api/badges/check ──────────────────────────────────────────────────
// Evaluate all conditions, persist newly earned badges, return newly_earned[].
router.post('/check', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ newly_earned: [] });

    const stats = await computeUserStats(userId);
    const shouldEarn = earnedBadgeIds(stats);

    // Already-earned badge IDs in the DB
    const existing = await pool.query('SELECT badge_id FROM badges WHERE user_id = $1', [userId]);
    const alreadyEarned = new Set(existing.rows.map(r => r.badge_id));

    const toInsert = [...shouldEarn].filter(id => !alreadyEarned.has(id));
    if (toInsert.length === 0) return res.json({ newly_earned: [] });

    await Promise.all(toInsert.map(badge_id =>
      pool.query(
        'INSERT INTO badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, badge_id]
      )
    ));

    const newly_earned = BADGE_DEFS.filter(d => toInsert.includes(d.id));
    res.json({ newly_earned });

    // Fire-and-forget: award XP + send push for new badges
    if (toInsert.length > 0) {
      const xpAmount = toInsert.reduce((sum, id) => sum + BASE_BADGE_XP + (STREAK_MILESTONE_XP[id] || 0), 0);
      awardXP(userId, xpAmount).then(async xpResult => {
        const prefsRow = await pool.query(
          'SELECT notif_badge_earned, notif_level_up, notif_streak_milestone FROM users WHERE id = $1', [userId]
        );
        const prefs = prefsRow.rows[0] || {};

        // Badge earned notifications (all badge types)
        if (prefs.notif_badge_earned !== false) {
          for (const badge of newly_earned) {
            sendPushToUser(userId, { title: '🏅 Badge unlocked!', body: badge.name, url: '/badges' }).catch(() => {});
          }
        }

        // Streak milestone notifications — separate preference, separate message
        if (prefs.notif_streak_milestone !== false) {
          const STREAK_DAYS = { streak_3: 3, streak_7: 7, streak_30: 30, streak_100: 100 };
          for (const badge of newly_earned) {
            const days = STREAK_DAYS[badge.id];
            if (days) {
              sendPushToUser(userId, {
                title: `🔥 ${days}-day streak!`,
                body: `You're on fire — ${days} consecutive clean days`,
                url: '/badges',
              }).catch(() => {});
            }
          }
        }

        if (xpResult?.leveled_up && prefs.notif_level_up !== false) {
          sendPushToUser(userId, {
            title: '⭐ Level up!',
            body: `You're now a ${xpResult.level_name} ${xpResult.level_icon}`,
            url: '/badges',
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  } catch (err) { next(err); }
});

// ── GET /api/badges ─────────────────────────────────────────────────────────
// Returns earned badges from DB merged with full definition list.
router.get('/', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json(emptyResult());

    const [earned, stats] = await Promise.all([
      pool.query('SELECT badge_id, earned_at FROM badges WHERE user_id = $1 ORDER BY earned_at ASC', [userId]),
      computeUserStats(userId),
    ]);

    const earnedMap = {};
    earned.rows.forEach(r => { earnedMap[r.badge_id] = r.earned_at; });

    const badges = BADGE_DEFS.map(def => {
      const isEarned = def.id in earnedMap;
      return {
        ...def,
        earned: isEarned,
        earned_at: isEarned ? dateStr(earnedMap[def.id]) : null,
        progress: isEarned ? null : badgeProgress(def.id, stats),
      };
    });

    res.json({
      current_streak:   stats.currentStreak,
      longest_streak:   stats.longestStreak,
      total_clean_days: stats.totalCleanDays,
      total_savings:    stats.totalSavings,
      actual_savings:   stats.actualSavings,
      badges,
    });
  } catch (err) { next(err); }
});

function emptyResult() {
  return {
    current_streak: 0, longest_streak: 0, total_clean_days: 0, total_savings: 0,
    badges: BADGE_DEFS.map(d => ({ ...d, earned: false, earned_at: null, progress: null })),
  };
}

function dateStr(raw) {
  if (!raw) return null;
  const s = raw.toISOString ? raw.toISOString() : String(raw);
  return s.split('T')[0];
}

module.exports = router;
