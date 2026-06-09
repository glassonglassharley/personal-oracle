const express = require('express');
const bcrypt = require('bcryptjs');
const { clerkClient } = require('@clerk/express');
const router = express.Router();
const pool = require('../db');

const BCRYPT_ROUNDS = 12;

function userWhere(req) {
  if (req.vtAuth) return { col: 'id', val: req.auth.userId };
  return { col: 'clerk_user_id', val: req.auth.userId };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getPrimaryClerkEmail(user) {
  const emails = Array.isArray(user?.emailAddresses) ? user.emailAddresses : [];
  const primary = emails.find(e => e.id && e.id === user.primaryEmailAddressId) || emails[0];
  return primary?.emailAddress || null;
}

function getPrimaryClerkWallet(user) {
  const wallets = [
    ...(Array.isArray(user?.web3Wallets) ? user.web3Wallets : []),
    ...(Array.isArray(user?.externalAccounts) ? user.externalAccounts : []),
  ];
  const wallet = wallets.find(w => w.web3Wallet || w.walletAddress || w.publicAddress || w.identifier) || null;
  return wallet?.web3Wallet || wallet?.walletAddress || wallet?.publicAddress || wallet?.identifier || null;
}

function parseWalletIdentity(identity) {
  const value = String(identity || '');
  return value.startsWith('wallet:') ? value.slice('wallet:'.length) : null;
}

function authTypeFor(row) {
  const identity = String(row.clerk_user_id || '');
  if (identity.startsWith('wallet:')) return 'wallet';
  if (identity.startsWith('username:')) {
    if (row.password_hash) return 'password';
    if (row.username_token_hash) return 'username-token';
    return 'demo';
  }
  return 'clerk';
}

async function addPrivateContactFields(row) {
  let email = row.email || null;
  let wallet_address = parseWalletIdentity(row.clerk_user_id);

  if (!email && !wallet_address && row.clerk_user_id && !String(row.clerk_user_id).startsWith('username:')) {
    try {
      const clerkUser = await clerkClient.users.getUser(row.clerk_user_id);
      email = getPrimaryClerkEmail(clerkUser);
      wallet_address = getPrimaryClerkWallet(clerkUser);
    } catch (err) {
      console.warn('[ADMIN USERS] Could not hydrate Clerk contact for user', row.id, err.message);
    }
  }

  return {
    id: row.id,
    joined_at: row.created_at,
    auth_type: authTypeFor(row),
    email,
    wallet_address,
    has_contact: Boolean(email || wallet_address),
  };
}

async function currentUserIsGlassonglass(req, row) {
  const localMatches = [row?.auth_username, row?.name]
    .filter(Boolean)
    .some(v => String(v).trim().toLowerCase() === 'glassonglass');
  if (localMatches) return true;

  if (req.vtAuth?.username && String(req.vtAuth.username).trim().toLowerCase() === 'glassonglass') {
    return true;
  }

  const identity = String(req.auth?.userId || '');
  if (!identity || identity.startsWith('username:') || identity.startsWith('wallet:')) return false;

  try {
    const clerkUser = await clerkClient.users.getUser(identity);
    return [clerkUser.username, clerkUser.firstName, clerkUser.fullName]
      .filter(Boolean)
      .some(v => String(v).trim().toLowerCase() === 'glassonglass');
  } catch {
    return false;
  }
}

router.get('/me', async (req, res, next) => {
  try {
    const { col, val } = userWhere(req);
    const r = await pool.query(`SELECT * FROM users WHERE ${col} = $1`, [val]);
    const user = r.rows[0];
    if (!user) return res.json(null);
    const { password_hash, username_token_hash, wallet_session_token_hash, ...safe } = user;
    res.json({ ...safe, has_password: Boolean(password_hash) });
  } catch (err) { next(err); }
});

router.get('/admin/users', async (req, res, next) => {
  try {
    const { col, val } = userWhere(req);
    const selfResult = await pool.query(`SELECT id, clerk_user_id, name, auth_username FROM users WHERE ${col} = $1 LIMIT 1`, [val]);
    const self = selfResult.rows[0];
    if (!self) return res.status(404).json({ error: 'User not found.' });

    const allowed = await currentUserIsGlassonglass(req, self);
    if (!allowed) return res.status(403).json({ error: 'Admin access is restricted.' });

    const { rows } = await pool.query(`
      SELECT
        id,
        clerk_user_id,
        email,
        auth_username,
        password_hash IS NOT NULL AS password_hash,
        username_token_hash IS NOT NULL AS username_token_hash,
        created_at
      FROM users
      ORDER BY created_at DESC, id DESC
    `);

    const users = await Promise.all(rows.map(addPrivateContactFields));
    res.json({ count: users.length, users });
  } catch (err) { next(err); }
});

router.put('/me', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { col, val } = userWhere(req);
    const r = await pool.query(
      `UPDATE users SET name = $1 WHERE ${col} = $2 RETURNING *`,
      [name, val]
    );
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/me/email', async (req, res, next) => {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!rawEmail) return res.status(400).json({ error: 'Email required.' });
    if (!validateEmail(rawEmail)) return res.status(400).json({ error: 'Enter a valid email address.' });

    const { col, val } = userWhere(req);
    const selfResult = await pool.query(`SELECT id FROM users WHERE ${col} = $1`, [val]);
    const selfId = selfResult.rows[0]?.id;
    if (!selfId) return res.status(404).json({ error: 'User not found.' });

    const taken = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2 LIMIT 1', [rawEmail, selfId]);
    if (taken.rows.length > 0) return res.status(409).json({ error: 'That email is already in use.' });

    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [rawEmail, selfId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.put('/me/password', async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

    const { col, val } = userWhere(req);
    const result = await pool.query(`SELECT id, password_hash FROM users WHERE ${col} = $1`, [val]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.password_hash) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password required.' });
      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Current password is wrong.' });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/me', async (req, res, next) => {
  try {
    const { col, val } = userWhere(req);
    await pool.query(`DELETE FROM users WHERE ${col} = $1`, [val]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
