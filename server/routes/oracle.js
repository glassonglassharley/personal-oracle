const express = require('express');
const router = express.Router();
const pool = require('../db');
const {
  getInternalUserId, round2, subtractDay, computeCurrentStreak, computeBestStreak,
} = require('../utils');
const { buildOracleContext } = require('../lib/oracleContext');

const EMPTY_SUMMARY = {
  todaySpend: 0, weekSpend: 0, monthSpend: 0, yearSpend: 0, allTimeSpend: 0,
  cleanStreak: 0, bestStreak: 0, savingsBalance: 0, avgDailySpend: 0,
  perVice: [], last7Days: [], viceEntries: [],
  training: { today: {}, last7: [], history: [], customExercises: [], goals: {}, updatedAt: null },
  income: { weeklyCashFlow: 0, sourceCount: 0, updatedAt: null },
};

// Same set personal-oracle-draft's own file-import path sums for its
// "cumulative reps, last 7 days" chart (src/App.jsx REP_IDS) — steps/water
// are tracked but deliberately excluded from that rep total there too.
const REP_IDS = ['pushups', 'squats', 'situps', 'pullups', 'curls', 'bench', 'dips'];

// Timezone-aware date windows — same pattern as stats.js/savings.js. Entries
// are saved with the client's local calendar date (entries.js takes `date`
// straight from the request body), so windowing off Postgres's raw
// CURRENT_DATE (server/DB timezone) silently misses "today" whenever the DB's
// UTC day has already rolled past the caller's local calendar day.
function parseTz(tz) {
  if (!tz) return 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function localDateStr(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

function dateWindows(tz) {
  const today = localDateStr(tz);
  const [y, m, d] = today.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');

  const weekAgoDate = new Date(Date.UTC(y, m - 1, d - 6));
  const weekAgo = `${weekAgoDate.getUTCFullYear()}-${pad(weekAgoDate.getUTCMonth() + 1)}-${pad(weekAgoDate.getUTCDate())}`;
  const monthStart = `${y}-${pad(m)}-01`;
  const yearStart = `${y}-01-01`;

  return { today, weekAgo, monthStart, yearStart };
}

// GET /api/oracle/summary — combined, read-only aggregate across all of the
// current user's vices, for personal-oracle-draft's cross-app dashboard.
// Auth (Clerk session -> req.auth.userId) and CORS scoping for this path
// both live upstream in server/app.js; this route trusts req.auth only.
router.get('/summary', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ ...EMPTY_SUMMARY, generatedAt: new Date().toISOString() });

    const { today, weekAgo, monthStart, yearStart } = dateWindows(parseTz(req.query.tz));

    const [periodsRow, perViceRows, last7Rows, streakRows, perViceStreakRows, recentEntryRows, savingsRow, trainingTodayRows, trainingLast7Rows, trainingHistoryRows, trainingDailyRows, trainingConfigRow, incomeSourceRows] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN e.date = $2::date THEN e.quantity * e.price_per_unit END), 0)::float AS today_spend,
           COALESCE(SUM(CASE WHEN e.date >= $3::date THEN e.quantity * e.price_per_unit END), 0)::float AS week_spend,
           COALESCE(SUM(CASE WHEN e.date >= $4::date THEN e.quantity * e.price_per_unit END), 0)::float AS month_spend,
           COALESCE(SUM(CASE WHEN e.date >= $5::date THEN e.quantity * e.price_per_unit END), 0)::float AS year_spend,
           COALESCE(SUM(e.quantity * e.price_per_unit), 0)::float AS all_time_spend
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1`,
        [userId, today, weekAgo, monthStart, yearStart]
      ),
      pool.query(
        `SELECT v.id AS id, v.name AS name, v.emoji AS emoji, v.unit_label AS unit_label, v.category AS category,
                COALESCE(SUM(e.quantity * e.price_per_unit), 0)::float AS total_spend,
                COUNT(*) FILTER (WHERE e.quantity > 0)::int AS logged_days,
                COUNT(*) FILTER (WHERE e.quantity = 0)::int AS clean_days
         FROM vices v LEFT JOIN entries e ON e.vice_id = v.id
         WHERE v.user_id = $1
         GROUP BY v.id, v.name, v.emoji, v.unit_label, v.category
         ORDER BY total_spend DESC`,
        [userId]
      ),
      pool.query(
        `SELECT e.date::text AS date, COALESCE(SUM(e.quantity * e.price_per_unit), 0)::float AS amount
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1 AND e.date >= $2::date AND e.date <= $3::date
         GROUP BY e.date`,
        [userId, weekAgo, today]
      ),
      pool.query(
        `SELECT e.date::text AS date, BOOL_OR(e.quantity > 0) AS has_positive
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1
         GROUP BY e.date`,
        [userId]
      ),
      // Per-vice version of the streakRows query above — same clean/dirty-day
      // shape, just grouped by vice too, so computeCurrentStreak can run once per vice.
      pool.query(
        `SELECT e.vice_id AS vice_id, e.date::text AS date, BOOL_OR(e.quantity > 0) AS has_positive
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1
         GROUP BY e.vice_id, e.date`,
        [userId]
      ),
      // Recent logged entries across all vices, newest first — mirrors
      // /api/entries/all's shape (quantity > 0 only; clean-day zero-entries excluded).
      pool.query(
        `SELECT e.id, e.vice_id, v.name AS vice_name, v.emoji AS emoji,
                e.date::text AS date, e.quantity::float, e.price_per_unit::float
         FROM entries e JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = $1 AND e.quantity > 0
         ORDER BY e.date DESC, e.created_at DESC, e.id DESC
         LIMIT 100`,
        [userId]
      ),
      pool.query('SELECT savings_balance FROM users WHERE id = $1', [userId]),
      // Today's reps by exercise — raw training_entries rows, no aggregation.
      pool.query(
        `SELECT exercise, reps::int AS reps, updated_at
         FROM training_entries
         WHERE user_id = $1 AND date = $2::date`,
        [userId, today]
      ),
      // Last 7 days of raw rows for the REP_IDS cumulative series below —
      // same source rows personal-oracle-draft's file-import path derives
      // trainingSeries from, just read live instead of from an export file.
      pool.query(
        `SELECT date::text AS date, exercise, reps::int AS reps
         FROM training_entries
         WHERE user_id = $1 AND date >= $2::date AND date <= $3::date
           AND exercise = ANY($4::text[])`,
        [userId, weekAgo, today, REP_IDS]
      ),
      // Full per-day, per-exercise history (every exercise, not just REP_IDS -
      // training-log's Oracle-relay backfill can carry any custom exercise
      // into training_entries) so personal-oracle-draft's Training screen can
      // render a real history table instead of depending on a stale one-time
      // file import.
      pool.query(
        `SELECT date::text AS date, exercise, reps::int AS reps
         FROM training_entries
         WHERE user_id = $1
         ORDER BY date ASC`,
        [userId]
      ),
      // Full Growth Mirror day metrics (water, sleep, meals, nutrition,
      // meditation/books, rest day, plus exercise totals). This is the source
      // that lets Oracle's Health page match Training Log's current visuals
      // instead of showing only rows from training_entries.
      pool.query(
        `SELECT date::text AS date, data, updated_at
         FROM training_daily_metrics
         WHERE user_id = $1
         ORDER BY date ASC`,
        [userId]
      ),
      // Real display names/goals for custom exercises, relayed from Training
      // Log's save_config - without this, the summary only ever has raw
      // exercise ids (e.g. "custom_1782962202006") and no goal info.
      pool.query(
        `SELECT custom_exercises, goals, nutrition_goals, plate_settings, plate_order
         FROM training_config WHERE user_id = $1`,
        [userId]
      ),
      // Income sources synced from pre-game — same weekly-normalization as
      // buildOracleContext's income section (server/lib/oracleContext.js),
      // kept in sync so the dashboard and chat never disagree.
      pool.query(
        `SELECT pay, kind, instrument, recurring_amount, recurring_frequency, updated_at
         FROM income_sources
         WHERE user_id = $1`,
        [userId]
      ),
    ]);

    const periods = periodsRow.rows[0];

    const perViceDateMap = {};
    perViceStreakRows.rows.forEach((r) => {
      if (!perViceDateMap[r.vice_id]) perViceDateMap[r.vice_id] = {};
      perViceDateMap[r.vice_id][r.date] = !r.has_positive;
    });

    const grandTotal = perViceRows.rows.reduce((sum, r) => sum + r.total_spend, 0);
    const perVice = perViceRows.rows.map((r) => ({
      name: r.name,
      total: round2(r.total_spend),
      pct: grandTotal > 0 ? round2((r.total_spend / grandTotal) * 100) : 0,
      emoji: r.emoji,
      cleanDays: computeCurrentStreak(perViceDateMap[r.id] || {}, today),
      logCount: r.logged_days,
      unitLabel: r.unit_label,
      category: r.category,
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

    const trainingToday = {};
    let trainingUpdatedAt = null;
    const dailyMetricsToday = trainingDailyRows.rows.find((r) => r.date === today) || null;
    if (dailyMetricsToday) {
      Object.assign(trainingToday, dailyMetricsToday.data || {});
      if (!trainingUpdatedAt || dailyMetricsToday.updated_at > trainingUpdatedAt) trainingUpdatedAt = dailyMetricsToday.updated_at;
    }
    // training_entries is relayed per-exercise, independently of the full
    // day-metrics blob, so it can go stale relative to daily_metrics for a
    // given exercise (e.g. a value dropping to zero that never re-relayed
    // here). Only let it overwrite daily_metrics' value when it's actually
    // newer, or when daily_metrics never had that exercise at all.
    trainingTodayRows.rows.forEach((r) => {
      const dailyMetricsHasNewer = dailyMetricsToday
        && Object.prototype.hasOwnProperty.call(dailyMetricsToday.data || {}, r.exercise)
        && dailyMetricsToday.updated_at >= r.updated_at;
      if (!dailyMetricsHasNewer) trainingToday[r.exercise] = r.reps;
      if (!trainingUpdatedAt || r.updated_at > trainingUpdatedAt) trainingUpdatedAt = r.updated_at;
    });

    // Cumulative rep total across the trailing 7 days, oldest to newest — same
    // running-sum shape as personal-oracle-draft's own trainingSeries, just
    // computed from live rows instead of an imported export's history array.
    const trainingByDate = new Map();
    trainingLast7Rows.rows.forEach((r) => {
      trainingByDate.set(r.date, (trainingByDate.get(r.date) || 0) + r.reps);
    });
    let trainingRunning = 0;
    const trainingLast7 = [];
    for (let i = 6; i >= 0; i--) {
      let cursor = today;
      for (let j = 0; j < i; j++) cursor = subtractDay(cursor);
      trainingRunning += trainingByDate.get(cursor) || 0;
      trainingLast7.push(trainingRunning);
    }

    // Pivot (date, exercise, reps) rows into one object per day -
    // { date, pushups: N, squats: N, ... } - the shape the Training screen's
    // history table already expects from a file import.
    const trainingHistoryByDate = new Map();
    trainingDailyRows.rows.forEach((r) => {
      trainingHistoryByDate.set(r.date, { date: r.date, ...(r.data || {}) });
      if (!trainingUpdatedAt || r.updated_at > trainingUpdatedAt) trainingUpdatedAt = r.updated_at;
    });
    trainingHistoryRows.rows.forEach((r) => {
      if (!trainingHistoryByDate.has(r.date)) trainingHistoryByDate.set(r.date, { date: r.date });
      trainingHistoryByDate.get(r.date)[r.exercise] = r.reps;
    });
    const trainingHistory = [...trainingHistoryByDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Same annual multipliers pre-game's own PASSIVE_FREQUENCIES table uses
    // (PreGameApp.tsx) — occurrences per year, converted to weekly by /52.
    const INCOME_ANNUAL_MULTIPLIER = { weekly: 52, biweekly: 26, monthly: 12, annual: 1 };
    let incomeUpdatedAt = null;
    const incomeWeeklyCashFlow = round2(incomeSourceRows.rows.reduce((sum, r) => {
      if (!incomeUpdatedAt || r.updated_at > incomeUpdatedAt) incomeUpdatedAt = r.updated_at;
      if (r.kind === 'work') return sum + (Number(r.pay) || 0);
      if (r.kind === 'invest' && r.instrument === 'Recurring') {
        const multiplier = INCOME_ANNUAL_MULTIPLIER[r.recurring_frequency] || 0;
        return sum + ((Number(r.recurring_amount) || 0) * multiplier) / 52;
      }
      return sum;
    }, 0));

    res.json({
      todaySpend: round2(periods.today_spend),
      weekSpend: round2(periods.week_spend),
      monthSpend: round2(periods.month_spend),
      yearSpend: round2(periods.year_spend),
      allTimeSpend: round2(periods.all_time_spend),
      cleanStreak: computeCurrentStreak(dateMap, today),
      bestStreak: computeBestStreak(dateMap),
      savingsBalance: round2(savingsRow.rows[0]?.savings_balance || 0),
      avgDailySpend,
      perVice,
      last7Days,
      viceEntries: recentEntryRows.rows.map((r) => ({
        id: r.id,
        viceId: r.vice_id,
        viceName: r.vice_name,
        emoji: r.emoji,
        date: r.date,
        quantity: r.quantity,
        pricePerUnit: r.price_per_unit,
        total: round2(r.quantity * r.price_per_unit),
      })),
      training: {
        today: trainingToday,
        last7: trainingLast7,
        history: trainingHistory,
        customExercises: trainingConfigRow.rows[0]?.custom_exercises || [],
        goals: trainingConfigRow.rows[0]?.goals || {},
        nutritionGoals: trainingConfigRow.rows[0]?.nutrition_goals || {},
        plateSettings: trainingConfigRow.rows[0]?.plate_settings || {},
        plateOrder: trainingConfigRow.rows[0]?.plate_order || [],
        updatedAt: trainingUpdatedAt,
      },
      income: {
        weeklyCashFlow: incomeWeeklyCashFlow,
        sourceCount: incomeSourceRows.rows.length,
        updatedAt: incomeUpdatedAt,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ── POST /api/oracle/chat — cross-domain reasoning chat ──

if (!process.env.AI_API_KEY) {
  console.warn('[STARTUP] AI_API_KEY is not set — Ask-the-Oracle will use fallback responses only.');
}

const ORACLE_CHAT_DAILY_LIMIT = 30;

// OpenAI-compatible chat/completions call - works against OpenAI itself or
// any compatible provider (NVIDIA NIM, DeepSeek, etc.) by pointing AI_BASE_URL
// elsewhere. One plain fetch instead of a provider SDK, so swapping providers
// is an env var change, not a code change.
function getAiConfig() {
  const baseUrl = String(process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4.1-mini';
  if (!apiKey) throw Object.assign(new Error('AI_API_KEY not configured'), { status: 503 });
  return { baseUrl, apiKey, model };
}

// Separate table from insights.js's coach_usage — keeps that live feature's
// rate limiting untouched while this route gets its own budget.
let oracleChatTableReady = false;
async function ensureOracleChatUsageTable() {
  if (oracleChatTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oracle_chat_usage (
      user_id       INTEGER NOT NULL,
      usage_date    DATE    NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, usage_date)
    )
  `);
  oracleChatTableReady = true;
}

