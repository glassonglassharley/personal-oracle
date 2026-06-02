import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';

const DemoAuthContext = createContext(null);

const SESSION_KEY = 'vt-session';
const LEGACY_KEY  = 'vt-username-auth';
const WALLET_KEY  = 'vtv_wallet_session';

export function sanitizeDemoUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.jwt && p?.username) return { jwt: p.jwt, username: p.username, needsPasswordSetup: p.needsPasswordSetup || false };
    }
  } catch {}
  return null;
}

function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const username = sanitizeDemoUsername(p?.username);
      const token = String(p?.token || '').trim();
      if (username && token) return { username, token };
    }
  } catch {}
  return null;
}

function readWallet() {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const publicKey = String(p?.publicKey || '').trim();
      const token = String(p?.token || '').trim();
      if (publicKey && token) return { publicKey, token };
    }
  } catch {}
  return null;
}

function storeSession(jwt, username, needsPasswordSetup = false) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ jwt, username, needsPasswordSetup }));
}

export function DemoAuthProvider({ children }) {
  const [session, setSession]           = useState(readSession);
  const [walletAccount, setWalletAccount] = useState(readWallet);
  const [migrating, setMigrating]       = useState(false);

  // Silently exchange legacy vt_xxx token for a JWT on first load
  useEffect(() => {
    const legacy = readLegacy();
    if (!legacy || session) return;

    setMigrating(true);
    fetch('/api/auth/token-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: legacy.username, token: legacy.token }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(body => {
        if (body.jwt) {
          storeSession(body.jwt, body.username, body.needsPasswordSetup);
          localStorage.removeItem(LEGACY_KEY);
          setSession({ jwt: body.jwt, username: body.username, needsPasswordSetup: body.needsPasswordSetup });
        }
      })
      .catch(() => localStorage.removeItem(LEGACY_KEY))
      .finally(() => setMigrating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({
    // ── Session state ──────────────────────────────
    isDemo: Boolean(session?.jwt),
    demoUsername: session?.username || '',
    usernameToken: '',                      // no longer exposed — no more tokens in UI
    needsPasswordSetup: session?.needsPasswordSetup || false,
    isMigrating: migrating,

    // ── New auth methods ───────────────────────────
    async signIn({ username, password }) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
      storeSession(body.jwt, body.username);
      setSession({ jwt: body.jwt, username: body.username, needsPasswordSetup: false });
      return body;
    },

    async signUp({ username, password, email }) {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      storeSession(body.jwt, body.username);
      setSession({ jwt: body.jwt, username: body.username, needsPasswordSetup: false });
      return body;
    },

    async migrate({ username, oldToken, newPassword, email }) {
      const res = await fetch('/api/auth/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, oldToken, newPassword, email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      storeSession(body.jwt, body.username);
      setSession({ jwt: body.jwt, username: body.username, needsPasswordSetup: false });
      return body;
    },

    async requestMagicLink({ identifier, purpose = 'login' }) {
      const res = await fetch('/api/auth/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, purpose }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.message || body.error || `HTTP ${res.status}`), { code: body.error });
      return body;
    },

    async verifyMagicToken(token) {
      const res = await fetch(`/api/auth/magic/verify?t=${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.purpose === 'login' && body.jwt) {
        storeSession(body.jwt, body.username);
        setSession({ jwt: body.jwt, username: body.username, needsPasswordSetup: false });
      }
      return body; // caller handles 'reset' purpose
    },

    async resetPassword({ resetToken, newPassword }) {
      const res = await fetch('/api/auth/magic/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      storeSession(body.jwt, body.username);
      setSession({ jwt: body.jwt, username: body.username, needsPasswordSetup: false });
      return body;
    },

    // ── Legacy compat: demo/quick-start ───────────
    async startDemo(username) {
      const clean = sanitizeDemoUsername(username);
      if (!clean) throw new Error('Enter a username.');
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      storeSession(body.jwt, body.username);
      setSession({ jwt: body.jwt, username: body.username, needsPasswordSetup: false });
      return body;
    },

    stopDemo() {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_KEY);
      setSession(null);
    },

    forceLogout() {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(WALLET_KEY);
      setSession(null);
      setWalletAccount(null);
    },

    // ── Wallet auth (unchanged) ────────────────────
    isWallet: Boolean(walletAccount?.publicKey && walletAccount?.token),
    walletPublicKey: walletAccount?.publicKey || '',
    walletToken: walletAccount?.token || '',
    startWallet(publicKey, token) {
      const next = { publicKey, token };
      localStorage.setItem(WALLET_KEY, JSON.stringify(next));
      setWalletAccount(next);
    },
    stopWallet() {
      localStorage.removeItem(WALLET_KEY);
      setWalletAccount(null);
    },
  }), [session, walletAccount, migrating]);

  return createElement(DemoAuthContext.Provider, { value }, children);
}

export function useDemoAuth() {
  const ctx = useContext(DemoAuthContext);
  if (!ctx) throw new Error('useDemoAuth must be used inside DemoAuthProvider');
  return ctx;
}

export function useApi() {
  const ctx = useContext(DemoAuthContext);
  const { isWallet, walletPublicKey, walletToken } = ctx;

  return async (url, options = {}) => {
    const stored = readSession();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    if (isWallet && walletPublicKey && walletToken) {
      headers['X-Wallet-Address'] = walletPublicKey;
      headers['X-Wallet-Token']   = walletToken;
    } else if (stored?.jwt) {
      headers['Authorization'] = `Bearer ${stored.jwt}`;
    }

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      if (res.status === 401) {
        // Session expired or invalid — force logout so the auth gate shows the login screen
        ctx.forceLogout?.();
      }
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  };
}
