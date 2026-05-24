const express = require('express');
const crypto = require('crypto');
const { PublicKey } = require('@solana/web3.js');
const pool = require('../db');

const router = express.Router();
const SIGN_IN_MESSAGE = 'Sign in to Vice Spending';

function newToken() {
  return `vtw_${crypto.randomBytes(32).toString('base64url')}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Ed25519 SPKI DER prefix — wraps the raw 32-byte public key so Node crypto can parse it
const ED25519_DER_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function verifySignature(publicKeyBase58, message, signatureBase64) {
  try {
    const pk = new PublicKey(publicKeyBase58);
    const keyDer = Buffer.concat([ED25519_DER_PREFIX, Buffer.from(pk.toBytes())]);
    const pubKeyObj = crypto.createPublicKey({ key: keyDer, format: 'der', type: 'spki' });
    return crypto.verify(
      null,
      Buffer.from(message, 'utf8'),
      pubKeyObj,
      Buffer.from(signatureBase64, 'base64')
    );
  } catch {
    return false;
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { publicKey, signature, message } = req.body || {};

    if (!publicKey || !signature || !message) {
      return res.status(400).json({ error: 'publicKey, signature, and message are required.' });
    }

    if (message !== SIGN_IN_MESSAGE) {
      return res.status(400).json({ error: 'Unexpected sign-in message.' });
    }

    // Validate public key format before verifying
    try { new PublicKey(publicKey); } catch {
      return res.status(400).json({ error: 'Invalid public key.' });
    }

    if (!verifySignature(publicKey, message, signature)) {
      return res.status(401).json({ error: 'Signature verification failed.' });
    }

    const walletId = `wallet:${publicKey}`;
    const abbr = `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
    const token = newToken();
    const tokenHash = hashToken(token);

    const existing = await pool.query(
      'SELECT id FROM users WHERE clerk_user_id = $1 LIMIT 1',
      [walletId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (clerk_user_id, name, wallet_session_token_hash)
         VALUES ($1, $2, $3)`,
        [walletId, abbr, tokenHash]
      );
    } else {
      await pool.query(
        'UPDATE users SET wallet_session_token_hash = $1 WHERE clerk_user_id = $2',
        [tokenHash, walletId]
      );
    }

    res.json({ token, publicKey });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, hashToken, safeEqual };
