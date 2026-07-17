const pool = require('../db');
const { round2, computeCurrentStreak, computeBestStreak } = require('../utils');

// Assembles everything the Oracle chat needs to reason across vice spending,
// training, debt, and income data for one user, date-aligned, in a single
// round trip.
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
    incomeSourceRows,
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

    // Income sources synced from pre-game (via /api/income/sources). "pay" is
    // already weekly-normalized client-side before it ever reaches this table
    // (pre-game's addSource(): W2 hourly -> hourlyRate*hours, W2 salary ->
    // annualPay/52, 1099 -> direct weekly entry) -- so work sources need no
    // recomputation here. Only recurring investment income needs converting,
    // using pre-game's own frequency multipliers (see below). Non-recurring
    // investment kinds (CD/Dividend/Interest) have no weekly-equivalent in
    // pre-game's own model either (balance+rate, not periodic cash flow), so
    // they're listed but contribute 0 to cash flow -- consistent with the
    // source app, not invented here.
    pool.query(
      `SELECT name, kind, pay, instrument, recurring_amount, recurring_frequency, updated_at
       FROM income_sources
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
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

  // Same annual multipliers pre-game's own PASSIVE_FREQUENCIES table uses
  // (PreGameApp.tsx) -- occurrences per year, converted to weekly by /52.
  const INCOME_ANNUAL_MULTIPLIER = { weekly: 52, biweekly: 26, monthly: 12, annual: 1 };
  const incomeSources = incomeSourceRows.rows.map((r) => {
    let weeklyPay = 0;
    if (r.kind === 'work') {
      weeklyPay = Number(r.pay) || 0;
    } else if (r.kind === 'invest' && r.instrument === 'Recurring') {
      const multiplier = INCOME_ANNUAL_MULTIPLIER[r.recurring_frequency] || 0;
      weeklyPay = ((Number(r.recurring_amount) || 0) * multiplier) / 52;
    }
    return {
      name: r.name,
      kind: r.kind,
      instrument: r.instrument,
      weeklyPay: round2(weeklyPay),
      updatedAt: r.updated_at,
    };
  });
  const incomeWeeklyCashFlow = round2(incomeSources.reduce((sum, s) => sum + s.weeklyPay, 0));
  const incomeSummary = {
    sources: incomeSources,
    weeklyCashFlow: incomeWeeklyCashFlow,
    monthlyCashFlow: round2((incomeWeeklyCashFlow * 52) / 12),
    yearlyCashFlow: round2(incomeWeeklyCashFlow * 52),
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
    income: incomeSummary,
    dataSources: { vices: true, training: true, debt: true, income: true },
  };
}

module.exports = { buildOracleContext };
