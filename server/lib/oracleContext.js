const pool = require('../db');
const { round2, computeCurrentStreak, computeBestStreak } = require('../utils');

// Assembles everything the Oracle chat needs to reason across vice spending,
// training, and debt data for one user, date-aligned, in a single round trip.
// Income has no backing table yet — dataSources flags that so the system
// prompt can say "I don't have that yet" instead of inventing numbers.
async function buildOracleContext(userId) {
  const [
    todayRow,
    viceRows,
    trainingRows,
    viceDateRows,
    trainingDateRows,
    correlationRows,
    savingsRow,
    debtRows,
  ] = await Promise.all([
    pool.query('SELECT CURRENT_DATE::text AS today'),

    // Per-vice windowed spend
    pool.query(
      `SELECT v.id AS vice_id, v.name, v.emoji, v.unit_label, v.category,
              COALESCE(SUM(CASE WHEN e.date >= CURRENT_DATE - INTERVAL '6 days'  THEN e.quantity * e.price_per_unit END), 0)::float AS spend_7d,
              COALESCE(SUM(CASE WHEN e.date >= CURRENT_DATE - INTERVAL '29 days' THEN e.quantity * e.price_per_unit END), 0)::float AS spend_30d,
              COALESCE(SUM(CASE WHEN e.date >= CURRENT_DATE - INTERVAL '89 days' THEN e.quantity * e.price_per_unit END), 0)::float AS spend_90d,
              COALESCE(SUM(e.quantity * e.price_per_unit), 0)::float AS spend_all_time,
              COUNT(*) FILTER (WHERE e.quantity > 0)::int AS logged_days_all_time,
              MIN(e.date)::text AS first_entry_date
       FROM vices v LEFT JOIN entries e ON e.vice_id = v.id
       WHERE v.user_id = $1
       GROUP BY v.id, v.name, v.emoji, v.unit_label, v.category
       ORDER BY spend_all_time DESC`,
      [userId]
    ),

    // Per-exercise windowed reps (steps/water stay as their own rows — no unit mixing)
    pool.query(
      `SELECT exercise,
              COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '6 days'  THEN reps END), 0)::int AS reps_7d,
              COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '29 days' THEN reps END), 0)::int AS reps_30d,
              COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '89 days' THEN reps END), 0)::int AS reps_90d,
              COALESCE(SUM(reps), 0)::int AS reps_all_time,
              COUNT(DISTINCT date)::int AS active_days_all_time,
              MIN(date)::text AS first_entry_date
       FROM training_entries
       WHERE user_id = $1
       GROUP BY exercise
       ORDER BY reps_all_time DESC`,
      [userId]
    ),

    // Whole-life clean-day map (mirrors oracle.js's /summary streak query)
    pool.query(
      `SELECT e.date::text AS date, BOOL_OR(e.quantity > 0) AS has_positive
       FROM entries e JOIN vices v ON v.id = e.vice_id
       WHERE v.user_id = $1
       GROUP BY e.date`,
      [userId]
    ),

    // Training-active-day map (any exercise logged that date)
    pool.query(
      `SELECT date::text AS date
       FROM training_entries
       WHERE user_id = $1
       GROUP BY date`,
      [userId]
    ),

    // Next-day correlation: does logging a vice change next-day training volume?
    // Combined across vices for v1 — one bucket for "any vice logged that day",
    // one for "clean day" — not broken out per-vice yet.
    pool.query(
      `WITH vice_days AS (
         SELECT e.date, BOOL_OR(e.quantity > 0) AS vice_positive
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1
         GROUP BY e.date
       ),
       training_days AS (
         SELECT date, SUM(reps)::int AS total_reps
         FROM training_entries
         WHERE user_id = $1
         GROUP BY date
       )
       SELECT vd.vice_positive,
              COUNT(*)::int AS day_count,
              ROUND(AVG(COALESCE(td.total_reps, 0))::numeric, 1)::float AS avg_next_day_reps,
              ROUND(COALESCE(STDDEV_POP(COALESCE(td.total_reps, 0)), 0)::numeric, 1)::float AS stddev_next_day_reps
       FROM vice_days vd
       LEFT JOIN training_days td ON td.date = (vd.date + INTERVAL '1 day')::date
       GROUP BY vd.vice_positive`,
      [userId]
    ),

    pool.query('SELECT savings_balance FROM users WHERE id = $1', [userId]),

    // Current debts, smallest balance first (snowball order — matches the
    // "next target" logic already used in personal-oracle-draft's Debt panel).
    pool.query(
      `SELECT lender, original_balance, balance, apr, min_payment
       FROM debts
       WHERE user_id = $1
       ORDER BY balance ASC`,
      [userId]
    ),
  ]);

  const today = todayRow.rows[0].today;

  const viceDateMap = {};
  viceDateRows.rows.forEach((r) => { viceDateMap[r.date] = !r.has_positive; });

  const trainingDateMap = {};
  trainingDateRows.rows.forEach((r) => { trainingDateMap[r.date] = true; });

  const vices = viceRows.rows.map((r) => ({
    name: r.name,
    emoji: r.emoji,
    category: r.category,
    unitLabel: r.unit_label,
    spend7d: round2(r.spend_7d),
    spend30d: round2(r.spend_30d),
    spend90d: round2(r.spend_90d),
    spendAllTime: round2(r.spend_all_time),
    loggedDaysAllTime: r.logged_days_all_time,
    firstEntryDate: r.first_entry_date,
  }));

  const training = trainingRows.rows.map((r) => ({
    exercise: r.exercise,
    reps7d: r.reps_7d,
    reps30d: r.reps_30d,
    reps90d: r.reps_90d,
    repsAllTime: r.reps_all_time,
    activeDaysAllTime: r.active_days_all_time,
    firstEntryDate: r.first_entry_date,
  }));

  const EMPTY_BUCKET = { dayCount: 0, avgNextDayReps: 0, stddevNextDayReps: 0 };
  const correlation = {
    afterViceDay: { ...EMPTY_BUCKET },
    afterCleanDay: { ...EMPTY_BUCKET },
  };
  correlationRows.rows.forEach((r) => {
    const bucket = r.vice_positive ? 'afterViceDay' : 'afterCleanDay';
    correlation[bucket] = {
      dayCount: r.day_count,
      avgNextDayReps: Number(r.avg_next_day_reps) || 0,
      stddevNextDayReps: Number(r.stddev_next_day_reps) || 0,
    };
  });

  const debts = debtRows.rows.map((r) => ({
    lender: r.lender,
    balance: round2(r.balance),
    originalBalance: round2(r.original_balance),
    apr: r.apr == null ? null : round2(r.apr),
    minPayment: r.min_payment == null ? null : round2(r.min_payment),
  }));
  const debtTotalBalance = round2(debts.reduce((sum, d) => sum + d.balance, 0));
  const debtTotalOriginal = round2(debts.reduce((sum, d) => sum + d.originalBalance, 0));
  const debtSummary = {
    debts,
    totalBalance: debtTotalBalance,
    totalOriginal: debtTotalOriginal,
    paidPct: debtTotalOriginal ? Math.round(((debtTotalOriginal - debtTotalBalance) / debtTotalOriginal) * 100) : 0,
    nextTarget: debts.find((d) => d.balance > 0) || null,
  };

  return {
    generatedAt: new Date().toISOString(),
    vices,
    training,
    cleanStreak: computeCurrentStreak(viceDateMap, today),
    bestCleanStreak: computeBestStreak(viceDateMap),
    trainingStreak: computeCurrentStreak(trainingDateMap, today),
    bestTrainingStreak: computeBestStreak(trainingDateMap),
    correlation,
    savingsBalance: round2(savingsRow.rows[0]?.savings_balance || 0),
    debt: debtSummary,
    dataSources: { vices: true, training: true, debt: true, income: false },
  };
}

module.exports = { buildOracleContext };
