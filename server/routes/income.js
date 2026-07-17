const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

const cleanStr = (value, max) => String(value ?? '').trim().slice(0, max);
const numOrNull = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
const dateOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// POST /api/income/sources — upsert one income source for the authenticated
// user. Mutable current state (editing a source updates the same row), not a
// per-date event, so re-syncing the same sourceId overwrites, not duplicates.
router.post('/sources', async (req, res, next) => {
  try {
    console.log('[INCOME-DEBUG] arrival', { path: req.path, hasAuth: !!req.headers.authorization, origin: req.headers.origin, bodyKeys: Object.keys(req.body || {}) });
    const userId = await getInternalUserId(req.auth.userId);
    console.log('[INCOME-DEBUG] auth', { clerkUserId: req.auth?.userId || null, internalUserId: userId });
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      sourceId, name, kind, payType, pay, hours, w2PayMode, hourlyRate,
      salaryAmount, salaryPeriod, instrument, principal, rate,
      recurringAmount, recurringFrequency,
    } = req.body || {};

    const sourceIdClean = cleanStr(sourceId, 80);
    if (!sourceIdClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'sourceId' });
      return res.status(400).json({ error: 'Invalid sourceId' });
    }
    const nameClean = cleanStr(name, 120);
    if (!nameClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'name' });
      return res.status(400).json({ error: 'Invalid name' });
    }
    const kindClean = kind === 'invest' ? 'invest' : 'work';

    console.log('[INCOME-DEBUG] pre-insert', { path: req.path, userId });
    const result = await pool.query(
      `INSERT INTO income_sources (
         user_id, source_id, name, kind, pay_type, pay, hours, w2_pay_mode,
         hourly_rate, salary_amount, salary_period, instrument, principal,
         rate, recurring_amount, recurring_frequency, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())
       ON CONFLICT (user_id, source_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         kind = EXCLUDED.kind,
         pay_type = EXCLUDED.pay_type,
         pay = EXCLUDED.pay,
         hours = EXCLUDED.hours,
         w2_pay_mode = EXCLUDED.w2_pay_mode,
         hourly_rate = EXCLUDED.hourly_rate,
         salary_amount = EXCLUDED.salary_amount,
         salary_period = EXCLUDED.salary_period,
         instrument = EXCLUDED.instrument,
         principal = EXCLUDED.principal,
         rate = EXCLUDED.rate,
         recurring_amount = EXCLUDED.recurring_amount,
         recurring_frequency = EXCLUDED.recurring_frequency,
         updated_at = now()
       RETURNING source_id, name, kind, pay_type, pay, hours, w2_pay_mode,
         hourly_rate, salary_amount, salary_period, instrument, principal,
         rate, recurring_amount, recurring_frequency, updated_at`,
      [
        userId, sourceIdClean, nameClean, kindClean,
        payType ? cleanStr(payType, 20) : null,
        numOrNull(pay), numOrNull(hours),
        w2PayMode ? cleanStr(w2PayMode, 20) : null,
        numOrNull(hourlyRate), numOrNull(salaryAmount),
        salaryPeriod ? cleanStr(salaryPeriod, 20) : null,
        instrument ? cleanStr(instrument, 20) : null,
        numOrNull(principal), numOrNull(rate),
        numOrNull(recurringAmount),
        recurringFrequency ? cleanStr(recurringFrequency, 20) : null,
      ]
    );
    console.log('[INCOME-DEBUG] inserted', { path: req.path, returned: !!result.rows[0] });
    res.json({ ok: true, source: result.rows[0] });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// GET /api/income/sources — read back all of this user's income sources.
router.get('/sources', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ sources: [] });

    const result = await pool.query(
      `SELECT source_id, name, kind, pay_type, pay, hours, w2_pay_mode,
         hourly_rate, salary_amount, salary_period, instrument, principal,
         rate, recurring_amount, recurring_frequency, updated_at
       FROM income_sources
       WHERE user_id = $1
       ORDER BY source_id`,
      [userId]
    );
    res.json({ sources: result.rows });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// POST /api/income/tasks — upsert one action item for the authenticated user.
