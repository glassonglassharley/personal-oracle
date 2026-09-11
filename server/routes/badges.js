const express = require('express');
const router = express.Router();
const pool = require('../db');
const { awardXP, sendPushToUser, getInternalUserId } = require('../utils');

// Streak badges are keyed to the best-ever streak, so a broken streak never
// takes an earned badge away.
const STREAK_BADGE_DAYS = {
  streak_3: 3,
  streak_7: 7,
  streak_14: 14,
  streak_30: 30,
  streak_100: 100,
  streak_365: 365,
};
// Bonus XP for streak milestone badges on top of the base badge XP
const STREAK_MILESTONE_XP = { streak_3: 50, streak_7: 100, streak_14: 150, streak_30: 250, streak_100: 500, streak_365: 1000 };
const BASE_BADGE_XP = 75;

const SAVINGS_BADGE_THRESHOLDS = {
  saved_100: 100,
  saved_500: 500,
  saved_1000: 1000,
  saved_2500: 2500,
  saved_5000: 5000,
  saved_10000: 10000,
};
const SAVINGS_BADGE_IDS = Object.keys(SAVINGS_BADGE_THRESHOLDS);

const LOGGED_DAYS_THRESHOLDS = {
  logged_30_days: 30,
  logged_100_days: 100,
  logged_365_days: 365,
};

const BADGE_DEFS = [
  { id: 'first_log',       emoji: '✨', name: 'First Log',        description: 'Logged your first entry ever' },
  { id: 'streak_3',        emoji: '🔥', name: '3-Day Streak',     description: '3 consecutive clean days' },
  { id: 'streak_7',        emoji: '⚡', name: '7-Day Streak',     description: '7 consecutive clean days' },
  { id: 'streak_14',       emoji: '🌙', name: '14-Day Streak',    description: '14 consecutive clean days' },
  { id: 'streak_30',       emoji: '🌱', name: '30-Day Streak',    description: '30 consecutive clean days' },
  { id: 'streak_100',      emoji: '👑', name: '100-Day Streak',   description: '100 consecutive clean days' },
  { id: 'streak_365',      emoji: '🎖️', name: 'One Year Clean',   description: '365 consecutive clean days' },
  { id: 'saved_100',       emoji: '💰', name: '$100 Saved',       description: 'Record $100 in your connected or manually-entered savings balance' },
  { id: 'saved_500',       emoji: '💵', name: '$500 Saved',       description: 'Record $500 in your connected or manually-entered savings balance' },
  { id: 'saved_1000',      emoji: '🏆', name: '$1,000 Saved',     description: 'Record $1,000 in your connected or manually-entered savings balance' },
  { id: 'saved_2500',      emoji: '💎', name: '$2,500 Saved',     description: 'Record $2,500 in your connected or manually-entered savings balance' },
  { id: 'saved_5000',      emoji: '🚀', name: '$5,000 Saved',     description: 'Record $5,000 in your connected or manually-entered savings balance' },
  { id: 'saved_10000',     emoji: '🏰', name: '$10,000 Saved',    description: 'Record $10,000 in your connected or manually-entered savings balance' },
  { id: 'logged_30_days',  emoji: '📅', name: '30 Days Logged',   description: 'Logged entries on 30 distinct days' },
  { id: 'logged_100_days', emoji: '📖', name: '100 Days Logged',  description: 'Logged entries on 100 distinct days' },
  { id: 'logged_365_days', emoji: '📚', name: '365 Days Logged',  description: 'Logged entries on 365 distinct days' },
  { id: 'plaid_connected', emoji: '🏦', name: 'Bank Connected',      description: 'Connected a bank account via Plaid' },
  { id: 'partner_1',      emoji: '🤝', name: 'First Friend',        description: 'Connected 1 accountability partner' },
  { id: 'partner_5',      emoji: '👥', name: 'Squad Goals',          description: 'Connected 5 accountability partners' },
  { id: 'partner_10',     emoji: '🌐', name: 'Community Builder',    description: 'Connected 10 accountability partners' },
];

