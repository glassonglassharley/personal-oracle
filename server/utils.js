const pool = require('./db');

async function getInternalUserId(clerkUserId) {
  const r = await pool.query('SELECT id FROM users WHERE clerk_user_id = $1', [clerkUserId]);
  return r.rows[0]?.id ?? null;
}

async function verifyViceOwnership(viceId, clerkUserId) {
  const r = await pool.query(
    `SELECT v.id FROM vices v JOIN users u ON v.user_id = u.id
     WHERE v.id = $1 AND u.clerk_user_id = $2`,
    [viceId, clerkUserId]
  );
  return r.rows.length > 0;
}

async function verifyEntryOwnership(entryId, clerkUserId) {
  const r = await pool.query(
    `SELECT e.id FROM entries e
     JOIN vices v ON e.vice_id = v.id
     JOIN users u ON v.user_id = u.id
     WHERE e.id = $1 AND u.clerk_user_id = $2`,
    [entryId, clerkUserId]
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

module.exports = { getInternalUserId, verifyViceOwnership, verifyEntryOwnership, resolveUnitLabel };
