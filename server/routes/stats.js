const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyViceOwnership } = require('../utils');

router.get('/:vice_id', async (req, res, next) => {
  try {
    const { vice_id } = req.params;
    if (!await verifyViceOwnership(vice_id, req.auth.userId))
      return res.status(403).json({ error: 'Forbidden' });

    const { today, weekAgo, monthStart, yearStart } = dateWindows(parseTz(req.query.tz));

    const period = async (from, to) => {
      const r = await pool.query(
        `SELECT COALESCE(SUM(quantity),0)::float AS qty,
                COALESCE(SUM(quantity * price_per_unit),0)::float AS spend
         FROM entries WHERE vice_id = $1 AND date >= $2 AND date <= $3`,
        [vice_id, from, to]
      );
      return { quantity: r.rows[0].qty, spend: r.rows[0].spend };
    };

    const [todayS, weekS, monthS, yearS] = await Promise.all([
      period(today, today),
      period(weekAgo, today),
      period(monthStart, today),
      period(yearStart, today),
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
      current_streak: computeCurrentStreak(dateMap, today),
      best_streak:    computeBestStreak(dateMap),
    });
  } catch (err) { next(err); }
});

function round2(n) { return Math.round(n * 100) / 100; }

// Validate and normalise a timezone string; fall back to UTC on invalid input.
function parseTz(tz) {
  if (!tz) return 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

// Return today's date string (YYYY-MM-DD) in the given IANA timezone.
function localDateStr(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

// Return the four date-window boundaries (all YYYY-MM-DD) in the user's timezone.
function dateWindows(tz) {
  const today = localDateStr(tz);
  const [y, m, d] = today.split('-').map(Number);
  const pad = n => String(n).padStart(2, '0');

  const weekAgoDate = new Date(Date.UTC(y, m - 1, d - 6));
  const weekAgo    = `${weekAgoDate.getUTCFullYear()}-${pad(weekAgoDate.getUTCMonth() + 1)}-${pad(weekAgoDate.getUTCDate())}`;
  const monthStart = `${y}-${pad(m)}-01`;
  const yearStart  = `${y}-01-01`;

  return { today, weekAgo, monthStart, yearStart };
}

// Subtract N days from a YYYY-MM-DD string, returning a new YYYY-MM-DD string.
function subtractDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  const pad = n => String(n).padStart(2, '0');
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`;
}

// Count consecutive clean days ending at (or before) today in the user's timezone.
// Skips today if no entry logged yet; any gap or vice day breaks the streak.
function computeCurrentStreak(dateMap, todayStr) {
  let streak = 0;
  let current = todayStr;
  let skippedToday = false;

  for (let i = 0; i < 365; i++) {
    if (current in dateMap) {
      if (dateMap[current]) {
        streak++;
      } else {
        break; // vice day — streak ends
      }
    } else {
      if (streak === 0 && !skippedToday) {
        skippedToday = true; // today not logged yet — look one more day back
      } else {
        break; // gap in logging — streak ends
      }
    }
    current = subtractDay(current);
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
