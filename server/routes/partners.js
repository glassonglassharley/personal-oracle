const express = require('express');
const router = express.Router();
const pool = require('../db');
const { getInternalUserId } = require('../utils');

async function getMyId(clerkUserId) {
  return getInternalUserId(clerkUserId);
}

async function getAcceptedFriendship(myId, partnerId) {
  if (!myId || !partnerId || Number(partnerId) === Number(myId)) return null;
  const result = await pool.query(`
    SELECT id FROM friendships
    WHERE status = 'accepted'
      AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
    LIMIT 1
  `, [myId, partnerId]);
  return result.rows[0] || null;
}

// Helper: compute current clean-day streak for a user
async function computeStreak(userId) {
  const rows = await pool.query(`
    SELECT e.date::text AS d
    FROM entries e JOIN vices v ON v.id = e.vice_id
    WHERE v.user_id = $1
    GROUP BY e.date::text
    HAVING MAX(e.quantity) = 0
       AND COUNT(DISTINCT e.vice_id) = (SELECT COUNT(*) FROM vices WHERE user_id = $1)
    ORDER BY d DESC
    LIMIT 60
  `, [userId]);
  const cleanSet = new Set(rows.rows.map(r => r.d));
  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const ds = cur.toISOString().split('T')[0];
    if (cleanSet.has(ds)) { streak++; cur.setDate(cur.getDate() - 1); }
    else if (i === 0) { cur.setDate(cur.getDate() - 1); } // skip today if not yet logged
    else break;
  }
  return streak;
}

// Helper: resolve privacy prefs with safe defaults
function resolvePrivacy(raw) {
  const p = raw || {};
  return {
    show_vices:  p.show_vices  !== false,
    show_spend:  p.show_spend  !== false,
    show_streak: p.show_streak !== false,
    show_xp:     p.show_xp    !== false,
  };
}

// GET /api/partners/privacy — my own sharing preferences
router.get('/privacy', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.json({ show_vices: true, show_spend: true, show_streak: true, show_xp: true });
    const r = await pool.query('SELECT partner_privacy FROM users WHERE id = $1', [myId]);
    res.json(resolvePrivacy(r.rows[0]?.partner_privacy));
  } catch (err) { next(err); }
});

// PUT /api/partners/privacy — save my sharing preferences
router.put('/privacy', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.status(404).json({ error: 'User not found' });
    const prefs = {
      show_vices:  req.body.show_vices  !== false,
      show_spend:  req.body.show_spend  !== false,
      show_streak: req.body.show_streak !== false,
      show_xp:     req.body.show_xp    !== false,
    };
    await pool.query('UPDATE users SET partner_privacy = $1 WHERE id = $2', [JSON.stringify(prefs), myId]);
    res.json(prefs);
  } catch (err) { next(err); }
});

// GET /api/partners — accepted partners with summary stats
router.get('/', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.json([]);

    const r = await pool.query(`
      SELECT
        u.id, u.name,
        u.companion_type, u.companion_state,
        u.partner_privacy,
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

    const partners = await Promise.all(r.rows.map(async row => {
      const priv = resolvePrivacy(row.partner_privacy);
      const streak = priv.show_streak ? await computeStreak(row.id) : null;
      return {
        id: row.id,
        name: row.name,
        companion_type: row.companion_type,
        companion_state: row.companion_state,
        friendship_id: row.friendship_id,
        requester_id: row.requester_id,
        clean_days_this_month: row.clean_days_this_month,
        vices:            priv.show_vices  ? row.vices            : null,
        spent_this_month: priv.show_spend  ? row.spent_this_month : null,
        current_streak:   streak,
      };
    }));

    res.json(partners);
  } catch (err) { next(err); }
});

// GET /api/partners/pending — incoming requests not yet accepted
router.get('/pending', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    if (!myId) return res.json([]);

    const r = await pool.query(`
      SELECT f.id AS friendship_id, u.id, u.name
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

// GET /api/partners/:id/messages — recent chat with an accepted partner
router.get('/:id/messages', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    const partnerId = Number(req.params.id);
    const friendship = await getAcceptedFriendship(myId, partnerId);
    if (!friendship) return res.status(403).json({ error: 'Not a partner' });

    const result = await pool.query(`
      SELECT pm.id, pm.body, pm.created_at, pm.sender_id,
        u.name AS sender_name,
        (pm.sender_id = $2) AS is_me
      FROM partner_messages pm
      JOIN users u ON u.id = pm.sender_id
      WHERE pm.friendship_id = $1
      ORDER BY pm.created_at DESC, pm.id DESC
      LIMIT 100
    `, [friendship.id, myId]);

    res.json(result.rows.reverse());
  } catch (err) { next(err); }
});

