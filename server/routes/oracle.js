const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function subtractDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  const pad = (n) => String(n).padStart(2, '0');
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`;
}

function dayDiff(a, b) {
  return (new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000;
}

// Combined-across-vices version of stats.js's per-vice streak logic: a day
// is clean only if no vice has a positive entry that date.
function computeCurrentStreak(dateMap, todayStr) {
  let streak = 0;
  let current = todayStr;
  let skippedToday = false;
  for (let i = 0; i < 365; i++) {
    if (current in dateMap) {
      if (dateMap[current]) streak++;
      else break;
    } else if (streak === 0 && !skippedToday) {
      skippedToday = true;
    } else {
      break;
    }
    current = subtractDay(current);
  }
  return streak;
}

function computeBestStreak(dateMap) {
  const dates = Object.keys(dateMap).sort();
  let best = 0, current = 0;
  for (let i = 0; i < dates.length; i++) {
    if (dateMap[dates[i]]) {
      const consecutive = i === 0 || dayDiff(dates[i], dates[i - 1]) === 1;
      current = consecutive ? current + 1 : 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

const EMPTY_SUMMARY = {
  todaySpend: 0, weekSpend: 0, monthSpend: 0, yearSpend: 0,
  cleanStreak: 0, bestStreak: 0, savingsBalance: 0, avgDailySpend: 0,
  perVice: [], last7Days: [],
};

// GET /api/oracle/summary — combined, read-only aggregate across all of the
// current user's vices, for personal-oracle-draft's cross-app dashboard.
// Auth (Clerk session -> req.auth.userId) and CORS scoping for this path
// both live upstream in server/app.js; this route trusts req.auth only.
router.get('/summary', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ ...EMPTY_SUMMARY, generatedAt: new Date().toISOString() });

    const [todayRow, periodsRow, perViceRows, last7Rows, streakRows, savingsRow] = await Promise.all([
      pool.query('SELECT CURRENT_DATE::text AS today'),
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN e.date = CURRENT_DATE THEN e.quantity * e.price_per_unit END), 0)::float AS today_spend,
           COALESCE(SUM(CASE WHEN e.date >= CURRENT_DATE - INTERVAL '6 days' THEN e.quantity * e.price_per_unit END), 0)::float AS week_spend,
           COALESCE(SUM(CASE WHEN e.date >= DATE_TRUNC('month', CURRENT_DATE) THEN e.quantity * e.price_per_unit END), 0)::float AS month_spend,
           COALESCE(SUM(CASE WHEN e.date >= DATE_TRUNC('year', CURRENT_DATE) THEN e.quantity * e.price_per_unit END), 0)::float AS year_spend
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT v.name AS name,
                COALESCE(SUM(e.quantity * e.price_per_unit), 0)::float AS total_spend,
                COUNT(*) FILTER (WHERE e.quantity > 0)::int AS logged_days,
                COUNT(*) FILTER (WHERE e.quantity = 0)::int AS clean_days
         FROM vices v LEFT JOIN entries e ON e.vice_id = v.id
         WHERE v.user_id = $1
         GROUP BY v.id, v.name
         ORDER BY total_spend DESC`,
        [userId]
      ),
      pool.query(
        `SELECT e.date::text AS date, COALESCE(SUM(e.quantity * e.price_per_unit), 0)::float AS amount
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1 AND e.date >= CURRENT_DATE - INTERVAL '6 days' AND e.date <= CURRENT_DATE
         GROUP BY e.date`,
        [userId]
      ),
      pool.query(
        `SELECT e.date::text AS date, BOOL_OR(e.quantity > 0) AS has_positive
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1
         GROUP BY e.date`,
        [userId]
      ),
      pool.query('SELECT savings_balance FROM users WHERE id = $1', [userId]),
    ]);

    const today = todayRow.rows[0].today;
    const periods = periodsRow.rows[0];

    const grandTotal = perViceRows.rows.reduce((sum, r) => sum + r.total_spend, 0);
    const perVice = perViceRows.rows.map((r) => ({
      name: r.name,
      total: round2(r.total_spend),
      pct: grandTotal > 0 ? round2((r.total_spend / grandTotal) * 100) : 0,
    }));

    // Combined avg daily spend, weighted by each vice's estimated days —
    // mirrors personal-oracle-draft's own buildDashboardMetrics combined calc.
    let weightedSpend = 0;
    let totalDays = 0;
    perViceRows.rows.forEach((r) => {
      const days = r.logged_days + r.clean_days;
      const avgDaily = r.logged_days > 0 ? r.total_spend / r.logged_days : 0;
      weightedSpend += avgDaily * days;
      totalDays += days;
    });
    const avgDailySpend = totalDays > 0 ? round2(weightedSpend / totalDays) : 0;

    const last7ByDate = new Map(last7Rows.rows.map((r) => [r.date, r.amount]));
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      let cursor = today;
      for (let j = 0; j < i; j++) cursor = subtractDay(cursor);
      last7Days.push({ date: cursor, amount: round2(last7ByDate.get(cursor) || 0) });
    }

    const dateMap = {};
    streakRows.rows.forEach((r) => { dateMap[r.date] = !r.has_positive; });

    res.json({
      todaySpend: round2(periods.today_spend),
      weekSpend: round2(periods.week_spend),
      monthSpend: round2(periods.month_spend),
      yearSpend: round2(periods.year_spend),
      cleanStreak: computeCurrentStreak(dateMap, today),
      bestStreak: computeBestStreak(dateMap),
      savingsBalance: round2(savingsRow.rows[0]?.savings_balance || 0),
      avgDailySpend,
      perVice,
      last7Days,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

module.exports = router;