// ── Shared stats computation ────────────────────────────────────────────────
async function computeUserStats(userId) {
  const [entryRows, plaidRow, userRow, partnerRow] = await Promise.all([
    pool.query(`
      SELECT e.date, e.quantity::float, e.price_per_unit::float
      FROM entries e JOIN vices v ON v.id = e.vice_id
      WHERE v.user_id = $1
      ORDER BY e.date ASC
    `, [userId]),
    pool.query('SELECT 1 FROM plaid_connections WHERE user_id = $1 LIMIT 1', [userId]),
    pool.query('SELECT savings_balance FROM users WHERE id = $1', [userId]),
    pool.query(`
      SELECT COUNT(*)::int AS cnt FROM friendships
      WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'
    `, [userId]).catch(() => ({ rows: [{ cnt: 0 }] })),
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
  const partnerCount  = partnerRow.rows[0]?.cnt ?? 0;

  return {
    totalLoggedDays,
    totalCleanDays,
    totalSavings: Math.round(totalSavings * 100) / 100,
    actualSavings: Math.round(actualSavings * 100) / 100,
    currentStreak,
    longestStreak,
    hasAnyEntry: rows.length > 0,
    plaidConnected: plaidRow.rowCount > 0,
    partnerCount,
  };
}

function earnedBadgeIds(stats) {
  const ids = new Set();
  if (stats.hasAnyEntry)          ids.add('first_log');
  for (const [id, days] of Object.entries(STREAK_BADGE_DAYS)) {
    if (stats.longestStreak >= days) ids.add(id);
  }
  for (const [id, amount] of Object.entries(SAVINGS_BADGE_THRESHOLDS)) {
    if (stats.actualSavings >= amount) ids.add(id);
  }
  for (const [id, days] of Object.entries(LOGGED_DAYS_THRESHOLDS)) {
    if (stats.totalLoggedDays >= days) ids.add(id);
  }
  if (stats.plaidConnected)       ids.add('plaid_connected');
  if (stats.partnerCount >= 1)    ids.add('partner_1');
  if (stats.partnerCount >= 5)    ids.add('partner_5');
  if (stats.partnerCount >= 10)   ids.add('partner_10');
  return ids;
}

function badgeProgress(badgeId, stats) {
  if (badgeId in STREAK_BADGE_DAYS) {
    return { value: stats.longestStreak, max: STREAK_BADGE_DAYS[badgeId], unit: 'days' };
  }
  if (badgeId in SAVINGS_BADGE_THRESHOLDS) {
    return { value: stats.actualSavings, max: SAVINGS_BADGE_THRESHOLDS[badgeId] };
  }
  if (badgeId in LOGGED_DAYS_THRESHOLDS) {
    return { value: stats.totalLoggedDays, max: LOGGED_DAYS_THRESHOLDS[badgeId], unit: 'days' };
  }
  switch (badgeId) {
    case 'partner_1':       return { value: stats.partnerCount, max: 1,  unit: 'friends' };
    case 'partner_5':       return { value: stats.partnerCount, max: 5,  unit: 'friends' };
    case 'partner_10':      return { value: stats.partnerCount, max: 10, unit: 'friends' };
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

    const staleSavingsBadges = [...alreadyEarned]
      .filter(id => SAVINGS_BADGE_IDS.includes(id) && !shouldEarn.has(id));
    if (staleSavingsBadges.length > 0) {
      await pool.query(
        'DELETE FROM badges WHERE user_id = $1 AND badge_id = ANY($2)',
        [userId, staleSavingsBadges]
      );
      staleSavingsBadges.forEach(id => alreadyEarned.delete(id));
    }

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
          for (const badge of newly_earned) {
            const days = STREAK_BADGE_DAYS[badge.id];
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

    const currentlyEarned = earnedBadgeIds(stats);
    const badges = BADGE_DEFS.map(def => {
      const isPersisted = def.id in earnedMap;
      const isStaleSavingsBadge = SAVINGS_BADGE_IDS.includes(def.id) && !currentlyEarned.has(def.id);
      const isEarned = isPersisted && !isStaleSavingsBadge;
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