// POST /api/partners/:id/messages — send a chat message to an accepted partner
router.post('/:id/messages', async (req, res, next) => {
  try {
    const myId = await getMyId(req.auth.userId);
    const partnerId = Number(req.params.id);
    const friendship = await getAcceptedFriendship(myId, partnerId);
    if (!friendship) return res.status(403).json({ error: 'Not a partner' });

    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message required' });
    if (body.length > 1000) return res.status(400).json({ error: 'Message must be 1000 characters or less' });

    const result = await pool.query(`
      INSERT INTO partner_messages (friendship_id, sender_id, body)
      VALUES ($1, $2, $3)
      RETURNING id, body, created_at, sender_id, true AS is_me
    `, [friendship.id, myId, body]);

    res.json(result.rows[0]);
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
      const [uRow, cleanRow, spentRow, vicesRow, xpRow] = await Promise.all([
        pool.query('SELECT id, name, partner_privacy FROM users WHERE id = $1', [uid]),
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
        pool.query('SELECT total_xp, level FROM user_xp WHERE user_id = $1', [uid]),
      ]);

      // Compute current streak for this user
      const recentEntries = await pool.query(`
        SELECT e.date::text, SUM(e.quantity)::float AS qty
        FROM entries e JOIN vices v ON v.id = e.vice_id
        WHERE v.user_id = $1
        GROUP BY e.date ORDER BY e.date DESC LIMIT 30
      `, [uid]);
      const dMap = {};
      recentEntries.rows.forEach(r => { dMap[r.date] = r.qty === 0; });
      let curStreak = 0;
      const today = new Date();
      const d = new Date(today);
      let skippedToday = false;
      for (let i = 0; i < 30; i++) {
        const ds = d.toISOString().split('T')[0];
        if (ds in dMap) { if (dMap[ds]) curStreak++; else break; }
        else { if (!skippedToday) { skippedToday = true; } else break; }
        d.setDate(d.getDate() - 1);
      }

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

      const isMe = uid === myId;
      const priv = resolvePrivacy(uRow.rows[0]?.partner_privacy);
      return {
        id:               uRow.rows[0].id,
        name:             uRow.rows[0].name,
        is_me:            isMe,
        clean_days:       cleanRow.rows[0].cnt,
        challenge:        chalRow.rows[0] || null,
        last_month_clean: priv.show_streak ? lastClean.rows[0].cnt : null,
        vices:            priv.show_vices  ? vicesRow.rows[0].vices || [] : [],
        spent_this_month: priv.show_spend  ? spentRow.rows[0].total       : null,
        current_streak:   priv.show_streak ? curStreak                    : null,
        total_xp:         priv.show_xp     ? xpRow.rows[0]?.total_xp ?? 0 : null,
        level:            priv.show_xp     ? xpRow.rows[0]?.level ?? 1    : null,
        _sort_streak:     curStreak,
        _sort_xp:         xpRow.rows[0]?.total_xp ?? 0,
      };
    }));

    // Rank using internal sort keys (always available, unaffected by privacy masking)
    rows.sort((a, b) => b._sort_streak - a._sort_streak || b._sort_xp - a._sort_xp);
    rows.forEach((r, i) => {
      r.rank = i + 1;
      delete r._sort_streak;
      delete r._sort_xp;
    });

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
