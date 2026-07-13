const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

    const { customExercises, goals } = req.body || {};
    const customExercisesClean = Array.isArray(customExercises) ? customExercises : [];
    const goalsClean = goals && typeof goals === 'object' && !Array.isArray(goals) ? goals : {};

    const result = await pool.query(
      `INSERT INTO training_config (user_id, custom_exercises, goals, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id)
       DO UPDATE SET custom_exercises = EXCLUDED.custom_exercises, goals = EXCLUDED.goals, updated_at = now()
       RETURNING custom_exercises, goals, updated_at`,
      [userId, JSON.stringify(customExercisesClean), JSON.stringify(goalsClean)]
    );
    res.json({ ok: true, config: result.rows[0] });
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
