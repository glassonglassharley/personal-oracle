const express = require('express');
const router = express.Router();
const pool = require('../db');

async function getMyId(clerkUserId) {
  const r = await pool.query('SELECT id FROM users WHERE clerk_user_id = $1', [clerkUserId]);
  return r.rows[0]?.id;
}

// GET /api/partners — accepted partners with summary stats
router.get('/', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.json([]);

    const r = await pool.query(`
      SELECT
        u.id, u.name,
        f.id AS friendship_id, f.requester_id,
        (SELECT json_agg(json_build_object('emoji', v.emoji, 'name', v.name) ORDER BY v.id)
         FROM vices v WHERE v.user_id = u.id) AS vices,
        (SELECT COUNT(DISTINCT e.date)
         FROM entries e
         JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = u.id
           AND e.quantity = 0
           AND e.date >= date_trunc('month', NOW())
        ) AS clean_days_this_month,
        (SELECT COALESCE(SUM(e.quantity * e.price_per_unit), 0)
         FROM entries e
         JOIN vices v ON v.id = e.vice_id
         WHERE v.user_id = u.id
           AND e.date >= date_trunc('month', NOW())
        ) AS spent_this_month
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status = 'accepted'
      ORDER BY u.name
    `, [myId]);

    res.json(r.rows);
  } catch (err) { next(err); }
});

// GET /api/partners/pending — incoming requests not yet accepted
router.get('/pending', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.json([]);

    const r = await pool.query(`
      SELECT f.id AS friendship_id, u.id, u.name,
        (SELECT json_agg(json_build_object('emoji', v.emoji))
         FROM vices v WHERE v.user_id = u.id) AS vices
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [myId]);

    res.json(r.rows);
  } catch (err) { next(err); }
});

// GET /api/partners/sent — outgoing requests not yet accepted
router.get('/sent', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.json([]);

    const r = await pool.query(`
      SELECT f.id AS friendship_id, u.id, u.name
      FROM friendships f
      JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [myId]);

    res.json(r.rows);
  } catch (err) { next(err); }
});

// GET /api/partners/search?q= — find users by name (excludes demo accounts)
router.get('/search', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const r = await pool.query(`
      SELECT u.id, u.name,
        (SELECT f.status FROM friendships f
         WHERE (f.requester_id = $1 AND f.addressee_id = u.id)
            OR (f.addressee_id = $1 AND f.requester_id = u.id)
         LIMIT 1) AS relationship,
        (SELECT f.id FROM friendships f
         WHERE (f.requester_id = $1 AND f.addressee_id = u.id)
            OR (f.addressee_id = $1 AND f.requester_id = u.id)
         LIMIT 1) AS friendship_id
      FROM users u
      WHERE u.name ILIKE $2
        AND u.id != $1
        AND u.clerk_user_id NOT LIKE 'demo:%'
      LIMIT 10
    `, [myId, `%${q}%`]);

    res.json(r.rows);
  } catch (err) { next(err); }
});

