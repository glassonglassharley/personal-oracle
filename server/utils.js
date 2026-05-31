const pool = require('./db');

function isNumericId(userId) {
  return typeof userId === 'number' || /^\d+$/.test(String(userId || ''));
}

async function getInternalUserId(userId) {
  // VT JWT auth: userId is already the numeric DB primary key
  if (isNumericId(userId)) return parseInt(userId, 10);
  // Clerk / legacy username / wallet: look up by clerk_user_id
  const r = await pool.query('SELECT id FROM users WHERE clerk_user_id = $1', [userId]);
  return r.rows[0]?.id ?? null;
}

async function verifyViceOwnership(viceId, userId) {
  if (isNumericId(userId)) {
    const r = await pool.query(
      'SELECT id FROM vices WHERE id = $1 AND user_id = $2',
      [viceId, parseInt(userId, 10)]
    );
    return r.rows.length > 0;
  }
  const r = await pool.query(
    `SELECT v.id FROM vices v JOIN users u ON v.user_id = u.id
     WHERE v.id = $1 AND u.clerk_user_id = $2`,
    [viceId, userId]
  );
  return r.rows.length > 0;
}

async function verifyEntryOwnership(entryId, userId) {
  if (isNumericId(userId)) {
    const r = await pool.query(
      `SELECT e.id FROM entries e JOIN vices v ON e.vice_id = v.id
       WHERE e.id = $1 AND v.user_id = $2`,
      [entryId, parseInt(userId, 10)]
    );
    return r.rows.length > 0;
  }
  const r = await pool.query(
    `SELECT e.id FROM entries e
     JOIN vices v ON e.vice_id = v.id
     JOIN users u ON v.user_id = u.id
     WHERE e.id = $1 AND u.clerk_user_id = $2`,
    [entryId, userId]
  );
  return r.rows.length > 0;
}

function pluralizeUnitLabel(label) {
  const value = String(label || '').trim();
  if (!value) return 'units';

  const lower = value.toLowerCase();
  if (lower.endsWith('s')) return lower;
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  if (/(ch|sh|x|z)$/.test(lower)) return `${lower}es`;
  return `${lower}s`;
}

function resolveUnitLabel(name, unitLabel) {
  const explicit = String(unitLabel || '').trim();
  if (explicit && explicit.toLowerCase() !== 'unit' && explicit.toLowerCase() !== 'units') return explicit;
  return pluralizeUnitLabel(name);
}

const LEVELS = [
  { level: 1,  min: 0,     name: 'Seedling',    icon: '🌱' },
  { level: 2,  min: 100,   name: 'Sprout',      icon: '🌿' },
  { level: 3,  min: 250,   name: 'Sapling',     icon: '🪴' },
  { level: 4,  min: 500,   name: 'Young Tree',  icon: '🌳' },
  { level: 5,  min: 1000,  name: 'Rooted',      icon: '🌲' },
  { level: 6,  min: 2000,  name: 'Thriving',    icon: '🌴' },
  { level: 7,  min: 3500,  name: 'Flourishing', icon: '🏵️' },
  { level: 8,  min: 5000,  name: 'Resilient',   icon: '💪' },
  { level: 9,  min: 7500,  name: 'Transformed', icon: '⭐' },
  { level: 10, min: 10000, name: 'Legendary',   icon: '👑' },
];

function getLevelInfo(totalXp) {
  let current = LEVELS[0];
  for (const l of LEVELS) { if (totalXp >= l.min) current = l; }
  const next = LEVELS.find(l => l.level === current.level + 1) || null;
  const rangeEnd = next ? next.min : current.min + 1;
  const progress = next
    ? Math.min(100, Math.round(((totalXp - current.min) / (rangeEnd - current.min)) * 100))
    : 100;
  return {
    level:            current.level,
    level_name:       current.name,
    level_icon:       current.icon,
    xp_to_next_level: next ? next.min - totalXp : 0,
    progress_percent: progress,
    next_level_name:  next?.name || null,
    next_level_icon:  next?.icon || null,
  };
}

async function awardXP(userId, amount) {
  if (!userId || amount <= 0) return null;
  const r = await pool.query(`
    INSERT INTO user_xp (user_id, total_xp, level, updated_at)
    VALUES ($1, $2, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET total_xp   = user_xp.total_xp + $2,
          updated_at = NOW()
    RETURNING total_xp, level AS old_level
  `, [userId, amount]);
  const newXp    = r.rows[0].total_xp;
  const oldLevel = r.rows[0].old_level;
  const info     = getLevelInfo(newXp);
  if (info.level !== oldLevel) {
    await pool.query('UPDATE user_xp SET level = $1 WHERE user_id = $2', [info.level, userId]);
  }
  return { ...info, total_xp: newXp, leveled_up: info.level > oldLevel, old_level: oldLevel };
}

async function sendPushToUser(userId, { title, body, url = '/' }) {
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  let webpush;
  try { webpush = require('web-push'); } catch { return; }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:notifications@vice-tracker.local',
    publicKey, privateKey
  );
  const subs = await pool.query(
    'SELECT endpoint, p256dh, auth, id FROM notification_subscriptions WHERE user_id = $1', [userId]
  );
  const payload = JSON.stringify({ title, body, url });
  for (const sub of subs.rows) {
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload
    ).catch(async err => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM notification_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
      }
    });
  }
}

module.exports = {
  getInternalUserId, verifyViceOwnership, verifyEntryOwnership, resolveUnitLabel,
  LEVELS, getLevelInfo, awardXP, sendPushToUser,
};