router.post('/tasks', async (req, res, next) => {
  try {
    console.log('[INCOME-DEBUG] arrival', { path: req.path, hasAuth: !!req.headers.authorization, origin: req.headers.origin, bodyKeys: Object.keys(req.body || {}) });
    const userId = await getInternalUserId(req.auth.userId);
    console.log('[INCOME-DEBUG] auth', { clerkUserId: req.auth?.userId || null, internalUserId: userId });
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { taskId, text, done, type, category, completedAt, scheduledAt, completedDates } = req.body || {};

    const taskIdClean = cleanStr(taskId, 80);
    if (!taskIdClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'taskId' });
      return res.status(400).json({ error: 'Invalid taskId' });
    }
    const textClean = cleanStr(text, 500);
    if (!textClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'text' });
      return res.status(400).json({ error: 'Invalid text' });
    }
    const typeClean = ['daily', 'goal', 'upcoming'].includes(type) ? type : 'daily';
    const completedDatesClean = Array.isArray(completedDates)
      ? completedDates.filter((d) => typeof d === 'string').slice(0, 400)
      : [];

    console.log('[INCOME-DEBUG] pre-insert', { path: req.path, userId });
    const result = await pool.query(
      `INSERT INTO income_tasks (
         user_id, task_id, text, done, type, category, completed_at,
         scheduled_at, completed_dates, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (user_id, task_id)
       DO UPDATE SET
         text = EXCLUDED.text,
         done = EXCLUDED.done,
         type = EXCLUDED.type,
         category = EXCLUDED.category,
         completed_at = EXCLUDED.completed_at,
         scheduled_at = EXCLUDED.scheduled_at,
         completed_dates = EXCLUDED.completed_dates,
         updated_at = now()
       RETURNING task_id, text, done, type, category, completed_at, scheduled_at, completed_dates, updated_at`,
      [
        userId, taskIdClean, textClean, !!done, typeClean,
        category ? cleanStr(category, 40) : null,
        dateOrNull(completedAt), dateOrNull(scheduledAt),
        JSON.stringify(completedDatesClean),
      ]
    );
    console.log('[INCOME-DEBUG] inserted', { path: req.path, returned: !!result.rows[0] });
    res.json({ ok: true, task: result.rows[0] });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// GET /api/income/tasks — read back this user's action items.
router.get('/tasks', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ tasks: [] });

    const result = await pool.query(
      `SELECT task_id, text, done, type, category, completed_at, scheduled_at, completed_dates, updated_at
       FROM income_tasks
       WHERE user_id = $1
       ORDER BY task_id`,
      [userId]
    );
    res.json({ tasks: result.rows });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// POST /api/income/opportunities — upsert one opportunity for the authenticated user.
router.post('/opportunities', async (req, res, next) => {
  try {
    console.log('[INCOME-DEBUG] arrival', { path: req.path, hasAuth: !!req.headers.authorization, origin: req.headers.origin, bodyKeys: Object.keys(req.body || {}) });
    const userId = await getInternalUserId(req.auth.userId);
    console.log('[INCOME-DEBUG] auth', { clerkUserId: req.auth?.userId || null, internalUserId: userId });
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { opportunityId, title, companyOrClient, stage, origin, createdAt } = req.body || {};

    const opportunityIdClean = cleanStr(opportunityId, 80);
    if (!opportunityIdClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'opportunityId' });
      return res.status(400).json({ error: 'Invalid opportunityId' });
    }
    const titleClean = cleanStr(title, 200);
    if (!titleClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'title' });
      return res.status(400).json({ error: 'Invalid title' });
    }
    const validStages = ['lead', 'applied', 'replied', 'interview', 'offer', 'won', 'lost'];
    const stageClean = validStages.includes(stage) ? stage : 'lead';

    console.log('[INCOME-DEBUG] pre-insert', { path: req.path, userId });
    const result = await pool.query(
      `INSERT INTO income_opportunities (
         user_id, opportunity_id, title, company_or_client, stage, origin, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), now())
       ON CONFLICT (user_id, opportunity_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         company_or_client = EXCLUDED.company_or_client,
         stage = EXCLUDED.stage,
         origin = EXCLUDED.origin,
         updated_at = now()
       RETURNING opportunity_id, title, company_or_client, stage, origin, created_at, updated_at`,
      [
        userId, opportunityIdClean, titleClean,
        companyOrClient ? cleanStr(companyOrClient, 120) : null,
        stageClean,
        origin ? cleanStr(origin, 40) : null,
        dateOrNull(createdAt),
      ]
    );
    console.log('[INCOME-DEBUG] inserted', { path: req.path, returned: !!result.rows[0] });
    res.json({ ok: true, opportunity: result.rows[0] });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// GET /api/income/opportunities — read back this user's opportunities.
