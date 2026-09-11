const express = require('express');
const router = express.Router();
const pool = require('../db');
const { awardXP, getInternalUserId } = require('../utils');

// When a goal completes, its auto-created upgrade keeps the same title unless
// the title is listed here.
const NEXT_TITLE = {
  'Prove It': 'First $1K Invested',
};

router.get('/', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    if (!myId) return res.json([]);
    const r = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY completed_at NULLS FIRST, created_at DESC',
      [myId]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    const { title, target_amount } = req.body;
    if (!title || !target_amount) return res.status(400).json({ error: 'title and target_amount required' });
    const r = await pool.query(
      'INSERT INTO goals (user_id, title, target_amount) VALUES ($1, $2, $3) RETURNING *',
      [myId, title.trim(), Number(target_amount)]
    );
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    const { title, target_amount } = req.body;
    if (!title || !target_amount) return res.status(400).json({ error: 'title and target_amount required' });
    const r = await pool.query(
      'UPDATE goals SET title = $1, target_amount = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [title.trim(), Number(target_amount), req.params.id, myId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Goal not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id/complete', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    if (!myId) return res.status(404).json({ error: 'User not found' });

    const client = await pool.connect();
    let completedGoal;
    let nextGoal;
    let shouldAward = false;
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        'SELECT * FROM goals WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [req.params.id, myId]
      );
      if (!existing.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Goal not found' });
      }

      const goal = existing.rows[0];
      if (goal.completed_at) {
        completedGoal = goal;
      } else {
        const updated = await client.query(
          'UPDATE goals SET completed_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
          [req.params.id, myId]
        );
        completedGoal = updated.rows[0];
        shouldAward = true;
      }

      const nextTitle = NEXT_TITLE[completedGoal.title] || completedGoal.title;

      const activeUpgrade = await client.query(
        `SELECT * FROM goals
         WHERE user_id = $1 AND completed_at IS NULL AND title = $2 AND target_amount > $3
         ORDER BY target_amount ASC
         LIMIT 1`,
        [myId, nextTitle, completedGoal.target_amount]
      );

      if (activeUpgrade.rows.length) {
        nextGoal = activeUpgrade.rows[0];
      } else {
        const userSavings = await client.query('SELECT savings_balance FROM users WHERE id = $1', [myId]);
        const serverSavings = Number(userSavings.rows[0]?.savings_balance || 0);
        const clientSavings = Number(req.body?.current_savings);
        const currentSavings = Number.isFinite(clientSavings) && clientSavings >= 0
          ? Math.max(serverSavings, clientSavings)
          : serverSavings;
        const currentTarget = Number(completedGoal.target_amount || 0);
        // Exact doubling; keep doubling only if savings already cover the next
        // rung, so the new goal doesn't auto-complete the moment it's created.
        let nextTarget = currentTarget * 2;
        while (nextTarget > 0 && nextTarget <= currentSavings) nextTarget *= 2;
        nextTarget = Math.round(nextTarget * 100) / 100;

        const inserted = await client.query(
          'INSERT INTO goals (user_id, title, target_amount) VALUES ($1, $2, $3) RETURNING *',
          [myId, nextTitle, nextTarget]
        );
        nextGoal = inserted.rows[0];
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    res.json({ ok: true, completed: completedGoal, next_goal: nextGoal });
    if (shouldAward) awardXP(myId, 200).catch(() => {});
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const myId = await getInternalUserId(req.auth.userId);
    await pool.query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [req.params.id, myId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
