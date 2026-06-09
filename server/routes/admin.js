const express = require('express');
const { clerkClient } = require('@clerk/express');
const router = express.Router();
const pool = require('../db');
const { backupEntries, BACKUP_DIR } = require('../backup');

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

  // Older Clerk-created users were provisioned before we stored email locally.
  // Hydrate only contact fields from Clerk; never expose profile names or app data here.
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

function authAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(503).json({ error: 'ADMIN_SECRET not configured' });
  const auth = req.get('authorization') || '';
  const header = req.get('x-admin-secret') || '';
  if (auth === `Bearer ${secret}` || header === secret) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

router.get('/backup', authAdmin, async (req, res, next) => {
  try {
    const result = await backupEntries(pool);
    res.json({ ok: true, file: result.file, rows: result.rows, backupDir: BACKUP_DIR });
  } catch (err) { next(err); }
});

// GET /api/admin/users — privacy-safe user management list.
// Returns every app user, but only contact identity (email or connected wallet address),
// joined date, and coarse auth type. It intentionally does not expose names, vices,
// entries, spending, partner data, or other private tracker details.
router.get('/users', authAdmin, async (req, res, next) => {
  try {
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

module.exports = router;
