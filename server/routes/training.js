const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SAFE_METRIC_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const MAX_ARRAY_ITEMS = 200;

function sanitizeJsonMetricValue(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 200);
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map(sanitizeJsonMetricValue).filter(v => v != null);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (!SAFE_METRIC_KEY_RE.test(key)) continue;
      const clean = sanitizeJsonMetricValue(val);
      if (clean != null) out[key] = clean;
    }
    return out;
  }
  return null;
}

function sanitizeDayMetrics(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out = {};
  for (const [key, val] of Object.entries(data)) {
    if (key === 'date' || key === 'deploymentId') continue;
    if (!SAFE_METRIC_KEY_RE.test(key)) continue;
    const clean = sanitizeJsonMetricValue(val);
    if (clean != null) out[key] = clean;
  }
  return out;
}

// POST /api/training/entries — upsert one exercise's reps for a date, for the
// authenticated user. reps is an absolute daily total (matches Training Log's
// own semantics), so re-syncing the same date+exercise overwrites, not duplicates.
router.post('/entries', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { date, exercise, reps, source } = req.body || {};
    if (!DATE_RE.test(String(date || ''))) return res.status(400).json({ error: 'Invalid date' });
    const exerciseClean = String(exercise || '').trim().slice(0, 64);
    if (!exerciseClean) return res.status(400).json({ error: 'Invalid exercise' });
    const repsNum = Math.max(0, Math.floor(Number(reps) || 0));
    const sourceClean = typeof source === 'string' && source.trim()
      ? source.trim().toLowerCase().slice(0, 40)
      : 'oracle';

    const result = await pool.query(
      `INSERT INTO training_entries (user_id, date, exercise, reps, source, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id, date, exercise)
       DO UPDATE SET reps = EXCLUDED.reps, source = EXCLUDED.source, updated_at = now()
       RETURNING date, exercise, reps, source, updated_at`,
      [userId, date, exerciseClean, repsNum, sourceClean]
    );
    res.json({ ok: true, entry: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/training/config — upsert this user's custom-exercise display
// names and goals, so /api/oracle/summary can render real names/goals
// instead of raw exercise ids and hardcoded defaults. One row per user;
// re-syncing overwrites, same upsert semantics as /entries.
router.post('/config', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { customExercises, goals, nutritionGoals, plateSettings, plateOrder } = req.body || {};
    const customExercisesClean = Array.isArray(customExercises) ? customExercises : [];
    const goalsClean = goals && typeof goals === 'object' && !Array.isArray(goals) ? goals : {};
    const nutritionGoalsClean = nutritionGoals && typeof nutritionGoals === 'object' && !Array.isArray(nutritionGoals) ? nutritionGoals : {};
    const plateSettingsClean = plateSettings && typeof plateSettings === 'object' && !Array.isArray(plateSettings) ? plateSettings : {};
    const plateOrderClean = Array.isArray(plateOrder) ? plateOrder : [];

    const result = await pool.query(
      `INSERT INTO training_config (user_id, custom_exercises, goals, nutrition_goals, plate_settings, plate_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (user_id)
       DO UPDATE SET custom_exercises = EXCLUDED.custom_exercises, goals = EXCLUDED.goals, updated_at = now()
                     , nutrition_goals = EXCLUDED.nutrition_goals
                     , plate_settings = EXCLUDED.plate_settings
                     , plate_order = EXCLUDED.plate_order
       RETURNING custom_exercises, goals, nutrition_goals, plate_settings, plate_order, updated_at`,
      [
        userId,
        JSON.stringify(customExercisesClean),
        JSON.stringify(goalsClean),
        JSON.stringify(nutritionGoalsClean),
        JSON.stringify(plateSettingsClean),
        JSON.stringify(plateOrderClean),
      ]
    );
    res.json({ ok: true, config: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/training/day-metrics — mirror the full safe Training Log day shape
// (not just reps) so Oracle Health can display the same wellness/nutrition
// metrics and visual board as Growth Mirror.
router.post('/day-metrics', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { date, data, source } = req.body || {};
    if (!DATE_RE.test(String(date || ''))) return res.status(400).json({ error: 'Invalid date' });
    const cleanData = sanitizeDayMetrics(data);
    const sourceClean = typeof source === 'string' && source.trim()
      ? source.trim().toLowerCase().slice(0, 40)
      : 'training-log';

    const result = await pool.query(
      `INSERT INTO training_daily_metrics (user_id, date, data, source, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id, date)
       DO UPDATE SET data = EXCLUDED.data, source = EXCLUDED.source, updated_at = now()
       RETURNING date::text, data, source, updated_at`,
      [userId, date, JSON.stringify(cleanData), sourceClean]
    );
    res.json({ ok: true, day: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/training/entries?date=YYYY-MM-DD — read back this user's entries for a date.
router.get('/entries', async (req, res, next) => {
  try {
    const userId = await getInternalUserId(req.auth.userId);
    if (!userId) return res.json({ entries: [] });

    const date = String(req.query.date || '');
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date' });

    const result = await pool.query(
      `SELECT exercise, reps, source, updated_at
       FROM training_entries
       WHERE user_id = $1 AND date = $2
       ORDER BY exercise`,
      [userId, date]
    );
    res.json({ entries: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