async function checkOracleChatRateLimit(userId) {
  await ensureOracleChatUsageTable();
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO oracle_chat_usage (user_id, usage_date, message_count)
     VALUES ($1, $2, 0) ON CONFLICT DO NOTHING`,
    [userId, today]
  );
  const r = await pool.query(
    `UPDATE oracle_chat_usage
     SET message_count = message_count + 1
     WHERE user_id = $1 AND usage_date = $2 AND message_count < $3
     RETURNING message_count`,
    [userId, today, ORACLE_CHAT_DAILY_LIMIT]
  );
  if (r.rows.length === 0) return { allowed: false };
  return { allowed: true, remaining: ORACLE_CHAT_DAILY_LIMIT - r.rows[0].message_count };
}

function sanitizeCompactClientContext(value) {
  if (!value || typeof value !== 'object' || value.schema !== 'personal-oracle-compact-v1') return null;
  const finite = (input) => Number.isFinite(Number(input)) ? Math.round(Number(input) * 100) / 100 : 0;
  const shortText = (input, max = 160) => typeof input === 'string' ? input.trim().slice(0, max) : '';
  return {
    weeklyCashFlow: finite(value.weeklyCashFlow),
    liabilitiesRemaining: finite(value.liabilitiesRemaining),
    liabilitiesPaidPct: finite(value.liabilitiesPaidPct),
    invested: finite(value.invested),
    viceSpendWeek: finite(value.viceSpendWeek),
    trainingCompletedActions: finite(value.trainingCompletedActions),
    trainingTotalActions: finite(value.trainingTotalActions),
    activeBrief: value.activeBrief && typeof value.activeBrief === 'object' ? {
      title: shortText(value.activeBrief.title, 100),
      recommendedMove: shortText(value.activeBrief.recommendedMove, 180),
    } : null,
  };
}

function formatCompactClientContext(context) {
  if (!context) return 'No current Command Center snapshot was supplied.';
  const lines = [
    'CURRENT COMMAND CENTER SNAPSHOT (compact browser summary; no raw logs):',
    `- Weekly cash flow: $${context.weeklyCashFlow}`,
    `- Liabilities remaining: $${context.liabilitiesRemaining} (${context.liabilitiesPaidPct}% paid off)`,
    `- Invested balance: $${context.invested}`,
    `- Tracked vice spend this week: $${context.viceSpendWeek}`,
    `- Training actions completed: ${context.trainingCompletedActions} of ${context.trainingTotalActions}`,
  ];
  if (context.activeBrief?.title) lines.push(`- Active brief: ${context.activeBrief.title}`);
  if (context.activeBrief?.recommendedMove) lines.push(`- Current recommended move: ${context.activeBrief.recommendedMove}`);
  return lines.join('\n');
}
function formatContextForPrompt(context) {
  const lines = [];

  lines.push(`Data as of: ${context.generatedAt}`);
  lines.push('');

  lines.push('VICES (spend in USD, windowed):');
  if (context.vices.length === 0) {
    lines.push('  none tracked yet');
  } else {
    context.vices.forEach((v) => {
      lines.push(
        `  - ${v.emoji || ''} ${v.name} [${v.category || 'uncategorized'}]: ` +
        `7d=$${v.spend7d}, 30d=$${v.spend30d}, 90d=$${v.spend90d}, all-time=$${v.spendAllTime}, ` +
        `logged ${v.loggedDaysAllTime} day(s), first entry ${v.firstEntryDate || 'n/a'}`
      );
    });
  }
  lines.push(`  Whole-life clean-day streak: ${context.cleanStreak} (best: ${context.bestCleanStreak})`);
  lines.push(`  Savings balance: $${context.savingsBalance}`);
  lines.push('');

  lines.push('TRAINING (reps, windowed):');
  if (context.training.length === 0) {
    lines.push('  none tracked yet');
  } else {
    context.training.forEach((t) => {
      lines.push(
        `  - ${t.exercise}: 7d=${t.reps7d}, 30d=${t.reps30d}, 90d=${t.reps90d}, all-time=${t.repsAllTime}, ` +
        `active ${t.activeDaysAllTime} day(s), first entry ${t.firstEntryDate || 'n/a'}`
      );
    });
  }
  lines.push(`  Training-active streak: ${context.trainingStreak} (best: ${context.bestTrainingStreak})`);
  lines.push('');

  lines.push('DEBT (snowball order, smallest balance first):');
  if (!context.debt || context.debt.debts.length === 0) {
    lines.push('  none tracked yet');
  } else {
    context.debt.debts.forEach((d) => {
      lines.push(
        `  - ${d.lender}: balance=$${d.balance} (original $${d.originalBalance}), ` +
        `apr=${d.apr == null ? 'n/a' : d.apr + '%'}, min payment=${d.minPayment == null ? 'n/a' : '$' + d.minPayment}`
      );
    });
    lines.push(`  Total balance: $${context.debt.totalBalance} (${context.debt.paidPct}% paid down from $${context.debt.totalOriginal} original)`);
    lines.push(`  Next snowball target: ${context.debt.nextTarget ? context.debt.nextTarget.lender : 'none — all paid off'}`);
  }
  lines.push('');

  lines.push('INCOME (weekly-normalized cash flow per source):');
  if (!context.income || context.income.sources.length === 0) {
    lines.push('  none tracked yet');
  } else {
    context.income.sources.forEach((s) => {
      lines.push(`  - ${s.name} [${s.kind}${s.instrument ? '/' + s.instrument : ''}]: $${s.weeklyPay}/wk`);
    });
    lines.push(`  Total weekly cash flow: $${context.income.weeklyCashFlow} (monthly ~$${context.income.monthlyCashFlow}, yearly ~$${context.income.yearlyCashFlow})`);
  }
  lines.push('');

  lines.push('CROSS-DOMAIN CORRELATION (next-day training volume, combined across vices — association only, not causation):');
  const avd = context.correlation.afterViceDay;
  const acd = context.correlation.afterCleanDay;
  lines.push(`  - After a day with ANY vice logged (n=${avd.dayCount} days): avg next-day reps = ${avd.avgNextDayReps} (stddev ${avd.stddevNextDayReps})`);
  lines.push(`  - After a CLEAN day (n=${acd.dayCount} days): avg next-day reps = ${acd.avgNextDayReps} (stddev ${acd.stddevNextDayReps})`);
  lines.push('');

  lines.push('DATA AVAILABILITY:');
  Object.entries(context.dataSources).forEach(([key, has]) => {
    lines.push(`  - ${key}: ${has ? 'available' : 'NOT available yet'}`);
  });

  return lines.join('\n');
}

function buildOracleChatSystemPrompt(context, clientContext, mode = 'quick') {
  return `You are the Oracle — an analytical data tool the user consults to understand their own tracked life data. Your job is to reason ACROSS domains (vice spending, training, and debt), not describe one in isolation. Nobody has connected these datasets for the user before; that connection is the whole point of this feature.

Rules:
- For anything about the user's own tracked data (vices, training, debt, income): ground every claim in the numbers provided below. Never invent a figure, date, or trend that isn't in the data.
- If asked about a tracked category with no backing data yet (income — see DATA AVAILABILITY), say plainly "I don't have that data yet." Do not guess or estimate the user's own numbers.
- For general-knowledge or current-events questions unrelated to the user's tracked data, answer normally using your own knowledge or web search — you are not restricted to the numbers below for those.
- The CROSS-DOMAIN CORRELATION section is an association from a small sample, not a proven causal effect. Never claim the vice "causes" a training change — describe it as "on average" or "days that lined up." If the day counts are small (under ~10), say the sample is too small to be confident.
- Be specific and numeric in recommendations. No generic wellness advice ("try to reduce stress", "stay consistent") — every suggestion should reference the user's actual spend, reps, or streak numbers.
- Tone: direct, analytical, concise. You are a sharp analyst, not a cheerleader or a therapist. Skip preamble — lead with the finding.
- QUICK mode: answer in 80 words or fewer. Lead with one recommendation, then cite 2-3 supplied facts. No preamble.
- DEEP mode: answer in 220 words or fewer with finding, evidence, tradeoff, and next move.
- The requested mode is: ${mode === 'deep' ? 'DEEP' : 'QUICK'}.
- Prefer plain language. Never use vague slogans such as "protect the margin" without immediately explaining them.

${formatContextForPrompt(context)}` + "\n\n" + formatCompactClientContext(clientContext);
}

function localOracleReply(serverContext, clientContext, clientMessages, mode = 'quick') {
  const question = String([...clientMessages].reverse().find((message) => message?.role === 'user')?.content || '').toLowerCase();
  const compact = clientContext || {};
  const cashFlow = Number(compact.weeklyCashFlow || 0);
  const liabilities = Number(compact.liabilitiesRemaining || serverContext.debt?.totalBalance || 0);
  const invested = Number(compact.invested || serverContext.savingsBalance || 0);
  const viceSpend = Number(compact.viceSpendWeek || 0);
  const completed = Number(compact.trainingCompletedActions || 0);
  const trainingTotal = Number(compact.trainingTotalActions || 0);
  const nextTarget = serverContext.debt?.nextTarget;
  const money = (value) => `$${Math.round(Number(value || 0) * 100) / 100}`;
  const evidence = [];
  if (cashFlow > 0) evidence.push(`weekly cash flow is ${money(cashFlow)}`);
  if (liabilities > 0) evidence.push(`liabilities are ${money(liabilities)}`);
  if (viceSpend > 0) evidence.push(`tracked vice spend is ${money(viceSpend)} this week`);
  if (invested > 0) evidence.push(`the invested balance is ${money(invested)}`);
  if (trainingTotal > 0) evidence.push(`${completed} of ${trainingTotal} training actions are complete`);

  const previousAssistant = [...clientMessages].reverse().find((message, index, list) => message?.role === 'assistant' && index > 0)?.content;
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!. ]*$/.test(question)) {
    return 'Hello. I’m here and I have your latest synced summary. What would you like to talk through—money, liabilities, spending, investing, training, or your next priority?';
  }
  if (/^(thanks|thank you|appreciate it|got it)[!. ]*$/.test(question)) {
    return 'You’re welcome. Would you like to keep working through this priority or look at another part of your life?';
  }
  if (/^(how are you|how’s it going|how is it going)[?!. ]*$/.test(question)) {
    return 'Ready to help. I’m working from your latest synced facts rather than guessing. What’s on your mind?';
  }
  if (/^(bye|goodbye|talk later|see you)[!. ]*$/.test(question)) {
    return 'Understood. I’ll be here when you want to review what changed or decide your next move.';
  }
  if (/^(help|can you help|what can you do)[?!. ]*$/.test(question)) {
    return 'Yes. I can help you understand cash flow, liabilities, investing, vice spending, training progress, and the tradeoffs between them. Tell me what feels most important right now.';
  }
  if (/^(yes|yeah|yep|okay|ok|sure)[!. ]*$/.test(question)) {
    return previousAssistant ? 'Understood. What part would you like to explore—the evidence, another option, or the first practical step?' : 'Understood. What would you like to focus on first?';
  }
  if (/^(no|nope|not really)[!. ]*$/.test(question)) {
    return 'That’s fine. Tell me what does not fit, and I’ll approach it from a different angle.';
  }
  let recommendation;
  let reason;
  if (/evidence|why|reason|how did|explain/.test(question)) {
    recommendation = compact.activeBrief?.recommendedMove || 'Use the strongest current signal as your next move.';
    reason = evidence.length ? `The current evidence is that ${evidence.slice(0, 3).join(', ')}.` : 'There are not enough synced facts yet to support a recommendation.';
  } else if (/cut|reduce|spend|vice/.test(question)) {
    if (viceSpend > 0) {
      const reduction = Math.max(1, Math.round(viceSpend * 0.2));
      recommendation = `Reduce tracked vice spending by ${money(reduction)} this week.`;
      reason = `That is a 20% reduction from the current ${money(viceSpend)} and keeps the target measurable.`;
    } else {
      recommendation = 'No spending cut is supported by the current synced data.';
      reason = 'Tracked vice spending is currently zero or unavailable.';
    }
  } else if (/train|health|workout|exercise/.test(question)) {
    const remaining = Math.max(0, trainingTotal - completed);
    recommendation = remaining > 0 ? `Complete one of the ${remaining} remaining training actions next.` : 'Maintain the completed training plan.';
    reason = trainingTotal > 0 ? `${completed} of ${trainingTotal} tracked actions are complete.` : 'Training goals are not synced yet.';
  } else if (/liabilit|debt|pay/.test(question)) {
    recommendation = nextTarget ? `Make the next payment toward ${nextTarget.lender}.` : liabilities > 0 ? 'Direct the next planned payment toward the smallest open liability.' : 'No open liability is available to prioritize.';
    reason = nextTarget ? `${nextTarget.lender} is the current snowball target at ${money(nextTarget.balance)}.` : `Current liabilities total ${money(liabilities)}.`;
  } else if (/invest|saving/.test(question)) {
    recommendation = liabilities > 0 ? 'Keep investing consistent, but prioritize the next planned liability payment first.' : 'Direct the next available contribution to investing.';
    reason = `The invested balance is ${money(invested)}${liabilities > 0 ? ` while liabilities remain ${money(liabilities)}` : ''}.`;
  } else if (/another|option|alternative/.test(question)) {
    recommendation = trainingTotal > completed ? 'Choose one remaining training action as today’s alternative priority.' : viceSpend > 0 ? 'Use a smaller vice-spending reduction as the alternative move.' : 'Review the smallest open liability as the alternative priority.';
    reason = evidence.length ? `This keeps the choice grounded in current data: ${evidence.slice(0, 2).join(' and ')}.` : 'More synced data is needed for a stronger alternative.';
  } else if (!/(priorit|should|next|focus|recommend|what do|plan|afford)/.test(question)) {
    recommendation = 'Tell me a little more about what you want to decide.';
    reason = 'I can use your synced facts once I know whether you want to discuss spending, liabilities, investing, training, or something else.';
  } else if (cashFlow <= 0) {
    recommendation = 'Sync or import income before making a financial recommendation.';
    reason = 'Current weekly cash flow is unavailable, so affordability cannot be verified.';
  } else if (viceSpend >= cashFlow * 0.2) {
    const reserve = Math.max(1, Math.round(Math.min(viceSpend * 0.2, cashFlow * 0.1)));
    recommendation = `Set aside ${money(reserve)} before optional spending.`;
    reason = `Tracked vice spending is ${money(viceSpend)}, which is ${Math.round((viceSpend / cashFlow) * 100)}% of ${money(cashFlow)} weekly cash flow.`;
  } else if (liabilities > 0) {
    recommendation = nextTarget ? `Prioritize the next payment to ${nextTarget.lender}.` : 'Prioritize the next planned liability payment.';
    reason = `${money(liabilities)} remains in liabilities${compact.liabilitiesPaidPct ? ` and ${compact.liabilitiesPaidPct}% has been paid off` : ''}.`;
  } else if (trainingTotal > completed) {
    recommendation = 'Complete one remaining training action next.';
    reason = `${completed} of ${trainingTotal} actions are complete.`;
  } else {
    recommendation = 'Keep the current plan and direct the next surplus toward investing.';
    reason = `No stronger risk signal is present; the invested balance is ${money(invested)}.`;
  }

  if (mode === 'deep') {
    const evidenceLine = evidence.length ? ` Evidence: ${evidence.join('; ')}.` : '';
    return `${recommendation} ${reason}${evidenceLine} This is a rules-based Oracle response generated from the latest synced summary, not a prediction.`;
  }
  return `${recommendation} ${reason}`;
}
router.post('/chat', async (req, res, next) => {
  const { messages: clientMessages = [], context: rawClientContext = null, mode: rawMode = 'quick' } = req.body;
  const clientContext = sanitizeCompactClientContext(rawClientContext);
  const mode = rawMode === 'deep' ? 'deep' : 'quick';
  if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  try {
    const userId = await getInternalUserId(req.auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not signed in' });

    const { allowed } = await checkOracleChatRateLimit(userId);
    if (!allowed) {
      return res.status(429).json({
        text: "You've hit today's limit for Oracle conversations. Come back tomorrow — your data will still be here.",
        rateLimited: true,
      });
    }

    const context = await buildOracleContext(userId);

    try {
      const { baseUrl, apiKey, model } = getAiConfig();
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: mode === 'deep' ? 600 : 250,
          temperature: 0.4,
          tools: [{ type: 'openrouter:web_search' }],
          messages: [
            { role: 'system', content: buildOracleChatSystemPrompt(context, clientContext, mode) },
            ...clientMessages,
          ],
        }),
      });
      const json = await upstream.json();
      if (!upstream.ok) {
        throw Object.assign(new Error(json?.error?.message || `AI provider returned ${upstream.status}`), { status: upstream.status });
      }
      const text = json.choices?.[0]?.message?.content || '';
      res.json({ text, dataAsOf: context.generatedAt });
    } catch (aiErr) {
      console.error('oracle chat: AI call failed, using fallback:', aiErr);
      res.json({ text: localOracleReply(context, clientContext, clientMessages, mode), fallback: true, localReasoning: true, dataAsOf: context.generatedAt });
    }
  } catch (err) { next(err); }
});

// GET /api/oracle/context — the same cross-domain context /chat feeds to the
// model, returned raw with no AI call. Lets a client do its own model call
// somewhere this server can't reach (e.g. a local model in the browser's own
// network) while still using the one real buildOracleContext computation.
// Same auth + rate-limit gate as /chat; read-only.
router.get('/context', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not signed in' });

    const { allowed } = await checkOracleChatRateLimit(userId);
    if (!allowed) {
      return res.status(429).json({ error: "You've hit today's limit for Oracle conversations. Come back tomorrow — your data will still be here." });
    }

    const context = await buildOracleContext(userId);
    res.json(context);
  } catch (err) { next(err); }
});

module.exports = router;
