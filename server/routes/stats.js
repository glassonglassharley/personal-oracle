const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyViceOwnership } = require('../utils');

router.get('/:vice_id', async (req, res, next) => {
  try {
    const { vice_id } = req.params;
    if (!await verifyViceOwnership(vice_id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const fmt = d => d.toISOString().split('T')[0];

    const period = async (from, to) => {
      const r = await pool.query(
        `SELECT COALESCE(SUM(quantity),0)::float AS qty,
                COALESCE(SUM(quantity * price_per_unit),0)::float AS spend
         FROM entries WHERE vice_id = $1 AND date >= $2 AND date <= $3`,
        [vice_id, from, to]
      );
      return { quantity: r.rows[0].qty, spend: round2(r.rows[0].spend) };
    };

    const [todayS, weekS, monthS, yearS] = await Promise.all([
      period(today, today),
      period(fmt(weekAgo), today),
      period(fmt(monthStart), today),
      period(fmt(yearStart), today),
    ]);

    const all = await pool.query(
      'SELECT date, quantity::float, price_per_unit::float FROM entries WHERE vice_id = $1 ORDER BY date ASC',
      [vice_id]
    );
    const rows = all.rows;
    const totalQty   = rows.reduce((s, r) => s + r.quantity, 0);
    const totalSpend = rows.reduce((s, r) => s + r.quantity * r.price_per_unit, 0);
    const totalDays  = rows.length;
    const cleanDays  = rows.filter(r => r.quantity === 0).length;
    const loggedDays = rows.filter(r => r.quantity > 0).length;

    const avgPPU   = totalQty > 0 ? totalSpend / totalQty : 0;
    // Use only days with actual spending as the denominator so the rate
    // reflects "what you spend on a vice day" rather than being diluted
    // by clean days (which had $0 spend by definition).
    const avgQPD    = loggedDays > 0 ? totalQty / loggedDays : 0;
    const avgDSpend = loggedDays > 0 ? totalSpend / loggedDays : 0;
    // savings = what you would have spent on clean days at your normal rate
    const savings   = cleanDays * avgDSpend;
    const firstEntry = rows[0]?.date || null;
    const lastEntry = rows[rows.length - 1]?.date || null;

    // Build date → isClean map (false if any entry that day has quantity > 0)
    const dateMap = {};
    rows.forEach(r => {
      const d = String(r.date).split('T')[0];
      if (!(d in dateMap)) dateMap[d] = true;
      if (r.quantity > 0) dateMap[d] = false;
    });

    res.json({
      today: todayS, week: weekS, month: monthS, year: yearS,
      all_time: { quantity: round2(totalQty), spend: round2(totalSpend) },
      averages: {
        day: { quantity: round2(avgQPD), spend: round2(avgDSpend) },
        week: { quantity: round2(avgQPD * 7), spend: round2(avgDSpend * 7) },
        month: { quantity: round2(avgQPD * 30.44), spend: round2(avgDSpend * 30.44) },
        year: { quantity: round2(avgQPD * 365), spend: round2(avgDSpend * 365) },
      },
      avg_price_per_unit:   round2(avgPPU),
      avg_quantity_per_day: round2(avgQPD),
      avg_daily_spend:      round2(avgDSpend),
      first_entry_date:     firstEntry,
      last_entry_date:      lastEntry,
      total_logged_days:    loggedDays,
      clean_days:           cleanDays,
      savings_from_clean_days: round2(savings),
      current_streak: computeCurrentStreak(dateMap),
      best_streak:    computeBestStreak(dateMap),
    });
  } catch (err) { next(err); }
});

function round2(n) { return Math.round(n * 100) / 100; }

// Count consecutive clean days ending at (or before) today.
// Skips today if it has no entry yet; any gap or vice day breaks the streak.
function computeCurrentStreak(dateMap) {
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let skippedToday = false;

  for (let i = 0; i < 365; i++) {
    const ds = d.toISOString().split('T')[0];
    if (ds in dateMap) {
      if (dateMap[ds]) {
        streak++;
      } else {
        break; // vice day ends streak
      }
    } else {
      if (streak === 0 && !skippedToday) {
        skippedToday = true; // haven't logged today yet — look back one more day
      } else {
        break; // gap in logging ends streak
      }
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Longest consecutive run of clean days in history.
function computeBestStreak(dateMap) {
  const dates = Object.keys(dateMap).sort();
  let best = 0, current = 0;

  for (let i = 0; i < dates.length; i++) {
    if (dateMap[dates[i]]) {
      const consecutive = i === 0 || (() => {
        const diff = (new Date(dates[i] + 'T00:00:00') - new Date(dates[i - 1] + 'T00:00:00')) / 86400000;
        return diff === 1;
      })();
      current = consecutive ? current + 1 : 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

module.exports = router;