// POST /api/partners/request — send a partner request
router.post('/request', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    if (Number(user_id) === myId) return res.status(400).json({ error: 'Cannot add yourself' });

    await pool.query(
      'INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [myId, user_id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PUT /api/partners/:id/accept — accept an incoming request
router.put('/:id/accept', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    await pool.query(
      `UPDATE friendships SET status = 'accepted'
       WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [req.params.id, myId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/partners/:id — remove or reject (either side)
router.delete('/:id', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    await pool.query(
      'DELETE FROM friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)',
      [req.params.id, myId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/partners/leaderboard — you + accepted partners ranked by this month
router.get('/leaderboard', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.json([]);

    const now        = new Date();
    const thisMonth  = now.toISOString().slice(0, 7);
    const lastD      = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
    const lastMonth  = lastD.toISOString().slice(0, 7);
    const monthStart = `${thisMonth}-01`;

    // Collect all user IDs: self + accepted partners
    const idRows = await pool.query(`
      SELECT u.id FROM users u
      JOIN friendships f
        ON (f.requester_id = $1 AND f.addressee_id = u.id)
        OR (f.addressee_id = $1 AND f.requester_id = u.id)
      WHERE f.status = 'accepted'
      UNION SELECT $1::int
    `, [myId]);

    const ids = idRows.rows.map(r => r.id);

    const rows = await Promise.all(ids.map(async uid => {
      const [uRow, cleanRow, spentRow, vicesRow] = await Promise.all([
        pool.query('SELECT id, name FROM users WHERE id = $1', [uid]),
        pool.query(`
          SELECT COUNT(DISTINCT e.date)::int AS cnt
          FROM entries e JOIN vices v ON v.id = e.vice_id
          WHERE v.user_id = $1 AND e.quantity = 0 AND e.date >= $2
        `, [uid, monthStart]),
        pool.query(`
          SELECT COALESCE(SUM(e.quantity * e.price_per_unit), 0)::float AS total
          FROM entries e JOIN vices v ON v.id = e.vice_id
          WHERE v.user_id = $1 AND e.date >= $2
        `, [uid, monthStart]),
        pool.query(`
          SELECT json_agg(json_build_object('emoji', emoji) ORDER BY id) AS vices
          FROM vices WHERE user_id = $1
        `, [uid]),
      ]);

      // last month clean days (for challenge winner calc)
      const prevStart = `${lastMonth}-01`;
      const prevEnd   = lastD.toISOString().split('T')[0];
      const lastClean = await pool.query(`
        SELECT COUNT(DISTINCT e.date)::int AS cnt
        FROM entries e JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1 AND e.quantity = 0 AND e.date >= $2 AND e.date <= $3
      `, [uid, prevStart, prevEnd]);

      // active challenge between me and this user this month
      const chalRow = await pool.query(`
        SELECT id, challenger_id FROM challenges
        WHERE month_year = $1
          AND ((challenger_id = $2 AND challengee_id = $3) OR (challenger_id = $3 AND challengee_id = $2))
        LIMIT 1
      `, [thisMonth, myId, uid]);

      return {
        id:               uRow.rows[0].id,
        name:             uRow.rows[0].name,
        is_me:            uid === myId,
        vices:            vicesRow.rows[0].vices || [],
        clean_days:       cleanRow.rows[0].cnt,
        spent_this_month: spentRow.rows[0].total,
        last_month_clean: lastClean.rows[0].cnt,
        challenge:        chalRow.rows[0] || null,
      };
    }));

    // Rank: most clean days first, then least spent
    rows.sort((a, b) => b.clean_days - a.clean_days || a.spent_this_month - b.spent_this_month);
    rows.forEach((r, i) => { r.rank = i + 1; });

    // Annotate last month winner for each challenged pair
    const myLastClean = rows.find(r => r.is_me)?.last_month_clean ?? 0;
    rows.forEach(r => {
      if (!r.is_me && r.challenge) {
        if (r.last_month_clean > myLastClean)      r.last_month_winner = 'them';
        else if (myLastClean > r.last_month_clean) r.last_month_winner = 'me';
        else                                        r.last_month_winner = 'tie';
      }
    });

    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/partners/:id/challenge — challenge a partner for this month
router.post('/:id/challenge', async (req, res, next) => {
  try {
    const myId     = await getMyId(req.auth.userId);
    const partnerId = Number(req.params.id);
    const monthYear = new Date().toISOString().slice(0, 7);

    // Verify they are actually an accepted partner
    const check = await pool.query(`
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
    `, [myId, partnerId]);
    if (!check.rows.length) return res.status(403).json({ error: 'Not a partner' });

    await pool.query(`
      INSERT INTO challenges (challenger_id, challengee_id, month_year)
      VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
    `, [myId, partnerId, monthYear]);

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/partners/challenges — active challenges this month (for dashboard banner)
router.get('/challenges', async (req, res, next) => {
  try {
    const myId     = await getMyId(req.auth.userId);
    const monthYear = new Date().toISOString().slice(0, 7);

    const r = await pool.query(`
      SELECT c.id, c.month_year, c.challenger_id,
        uc.name AS challenger_name
      FROM challenges c
      JOIN users uc ON uc.id = c.challenger_id
      WHERE c.challengee_id = $1 AND c.month_year = $2
    `, [myId, monthYear]);

    res.json(r.rows);
  } catch (err) { next(err); }
});

module.exports = router;