router.get('/opportunities', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ opportunities: [] });

    const result = await pool.query(
      `SELECT opportunity_id, title, company_or_client, stage, origin, created_at, updated_at
       FROM income_opportunities
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    res.json({ opportunities: result.rows });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// POST /api/income/followups — upsert one follow-up for the authenticated user.
router.post('/followups', async (req, res, next) => {
  try {
    console.log('[INCOME-DEBUG] arrival', { path: req.path, hasAuth: !!req.headers.authorization, origin: req.headers.origin, bodyKeys: Object.keys(req.body || {}) });
    const userId = await getInternalUserId(req.auth.userId);
    console.log('[INCOME-DEBUG] auth', { clerkUserId: req.auth?.userId || null, internalUserId: userId });
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { followUpId, title, dueDate, status, origin, createdAt } = req.body || {};

    const followUpIdClean = cleanStr(followUpId, 80);
    if (!followUpIdClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'followUpId' });
      return res.status(400).json({ error: 'Invalid followUpId' });
    }
    const titleClean = cleanStr(title, 200);
    if (!titleClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'title' });
      return res.status(400).json({ error: 'Invalid title' });
    }
    const statusClean = ['open', 'done', 'dismissed'].includes(status) ? status : 'open';

    console.log('[INCOME-DEBUG] pre-insert', { path: req.path, userId });
    const result = await pool.query(
      `INSERT INTO income_followups (
         user_id, followup_id, title, due_date, status, origin, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), now())
       ON CONFLICT (user_id, followup_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         due_date = EXCLUDED.due_date,
         status = EXCLUDED.status,
         origin = EXCLUDED.origin,
         updated_at = now()
       RETURNING followup_id, title, due_date, status, origin, created_at, updated_at`,
      [
        userId, followUpIdClean, titleClean,
        dateOrNull(dueDate), statusClean,
        origin ? cleanStr(origin, 40) : null,
        dateOrNull(createdAt),
      ]
    );
    console.log('[INCOME-DEBUG] inserted', { path: req.path, returned: !!result.rows[0] });
    res.json({ ok: true, followUp: result.rows[0] });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// GET /api/income/followups — read back this user's follow-ups.
router.get('/followups', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ followUps: [] });

    const result = await pool.query(
      `SELECT followup_id, title, due_date, status, origin, created_at, updated_at
       FROM income_followups
       WHERE user_id = $1
       ORDER BY due_date NULLS LAST, followup_id`,
      [userId]
    );
    res.json({ followUps: result.rows });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// POST /api/income/events — append one income event. Events are immutable
// historical facts once logged, so this never upserts — but pre-game resends
// its full current array on every debounced state change, so a duplicate
// eventId is silently ignored (ON CONFLICT DO NOTHING) rather than inserted
// again or updated.
router.post('/events', async (req, res, next) => {
  try {
    console.log('[INCOME-DEBUG] arrival', { path: req.path, hasAuth: !!req.headers.authorization, origin: req.headers.origin, bodyKeys: Object.keys(req.body || {}) });
    const userId = await getInternalUserId(req.auth.userId);
    console.log('[INCOME-DEBUG] auth', { clerkUserId: req.auth?.userId || null, internalUserId: userId });
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { eventId, title, amount, eventDate, opportunityId, origin, notes } = req.body || {};

    const eventIdClean = cleanStr(eventId, 80);
    if (!eventIdClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'eventId' });
      return res.status(400).json({ error: 'Invalid eventId' });
    }
    const titleClean = cleanStr(title, 200);
    if (!titleClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'title' });
      return res.status(400).json({ error: 'Invalid title' });
    }
    const eventDateClean = dateOrNull(eventDate);
    if (!eventDateClean) {
      console.log('[INCOME-DEBUG] reject', { path: req.path, reason: 'eventDate' });
      return res.status(400).json({ error: 'Invalid eventDate' });
    }

    console.log('[INCOME-DEBUG] pre-insert', { path: req.path, userId });
    const result = await pool.query(
      `INSERT INTO income_events (user_id, event_id, title, amount, event_date, opportunity_id, origin, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, event_id) DO NOTHING
       RETURNING event_id, title, amount, event_date, opportunity_id, origin, notes, created_at`,
      [
        userId, eventIdClean, titleClean, numOrNull(amount), eventDateClean,
        opportunityId ? cleanStr(opportunityId, 80) : null,
        origin ? cleanStr(origin, 40) : null,
        notes ? cleanStr(notes, 1000) : null,
      ]
    );
    console.log('[INCOME-DEBUG] inserted', { path: req.path, returned: !!result.rows[0] });
    res.json({ ok: true, event: result.rows[0] || null });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

// GET /api/income/events — read back this user's income events, most recent first.
router.get('/events', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ events: [] });

    const result = await pool.query(
      `SELECT event_id, title, amount, event_date, opportunity_id, origin, notes, created_at
       FROM income_events
       WHERE user_id = $1
       ORDER BY event_date DESC, id DESC`,
      [userId]
    );
    res.json({ events: result.rows });
  } catch (err) { console.error('[INCOME-DEBUG] ERROR', { path: req.path, message: err.message }); next(err); }
});

module.exports = router;
