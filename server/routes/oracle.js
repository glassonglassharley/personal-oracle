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
  training: { today: {}, last7: [], history: [], updatedAt: null },
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

    const [periodsRow, perViceRows, last7Rows, streakRows, perViceStreakRows, recentEntryRows, savingsRow, trainingTodayRows, trainingLast7Rows, trainingHistoryRows] = await Promise.all([
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
    trainingTodayRows.rows.forEach((r) => {
      trainingToday[r.exercise] = r.reps;
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
    trainingHistoryRows.rows.forEach((r) => {
      if (!trainingHistoryByDate.has(r.date)) trainingHistoryByDate.set(r.date, { date: r.date });
      trainingHistoryByDate.get(r.date)[r.exercise] = r.reps;
    });
    const trainingHistory = [...trainingHistoryByDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

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
        updatedAt: trainingUpdatedAt,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

// ── POST /api/oracle/chat — cross-domain reasoning chat ──

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[STARTUP] ANTHROPIC_API_KEY is not set — Ask-the-Oracle will use fallback responses only.');
}

const ORACLE_CHAT_MODEL = 'claude-sonnet-5';
const ORACLE_CHAT_DAILY_LIMIT = 30;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error('ANTHROPIC_API_KEY not configured'), { status: 503 });
  const Anthropic = require('@anthropic-ai/sdk');
  return new Anthropic({ apiKey });
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

function buildOracleChatSystemPrompt(context) {
  return `You are the Oracle — an analytical data tool the user consults to understand their own tracked life data. Your job is to reason ACROSS domains (vice spending and training), not describe one in isolation. Nobody has connected these two datasets for the user before; that connection is the whole point of this feature.

Rules:
- Ground every claim in the numbers provided below. Never invent a figure, date, or trend that isn't in the data.
- If asked about something with no backing data (debt, income — see DATA AVAILABILITY), say plainly "I don't have that data yet." Do not guess or estimate.
- The CROSS-DOMAIN CORRELATION section is an association from a small sample, not a proven causal effect. Never claim the vice "causes" a training change — describe it as "on average" or "days that lined up." If the day counts are small (under ~10), say the sample is too small to be confident.
- Be specific and numeric in recommendations. No generic wellness advice ("try to reduce stress", "stay consistent") — every suggestion should reference the user's actual spend, reps, or streak numbers.
- Tone: direct, analytical, concise. You are a sharp analyst, not a cheerleader or a therapist. Skip preamble — lead with the finding.
- Keep responses under 150 words unless the user is asking for a detailed breakdown.

${formatContextForPrompt(context)}`;
}

function fallbackOracleReply(context) {
  const topVice = context.vices[0];
  const topExercise = [...context.training].sort((a, b) => b.repsAllTime - a.repsAllTime)[0];
  const avd = context.correlation.afterViceDay;
  const acd = context.correlation.afterCleanDay;

  const parts = [];
  parts.push(`Data as of ${context.generatedAt.slice(0, 10)}.`);
  if (topVice) {
    parts.push(`Top vice by spend: ${topVice.name} — $${topVice.spend30d} in the last 30 days, $${topVice.spendAllTime} all-time. Clean-day streak: ${context.cleanStreak} (best ${context.bestCleanStreak}).`);
  } else {
    parts.push('No vice data logged yet.');
  }
  if (topExercise) {
    parts.push(`Most-trained exercise: ${topExercise.exercise} — ${topExercise.reps30d} reps in the last 30 days. Training streak: ${context.trainingStreak} (best ${context.bestTrainingStreak}).`);
  } else {
    parts.push('No training data logged yet.');
  }
  if (avd.dayCount > 0 || acd.dayCount > 0) {
    parts.push(`Next-day reps average ${avd.avgNextDayReps} after a vice-logged day (n=${avd.dayCount}) vs ${acd.avgNextDayReps} after a clean day (n=${acd.dayCount}).`);
  }
  parts.push("(The Oracle's AI reasoning is temporarily unavailable — this is a data summary, not a personalized answer.)");
  return parts.join(' ');
}

router.post('/chat', async (req, res, next) => {
  const { messages: clientMessages = [] } = req.body;
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
      const client = getClient();
      const response = await client.messages.create({
        model: ORACLE_CHAT_MODEL,
        max_tokens: 800,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: buildOracleChatSystemPrompt(context),
        messages: clientMessages,
      });
      res.json({ text: response.content?.[0]?.text || '', dataAsOf: context.generatedAt });
    } catch (aiErr) {
      res.json({ text: fallbackOracleReply(context), fallback: true, dataAsOf: context.generatedAt });
    }
  } catch (err) { next(err); }
});

module.exports = router;
