import { useState, useEffect, useCallback, useRef, Component, lazy, Suspense } from 'react';
import { ClerkProvider, useSignIn, useSignUp } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
const LogEntry          = lazy(() => import('./pages/LogEntry'));
const Savings           = lazy(() => import('./pages/Savings'));
const ViceManager       = lazy(() => import('./pages/ViceManager'));
const Partners          = lazy(() => import('./pages/Partners'));
const Support           = lazy(() => import('./pages/Support'));
const Wrapped           = lazy(() => import('./pages/Wrapped'));
const CompanionOnboarding = lazy(() => import('./pages/CompanionOnboarding'));
const Badges              = lazy(() => import('./pages/Badges'));
const Settings            = lazy(() => import('./pages/Settings'));
const AdminUsers          = lazy(() => import('./pages/AdminUsers'));
const History             = lazy(() => import('./pages/History'));
import { ViceContext, getViceColor } from './ViceContext';
import { DemoAuthProvider, useApi, useDemoAuth } from './useApi';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const THEMES = ['emerald', 'mint', 'plum', 'noir', 'red', 'orange', 'pink', 'neon'];

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/savings', label: 'Savings' },
  { to: '/vices', label: 'Vices' },
  { to: '/badges', label: '🏅 Badges' },
  { to: '/partners', label: 'Partners' },
  { to: '/history', label: 'History' },
  { to: '/support', label: 'FAQ' },
];

function AccountControl({ collapsed = false }) {
  const { demoUsername, isWallet, walletPublicKey, stopWallet } = useDemoAuth();

  if (isWallet) {
    const abbr = `${walletPublicKey.slice(0, 4)}…${walletPublicKey.slice(-4)}`;
    return (
      <button className="demo-account" type="button" onClick={stopWallet} title="Disconnect wallet">
        <span className="avatar">◈</span>
        {!collapsed && (
          <span className="me-text">
            <span className="me-name">{abbr}</span>
            <span className="me-sub">Phantom wallet</span>
          </span>
        )}
      </button>
    );
  }

  return (
    <NavLink to="/settings" className="demo-account" title="Account settings">
      <span className="avatar">{(demoUsername || '?').slice(0, 2).toUpperCase()}</span>
      {!collapsed && (
        <span className="me-text">
          <span className="me-name">{demoUsername}</span>
          <span style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)' }}>Settings →</span>
        </span>
      )}
    </NavLink>
  );
}

function Sidebar({ theme, setTheme, collapsed, setCollapsed, mobileOpen, onMobileClose }) {
  const { isDemo, stopDemo, isWallet, stopWallet } = useDemoAuth();

  const handleLogout = () => {
    onMobileClose?.();
    if (isWallet) { stopWallet(); return; }
    stopDemo();
  };

  return (
    <aside className={`side${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="side-top">
        <div className="brand">
          <span className={collapsed ? 'brand-letter' : 'brand-letter brand-letter-full'}>V</span>
          {!collapsed && (
            <span className="side-brand-wordmark">
              <span>Vice to Value</span>
              <small>Cut today · grow tomorrow</small>
            </span>
          )}
        </div>
        <button className="side-collapse" onClick={() => setCollapsed(c => !c)} aria-label="Toggle sidebar">
          {collapsed ? '›' : '‹'}
        </button>
        <button className="side-close" onClick={onMobileClose} aria-label="Close menu">×</button>
      </div>

      <nav className="nav">
        {NAV.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={onMobileClose}
          >
            <span className="dot" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="side-bottom">
        <button className="sidebar-logout-btn" type="button" onClick={handleLogout} title="Logout">
          <span className="dot" />
          {!collapsed && <span>Logout</span>}
        </button>
        {!collapsed && (
          <div className="theme-strip">
            {THEMES.map(t => (
              <button
                key={t}
                className={`theme-dot theme-dot-${t}${theme === t ? ' on' : ''}`}
                onClick={() => setTheme(t)}
                title={t[0].toUpperCase() + t.slice(1)}
              />
            ))}
          </div>
        )}
        <NightlyReminder collapsed={collapsed} />
        <div className="me">
          <AccountControl collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

function NightlyReminder({ collapsed = false }) {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const [status, setStatus] = useState('loading');
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');

  const canPush = typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;

  useEffect(() => {
    apiRef.current('/api/users/me')
      .then(user => {
        setEnabled(Boolean(user?.nightly_reminders_enabled));
        setStatus('idle');
      })
      .catch(() => setStatus('idle'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enableReminder = async () => {
    setStatus('loading');
    setMessage('');
    try {
      await apiRef.current('/api/notifications/settings', {
        method: 'PUT',
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          nightly_reminders_enabled: true,
        }),
      });

      setEnabled(true);

      if (!canPush) {
        setStatus('ready');
        setMessage('Nightly zero-day tracking is on. Push reminders are not supported here.');
        return;
      }

      const config = await apiRef.current('/api/notifications/config');
      if (!config.publicKey || !config.pushEnabled) {
        setStatus('ready');
        setMessage('Nightly zero-day tracking is on.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('ready');
        setMessage('Tracking is on. Allow notifications for nightly reminders.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/vt-push-sw.js');
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });

      await apiRef.current('/api/notifications/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      setStatus('ready');
      setMessage('Nightly reminders are on. Missed days will auto-count as 0.');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Could not enable reminders.');
    }
  };

  if (collapsed) return null;

  if (status === 'loading') return null;

  if (enabled && status !== 'error') {
    return (
      <div className="nightly-reminder-card">
        <div>
          <div className="nightly-reminder-title">Nightly tracking</div>
          <p style={{ color: 'var(--money, #5ec48a)', margin: 0, fontSize: 13 }}>
            ✓ Enabled — missed days auto-count as 0
          </p>
        </div>
        {message && <div className="nightly-reminder-msg">{message}</div>}
      </div>
    );
  }

  return (
    <div className="nightly-reminder-card">
      <div>
        <div className="nightly-reminder-title">Nightly tracking</div>
        <p>Get a reminder, and missed days auto-count as 0.</p>
      </div>
      <button className="nightly-reminder-btn" type="button" onClick={enableReminder} disabled={status === 'loading'}>
        {status === 'loading' ? 'Turning on…' : 'Enable'}
      </button>
      {message && <div className={`nightly-reminder-msg ${status === 'error' ? 'error' : ''}`}>{message}</div>}
    </div>
  );
}

function MobileTopBar({ mobileOpen, setMobileOpen }) {
  const { isDemo, demoUsername, isWallet } = useDemoAuth();
  const initial = isWallet ? '◈' : isDemo ? (demoUsername || '?').slice(0, 1).toUpperCase() : null;

  return (
    <header className="mobile-topbar">
      <button
        className="hamburger-btn"
        onClick={() => setMobileOpen(open => !open)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
      >
        <span />
        <span />
        <span />
      </button>

      <div className="mobile-brand">
        <span className="brand-letter brand-letter-full mobile-brand-icon" aria-hidden="true">V</span>
        <span className="mobile-brand-wordmark">Vice to Value</span>
      </div>

      {initial && <div className="mobile-user-pill" aria-hidden="true">{initial}</div>}
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="mbn" aria-label="Tab navigation">
      <NavLink to="/" end className={({ isActive }) => `mbn-tab${isActive ? ' mbn-active' : ''}`}>
        <span className="mbn-icon">⌂</span>
        <span className="mbn-label">Home</span>
      </NavLink>
      <NavLink to="/savings" className={({ isActive }) => `mbn-tab${isActive ? ' mbn-active' : ''}`}>
        <span className="mbn-icon">◈</span>
        <span className="mbn-label">Saves</span>
      </NavLink>
      <NavLink to="/vices" className={({ isActive }) => `mbn-tab${isActive ? ' mbn-active' : ''}`}>
        <span className="mbn-icon">◎</span>
        <span className="mbn-label">Vices</span>
      </NavLink>
      <NavLink to="/badges" className={({ isActive }) => `mbn-tab${isActive ? ' mbn-active' : ''}`}>
        <span className="mbn-icon">🏅</span>
        <span className="mbn-label">Badges</span>
      </NavLink>
      <NavLink to="/partners" className={({ isActive }) => `mbn-tab${isActive ? ' mbn-active' : ''}`}>
        <span className="mbn-icon">🤝</span>
        <span className="mbn-label">Partners</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => `mbn-tab${isActive ? ' mbn-active' : ''}`}>
        <span className="mbn-icon">📋</span>
        <span className="mbn-label">Log</span>
      </NavLink>
    </nav>
  );
}

function AuthenticatedApp() {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [vices, setVices] = useState([]);
  const [viceStats, setViceStats] = useState({});
  const [viceFetchError, setViceFetchError] = useState(false);
  const [activeViceId, setActiveViceId] = useState(null);
  const [theme, setTheme] = useState(() => {
    const t = localStorage.getItem('vt-theme') || 'emerald';
    document.body.className = `theme-${t}`;
    return t;
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vt-sidebar') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companion, setCompanion] = useState(null);
  const [companionLoaded, setCompanionLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    document.body.className = `theme-${theme}${mobileOpen ? ' mobile-menu-open' : ''}`;
    localStorage.setItem('vt-theme', theme);
  }, [theme, mobileOpen]);

  const handleSetTheme = useCallback((t) => {
    // Apply class immediately so readThemeColor() in Savings reads the correct
    // CSS variables during the re-render that setTheme triggers (before the effect fires)
    document.body.className = `theme-${t}${mobileOpen ? ' mobile-menu-open' : ''}`;
    setTheme(t);
  }, [mobileOpen]);

  useEffect(() => {
    localStorage.setItem('vt-sidebar', collapsed ? '1' : '');
  }, [collapsed]);

  const loadVices = useCallback(() => {
    setViceFetchError(false);
    apiRef.current('/api/vices').then(data => {
      const enriched = data.map((v, i) => ({ ...v, color: getViceColor(v, i) }));
      setVices(enriched);
      setActiveViceId(prev => prev ?? (enriched[0]?.id ?? null));
      enriched.forEach(v => {
        apiRef.current(`/api/stats/${v.id}?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`)
          .then(s => setViceStats(st => ({ ...st, [v.id]: s })))
          .catch(() => {});
      });
    }).catch(err => {
      console.error(err);
      setViceFetchError(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadVices(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the browser's local timezone to the server on every login.
  // Uses Intl (OS-level, no GPS permission needed) — accurate and automatic.
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    apiRef.current('/api/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiRef.current('/api/companion').then(data => {
      setCompanion(data);
      setCompanionLoaded(true);
      if (!data.companion_type) setShowOnboarding(true);
    }).catch(() => setCompanionLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnboardingComplete = (data) => {
    setCompanion(prev => ({ ...prev, ...data }));
    setShowOnboarding(false);
    apiRef.current('/api/companion').then(setCompanion).catch(() => {});
  };

  const ctx = { vices, viceStats, activeViceId, setActiveViceId, loadVices, viceFetchError, companion, setCompanion, setShowOnboarding, theme };

  return (
    <ViceContext.Provider value={ctx}>
      <div className={`shell${collapsed ? ' collapsed' : ''}`}>
        <MobileTopBar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        {mobileOpen && <button className="mobile-menu-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
        <Sidebar
          theme={theme}
          setTheme={handleSetTheme}
          collapsed={mobileOpen ? false : collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <Suspense fallback={<div className="main"><div className="skeleton skeleton-card" style={{ height: 200, margin: '32px 0' }} /></div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/log" element={<LogEntry />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/vices" element={<ViceManager />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/support" element={<Support />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/wrapped/:year" element={<Wrapped />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin/users" element={<AdminUsers />} />
          </Routes>
          {companionLoaded && showOnboarding && (
            <CompanionOnboarding
              onComplete={handleOnboardingComplete}
              existingType={companion?.companion_type || null}
            />
          )}
        </Suspense>
        <MobileBottomNav />
      </div>
    </ViceContext.Provider>
  );
}

const PHANTOM_SIGN_MESSAGE = 'Sign in to Vice Spending';

function getPhantomProvider() {
  if (typeof window === 'undefined') return null;
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

function isMobile() {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function WalletSignIn() {
  const clerk = useClerk();
  const { isLoaded, setActive } = useSignIn();
  const { startWallet } = useDemoAuth();
  const [activeWallet, setActiveWallet] = useState('');
  const [error, setError] = useState('');

  const phantomInstalled = Boolean(getPhantomProvider());
  const onMobile = isMobile();

  const walletRedirects = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '/';
    return { redirectUrl: url, signUpContinueUrl: url };
  };

  const connectPhantom = async () => {
    setActiveWallet('phantom');
    setError('');
    try {
      const provider = getPhantomProvider();
      if (!provider) {
        window.open('https://phantom.app', '_blank');
        return;
      }
      const response = await provider.connect();
      const publicKey = response.publicKey.toString();
      const messageBytes = new TextEncoder().encode(PHANTOM_SIGN_MESSAGE);
      const { signature } = await provider.signMessage(messageBytes, 'utf8');
      // Convert Uint8Array → base64 (browser-safe, no Node Buffer needed)
      const signatureBase64 = btoa(Array.from(new Uint8Array(signature), b => String.fromCharCode(b)).join(''));

      const res = await fetch('/api/auth/phantom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey, signature: signatureBase64, message: PHANTOM_SIGN_MESSAGE }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

      startWallet(publicKey, body.token);
    } catch (err) {
      setError(err.message || 'Could not connect Phantom. Make sure the extension is unlocked and try again.');
    } finally {
      setActiveWallet('');
    }
  };

  const clerkWallets = [
    { key: 'metamask', label: 'MetaMask', sub: 'Ethereum wallet', icon: '🦊', action: () => clerk.authenticateWithMetamask(walletRedirects()) },
    { key: 'base',     label: 'Base Wallet', sub: 'Coinbase wallet', icon: '◎', action: () => clerk.authenticateWithBase(walletRedirects()) },
  ];

  const connectClerk = async wallet => {
    if (!isLoaded) return;
    setError('');
    setActiveWallet(wallet.key);
    try {
      const result = await wallet.action();
      if (result?.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        return;
      }
      if (result?.status && result.status !== 'complete') {
        setError('Wallet connected, but sign-in needs one more step. Try username or email sign-in below.');
      }
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err.message || `Could not connect ${wallet.label}.`);
    } finally {
      setActiveWallet('');
    }
  };

  return (
    <div className="wallet-login-card">
      <div className="wallet-login-head">
        <div>
          <div className="wallet-login-title">Connect your wallet</div>
          <p className="wallet-login-copy">Use Phantom to sign in with your Solana wallet, or connect MetaMask / Base for Ethereum.</p>
        </div>
      </div>
      <div className="wallet-button-grid">
        {/* Phantom — custom sign-in flow */}
        {phantomInstalled ? (
          <button
            type="button"
            className="wallet-connect-btn"
            disabled={activeWallet === 'phantom'}
            onClick={connectPhantom}
          >
            <span className="wallet-icon wallet-icon-phantom">◈</span>
            <span>
              <span className="wallet-name">{activeWallet === 'phantom' ? 'Connecting…' : 'Phantom'}</span>
              <span className="wallet-sub">Solana wallet</span>
            </span>
          </button>
        ) : onMobile ? (
          <a
            href={`https://phantom.app/ul/browse/${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '/')}`}
            className="wallet-connect-btn"
            style={{ textDecoration: 'none' }}
          >
            <span className="wallet-icon wallet-icon-phantom">◈</span>
            <span>
              <span className="wallet-name">Open in Phantom</span>
              <span className="wallet-sub">Opens this page in Phantom's browser</span>
            </span>
          </a>
        ) : (
          <a
            href="https://phantom.app"
            target="_blank"
            rel="noopener noreferrer"
            className="wallet-connect-btn"
            style={{ textDecoration: 'none' }}
          >
            <span className="wallet-icon wallet-icon-phantom">◈</span>
            <span>
              <span className="wallet-name">Install Phantom</span>
              <span className="wallet-sub">Get the browser extension</span>
            </span>
          </a>
        )}

        {/* MetaMask + Base — via Clerk */}
        {clerkWallets.map(wallet => (
          <button
            key={wallet.key}
            type="button"
            className="wallet-connect-btn"
            disabled={!isLoaded || activeWallet === wallet.key}
            onClick={() => connectClerk(wallet)}
          >
            <span className={`wallet-icon wallet-icon-${wallet.key}`}>{wallet.icon}</span>
            <span>
              <span className="wallet-name">{activeWallet === wallet.key ? 'Connecting…' : wallet.label}</span>
              <span className="wallet-sub">{wallet.sub}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <div className="form-error wallet-error">{error}</div>}
    </div>
  );
}

function EmailAuth() {
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const authReady = mode === 'signIn' ? signInLoaded : signUpLoaded;

  const switchMode = nextMode => {
    setMode(nextMode);
    setError('');
    setCode('');
    setPendingVerification(false);
  };

  const messageFromError = err => err?.errors?.[0]?.longMessage
    || err?.errors?.[0]?.message
    || err.message
    || 'Something went wrong. Please try again.';

  const handleSubmit = async e => {
    e.preventDefault();
    if (!authReady) return;
    setError('');
    setLoading(true);

    try {
      if (mode === 'signIn') {
        const result = await signIn.create({ identifier: email.trim(), password });
        if (result.status === 'complete' && result.createdSessionId) {
          await setSignInActive({ session: result.createdSessionId });
          return;
        }
        setError('Email sign-in needs another step. Check that email/password sign-in is enabled in Clerk.');
        return;
      }

      if (pendingVerification) {
        const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status === 'complete' && result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
          return;
        }
        setError('That verification code did not finish sign-up. Try again.');
        return;
      }

      const result = await signUp.create({ emailAddress: email.trim(), password });
      if (result.status === 'complete' && result.createdSessionId) {
        await setSignUpActive({ session: result.createdSessionId });
        return;
      }
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-login-card email-login-card">
      <div className="demo-card-top">
        <div>
          <div className="demo-login-title">{mode === 'signIn' ? 'Sign in with email' : 'Create an account'}</div>
          <p className="demo-login-copy">
            {pendingVerification
              ? 'Enter the verification code sent to your email.'
              : 'Use email and password if you do not want to connect a wallet.'}
          </p>
        </div>
        <span className="demo-badge">Email</span>
      </div>
      <form onSubmit={handleSubmit} className="demo-login-form">
        {!pendingVerification ? (
          <>
            <label className="form-label" htmlFor="email-auth-email">Email</label>
            <input
              id="email-auth-email"
              className="form-input"
              type="email"
              value={email}
              placeholder="you@example.com"
              autoComplete="email"
              required
              onChange={e => { setEmail(e.target.value); setError(''); }}
            />
            <label className="form-label" htmlFor="email-auth-password">Password</label>
            <input
              id="email-auth-password"
              className="form-input"
              type="password"
              value={password}
              placeholder="Password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              onChange={e => { setPassword(e.target.value); setError(''); }}
            />
          </>
        ) : (
          <>
            <label className="form-label" htmlFor="email-auth-code">Verification code</label>
            <input
              id="email-auth-code"
              className="form-input"
              value={code}
              placeholder="123456"
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              onChange={e => { setCode(e.target.value); setError(''); }}
            />
          </>
        )}
        <button className="btn btn-primary" type="submit" disabled={loading || !authReady}>
          {loading ? 'Working…' : pendingVerification ? 'Verify email' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
        {error && <div className="form-error">{error}</div>}
      </form>
      {!pendingVerification && (
        <button
          className="clerk-link email-auth-switch"
          type="button"
          onClick={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        >
          {mode === 'signIn' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      )}
    </div>
  );
}

// ── Password sign-in form ────────────────────────────
function PasswordLogin({ onForgot, onMigrate, onSwitchToSignUp }) {
  const { signIn } = useDemoAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn({ username, password });
    } catch (err) {
      if (err.message === 'migration_required') {
        onMigrate(username);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-login-card">
      <div className="demo-card-top">
        <div>
          <div className="demo-login-title">Sign in</div>
          <p className="demo-login-copy">Use your username and password.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="demo-login-form">
        <label className="form-label" htmlFor="pl-username">Username</label>
        <input id="pl-username" className="form-input" value={username} placeholder="your-username"
          autoComplete="username" required minLength={3}
          onChange={e => { setUsername(e.target.value); setError(''); }} />
        <label className="form-label" htmlFor="pl-password">Password</label>
        <input id="pl-password" className="form-input" type="password" value={password}
          placeholder="••••••••" autoComplete="current-password" required
          onChange={e => { setPassword(e.target.value); setError(''); }} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <div className="form-error">{error}</div>}
      </form>
      <div className="auth-form-footer">
        <button className="clerk-link" type="button" onClick={onForgot}>Forgot password?</button>
        <button className="clerk-link" type="button" onClick={onSwitchToSignUp}>No account? Sign up →</button>
      </div>
    </div>
  );
}

// ── Sign-up form ──────────────────────────────────────
function SignupForm({ onSwitchToSignIn }) {
  const { signUp } = useDemoAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp({ username, password, email: email.trim() || undefined });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-login-card">
      <div className="demo-card-top">
        <div>
          <div className="demo-login-title">Create account</div>
          <p className="demo-login-copy">Pick a username and password. Email is optional but needed for password recovery.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="demo-login-form">
        <label className="form-label" htmlFor="su-username">Username</label>
        <input id="su-username" className="form-input" value={username} placeholder="your-username"
          autoComplete="username" required minLength={3}
          onChange={e => { setUsername(e.target.value); setError(''); }} />
        <label className="form-label" htmlFor="su-email">Email <span className="form-hint">— optional, for password recovery</span></label>
        <input id="su-email" className="form-input" type="email" value={email} placeholder="you@example.com"
          autoComplete="email"
          onChange={e => { setEmail(e.target.value); setError(''); }} />
        <label className="form-label" htmlFor="su-password">Password <span className="form-hint">— 8+ characters</span></label>
        <input id="su-password" className="form-input" type="password" value={password}
          placeholder="••••••••" autoComplete="new-password" required minLength={8}
          onChange={e => { setPassword(e.target.value); setError(''); }} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create account'}
        </button>
        {error && <div className="form-error">{error}</div>}
      </form>
      <button className="clerk-link email-auth-switch" type="button" onClick={onSwitchToSignIn}>
        Already have an account? Sign in →
      </button>
    </div>
  );
}

// ── Forgot password form ──────────────────────────────
function ForgotPasswordForm({ onBack, onSent }) {
  const { requestMagicLink } = useDemoAuth();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = await requestMagicLink({ identifier: identifier.trim(), purpose: 'reset' });
      onSent(body.message || 'Check your email for a reset link.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-login-card">
      <div className="demo-card-top">
        <div>
          <div className="demo-login-title">Reset password</div>
          <p className="demo-login-copy">Enter your username or email — we'll send a reset link.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="demo-login-form">
        <label className="form-label" htmlFor="fp-identifier">Username or email</label>
        <input id="fp-identifier" className="form-input" value={identifier} placeholder="username or you@example.com"
          autoComplete="username email" required
          onChange={e => { setIdentifier(e.target.value); setError(''); }} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
        {error && <div className="form-error">{error}</div>}
      </form>
      <button className="clerk-link" type="button" onClick={onBack}>← Back to sign in</button>
    </div>
  );
}

// ── Migration form (old-token users setting a password) ──
function MigrationForm({ username: initialUsername, onBack }) {
  const { migrate, requestMagicLink } = useDemoAuth();
  const [username] = useState(initialUsername || '');
  const [oldToken, setOldToken] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // recovery: null | 'sending' | 'sent' | 'no_email'
  const [recovery, setRecovery] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await migrate({ username, oldToken: oldToken.trim(), newPassword: password, email: email.trim() || undefined });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNoToken = async () => {
    setRecovery('sending');
    try {
      await requestMagicLink({ identifier: username, purpose: 'reset' });
      setRecovery('sent');
    } catch (err) {
      setRecovery(err.code === 'no_email' ? 'no_email' : null);
      if (err.code !== 'no_email') setError(err.message);
    }
  };

  if (recovery === 'sent') {
    return (
      <div className="demo-login-card">
        <div className="demo-login-title">Check your email</div>
        <p className="demo-login-copy" style={{ marginTop: 8 }}>
          We sent a password reset link to the email on file for <strong>{username}</strong>. It expires in 15 minutes.
        </p>
        <button className="clerk-link" type="button" style={{ marginTop: 16 }} onClick={onBack}>← Back to sign in</button>
      </div>
    );
  }

  return (
    <div className="demo-login-card">
      <div className="demo-card-top">
        <div>
          <div className="demo-login-title">Set a password</div>
          <p className="demo-login-copy">Your account uses the old access token system. Enter your token once to migrate to password auth.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="demo-login-form">
        <label className="form-label" htmlFor="mf-token">Access token <span className="form-hint">— your vt_xxx token</span></label>
        <input id="mf-token" className="form-input" value={oldToken} placeholder="vt_xxxxxxxx…"
          autoComplete="off" required
          onChange={e => { setOldToken(e.target.value); setError(''); }} />
        <label className="form-label" htmlFor="mf-email">Email <span className="form-hint">— recommended for future recovery</span></label>
        <input id="mf-email" className="form-input" type="email" value={email} placeholder="you@example.com"
          autoComplete="email"
          onChange={e => { setEmail(e.target.value); setError(''); }} />
        <label className="form-label" htmlFor="mf-password">New password <span className="form-hint">— 8+ characters</span></label>
        <input id="mf-password" className="form-input" type="password" value={password}
          placeholder="••••••••" autoComplete="new-password" required minLength={8}
          onChange={e => { setPassword(e.target.value); setError(''); }} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Migrating…' : 'Set password & sign in'}
        </button>
        {error && <div className="form-error">{error}</div>}
      </form>

      {recovery === 'no_email' ? (
        <div className="form-hint" style={{ marginTop: 12, lineHeight: 1.5 }}>
          No email is on file for this account. Contact support to regain access.
        </div>
      ) : (
        <button
          className="clerk-link"
          type="button"
          disabled={recovery === 'sending'}
          style={{ marginTop: 8 }}
          onClick={handleNoToken}
        >
          {recovery === 'sending' ? 'Sending reset link…' : "I don't have my token"}
        </button>
      )}

      <button className="clerk-link" type="button" onClick={onBack}>← Back</button>
    </div>
  );
}

// ── Set new password (after clicking magic reset link) ──
function SetPasswordForm({ resetToken, username }) {
  const { resetPassword } = useDemoAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword({ resetToken, newPassword: password });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-login-card">
      <div className="demo-card-top">
        <div>
          <div className="demo-login-title">New password</div>
          <p className="demo-login-copy">Set a new password for <strong>{username}</strong>.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="demo-login-form">
        <label className="form-label" htmlFor="spf-password">New password <span className="form-hint">— 8+ characters</span></label>
        <input id="spf-password" className="form-input" type="password" value={password}
          placeholder="••••••••" autoComplete="new-password" required minLength={8}
          onChange={e => { setPassword(e.target.value); setError(''); }} />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Set password & sign in'}
        </button>
        {error && <div className="form-error">{error}</div>}
      </form>
    </div>
  );
}

function PhoneAuth() {
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const [mode, setMode] = useState('signIn');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const authReady = mode === 'signIn' ? signInLoaded : signUpLoaded;

  const messageFromError = err =>
    err?.errors?.[0]?.longMessage ||
    err?.errors?.[0]?.message ||
    err.message ||
    'Something went wrong. Please try again.';

  const toE164 = raw => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`;
  };

  const switchMode = nextMode => {
    setMode(nextMode);
    setError('');
    setCode('');
    setPendingVerification(false);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!authReady) return;
    setError('');
    setLoading(true);
    try {
      if (pendingVerification) {
        if (mode === 'signIn') {
          const result = await signIn.attemptFirstFactor({ strategy: 'phone_code', code: code.trim() });
          if (result.status === 'complete' && result.createdSessionId) {
            await setSignInActive({ session: result.createdSessionId });
            return;
          }
          setError('Verification did not complete. Try again.');
        } else {
          const result = await signUp.attemptPhoneNumberVerification({ code: code.trim() });
          if (result.status === 'complete' && result.createdSessionId) {
            await setSignUpActive({ session: result.createdSessionId });
            return;
          }
          setError('Verification did not complete. Try again.');
        }
        return;
      }

      const e164 = toE164(phone);
      if (mode === 'signIn') {
        const result = await signIn.create({ identifier: e164 });
        const phoneFactor = result.supportedFirstFactors?.find(f => f.strategy === 'phone_code');
        if (!phoneFactor) {
          setError('Phone sign-in is not enabled for this account. Enable "Phone number" under User & Authentication → Sign-in methods in your Clerk dashboard, or use email sign-in below.');
          return;
        }
        await signIn.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId: phoneFactor.phoneNumberId });
        setPendingVerification(true);
      } else {
        await signUp.create({ phoneNumber: e164 });
        await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
        setPendingVerification(true);
      }
    } catch (err) {
      const msg = messageFromError(err);
      if (
        msg.toLowerCase().includes('phone') ||
        msg.toLowerCase().includes('sms') ||
        msg.toLowerCase().includes('not allowed') ||
        msg.toLowerCase().includes('not enabled')
      ) {
        setError(`${msg} — To fix this, go to Clerk Dashboard → User & Authentication → Sign-in methods and enable "Phone number".`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-login-card email-login-card">
      <div className="demo-card-top">
        <div>
          <div className="demo-login-title">{mode === 'signIn' ? 'Sign in with phone' : 'Sign up with phone'}</div>
          <p className="demo-login-copy">
            {pendingVerification
              ? `Enter the SMS code sent to ${phone}.`
              : 'We\'ll send a one-time code to your mobile number.'}
          </p>
        </div>
        <span className="demo-badge">SMS</span>
      </div>
      <form onSubmit={handleSubmit} className="demo-login-form">
        {!pendingVerification ? (
          <>
            <label className="form-label" htmlFor="phone-auth-number">Phone number</label>
            <input
              id="phone-auth-number"
              className="form-input"
              type="tel"
              value={phone}
              placeholder="+1 (555) 000-0000"
              autoComplete="tel"
              required
              onChange={e => { setPhone(e.target.value); setError(''); }}
            />
          </>
        ) : (
          <>
            <label className="form-label" htmlFor="phone-auth-code">SMS code</label>
            <input
              id="phone-auth-code"
              className="form-input"
              value={code}
              placeholder="123456"
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              onChange={e => { setCode(e.target.value); setError(''); }}
            />
            <button
              type="button"
              className="clerk-link"
              onClick={() => { setCode(''); setPendingVerification(false); setError(''); }}
              style={{ marginBottom: 4 }}
            >
              ← Change phone number
            </button>
          </>
        )}
        <button className="btn btn-primary" type="submit" disabled={loading || !authReady}>
          {loading
            ? 'Working…'
            : pendingVerification
              ? 'Verify SMS code'
              : 'Send code'}
        </button>
        {error && <div className="form-error">{error}</div>}
      </form>
      {!pendingVerification && (
        <button
          className="clerk-link email-auth-switch"
          type="button"
          onClick={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        >
          {mode === 'signIn' ? 'Need an account? Sign up with phone' : 'Already have an account? Sign in'}
        </button>
      )}
    </div>
  );
}

function AuthDrawer({ mode, onClose, initialView }) {
  // view: 'signIn' | 'signUp' | 'forgot' | 'migrate' | 'sent' | 'more'
  const [view, setView]           = useState(initialView || (mode === 'signIn' ? 'signIn' : 'signUp'));
  const [migrateUsername, setMigrateUsername] = useState('');
  const [sentMessage, setSentMessage]         = useState('');
  const [moreExpanded, setMoreExpanded]       = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const drawerTitles = {
    signIn: 'Welcome back',
    signUp: 'Create account',
    forgot: 'Reset password',
    migrate: 'Set a password',
    sent: 'Check your email',
  };

  const title = drawerTitles[view] || 'Sign in';

  const handleMigrate = (username) => {
    setMigrateUsername(username);
    setView('migrate');
  };

  const handleSent = (msg) => {
    setSentMessage(msg);
    setView('sent');
  };

  return (
    <div className="auth-drawer-root" role="dialog" aria-modal="true">
      <div className="auth-drawer-backdrop" onClick={onClose} />
      <div className="auth-drawer-sheet">
        <div className="auth-drawer-handle" aria-hidden="true" />
        <div className="auth-drawer-head">
          <div className="auth-drawer-title">{title}</div>
          <button className="auth-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="auth-drawer-body">
          {view === 'signIn' && (
            <PasswordLogin
              onForgot={() => setView('forgot')}
              onMigrate={handleMigrate}
              onSwitchToSignUp={() => setView('signUp')}
            />
          )}
          {view === 'signUp' && (
            <SignupForm onSwitchToSignIn={() => setView('signIn')} />
          )}
          {view === 'forgot' && (
            <ForgotPasswordForm
              onBack={() => setView('signIn')}
              onSent={handleSent}
            />
          )}
          {view === 'migrate' && (
            <MigrationForm
              username={migrateUsername}
              onBack={() => setView('signIn')}
            />
          )}
          {view === 'sent' && (
            <div className="demo-login-card">
              <div className="demo-login-title">Email sent</div>
              <p className="demo-login-copy" style={{ marginTop: 8 }}>{sentMessage}</p>
              <button className="clerk-link" type="button" style={{ marginTop: 16 }} onClick={() => setView('signIn')}>
                ← Back to sign in
              </button>
            </div>
          )}

          {/* Magic link sign-in option */}
          {(view === 'signIn' || view === 'signUp') && (
            <div className="auth-drawer-magic-row">
              <button className="clerk-link" type="button" onClick={() => setView('forgot')}>
                or sign in with email link
              </button>
            </div>
          )}

          {/* More options: wallets + Clerk */}
          <div className="auth-drawer-more-wrap">
            <button className="auth-drawer-more-toggle" type="button" onClick={() => setMoreExpanded(e => !e)}>
              {moreExpanded ? '▲ Fewer options' : '▾ More sign-in options'}
            </button>
            {moreExpanded && (
              <>
                <div className="auth-divider"><span>or connect a wallet</span></div>
                <WalletSignIn />
                <div className="auth-divider"><span>or sign in with email</span></div>
                <div className="clerk-frame"><EmailAuth /></div>
                <div className="auth-divider"><span>or sign in with phone</span></div>
                <div className="clerk-frame"><PhoneAuth /></div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignedOutContent() {
  const { isDemo, isWallet, startDemo, verifyMagicToken } = useDemoAuth();
  const [drawer, setDrawer]               = useState(null); // null | 'signIn' | 'signUp'
  const [demoLoading, setDemoLoading]     = useState(false);
  // Initialise synchronously from the URL so we don't flash <AuthenticatedApp />
  // on the first render when a ?magic= param is present.
  // null | 'verifying' | { status:'reset', resetToken, username } | { status:'error', msg }
  const [magicState, setMagicState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('magic') ? 'verifying' : null;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Process magic links before the isDemo guard — reset links must work even
    // when the user already has an active session in this browser.
    const magic = params.get('magic');
    if (magic) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('magic');
      window.history.replaceState({}, '', clean.toString());
      // magicState is already 'verifying' from the useState initializer above
      verifyMagicToken(magic)
        .then(body => {
          if (body.purpose === 'reset') {
            setMagicState({ status: 'reset', resetToken: body.resetToken, username: body.username });
          } else {
            // Login purpose: verifyMagicToken already stored the session — clear
            // magic state so the isDemo guard below shows <AuthenticatedApp />.
            setMagicState(null);
          }
        })
        .catch(err => setMagicState({ status: 'error', msg: err.message }));
      return;
    }

    if (isDemo || isWallet) return;

    // Legacy device-transfer link (?_vtuser=&_vttoken=) — still supported during migration
    const vtuser = params.get('_vtuser');
    const vttoken = params.get('_vttoken');
    if (vtuser && vttoken) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('_vtuser');
      clean.searchParams.delete('_vttoken');
      window.history.replaceState({}, '', clean.toString());
      startDemo(vtuser, vttoken).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Already authenticated with no magic link in progress — go straight to the app
  if ((isDemo || isWallet) && !magicState) return <AuthenticatedApp />;

  // Magic link verifying / result overlay
  if (magicState === 'verifying') {
    return (
      <div className="landing-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(232,239,224,0.6)', fontSize: 15 }}>Verifying magic link…</div>
      </div>
    );
  }
  if (magicState?.status === 'error') {
    return (
      <div className="landing-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#f4f7ee', fontSize: 18, marginBottom: 8 }}>Link expired or invalid</div>
          <div style={{ color: 'rgba(232,239,224,0.55)', marginBottom: 20 }}>{magicState.msg}</div>
          <button className="btn landing-btn-gold" onClick={() => { setMagicState(null); setDrawer('signIn'); }}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }
  if (magicState?.status === 'reset') {
    return (
      <div className="landing-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#eef4e8', borderRadius: 18, padding: '28px 28px', width: '100%', maxWidth: 440 }}>
          <SetPasswordForm resetToken={magicState.resetToken} username={magicState.username} />
        </div>
      </div>
    );
  }

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await startDemo('demo-' + Math.random().toString(36).slice(2, 7), '');
    } catch {}
    setDemoLoading(false);
  };

  return (
    <div className="landing-page">
      <div className="auth-bg auth-bg-one" />
      <div className="auth-bg auth-bg-two" />

      {/* Hero / left column */}
      <section className="landing-hero" aria-label="Vice to Value">
        <div className="landing-logo-row">
          <span className="landing-logo-wordmark">Vice to Value</span>
        </div>

        <div className="landing-hero-copy">
          <div className="auth-kicker">Cut Today. Grow Tomorrow.</div>
          <h1>See what your vices really cost — then turn that money into goals.</h1>
          <p>Track spending by category, savings projections, streaks, and opportunity costs — all in one polished dashboard.</p>
        </div>

        {/* Preview cards: savings chart + streak */}
        <div className="landing-preview-pair">
          <div className="lp-card lp-card-chart">
            <div className="lp-chart-head">
              <span>Monthly savings</span>
              <strong>$842</strong>
            </div>
            <div className="lp-chart-bars" aria-hidden="true">
              {[38, 54, 71, 48, 86, 64, 92].map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="lp-chart-foot">
              <span>7-day avg</span>
              <b>$28.40</b>
            </div>
          </div>
          <div className="lp-card lp-card-streak">
            <div className="lp-streak-num">12</div>
            <div className="lp-streak-label">day streak</div>
            <div className="lp-streak-pips" aria-hidden="true">
              {[...Array(7)].map((_, i) => (
                <div key={i} className={`lp-pip${i < 5 ? ' lp-pip-on' : ''}`} />
              ))}
            </div>
            <div className="lp-streak-best">Best: 18 days</div>
          </div>
        </div>

        <div className="landing-actions">
          <button type="button" className="btn btn-lg landing-btn-gold" onClick={() => setDrawer('signIn')}>
            Sign In
          </button>
          <button type="button" className="btn btn-lg landing-btn-ghost" onClick={() => setDrawer('signUp')}>
            Get Started
          </button>
        </div>

        <button type="button" className="landing-demo-link" onClick={handleDemo} disabled={demoLoading}>
          {demoLoading ? 'Starting demo…' : 'Continue as Demo'}
        </button>
      </section>

      {/* Desktop-only app mockup (right column) */}
      <section className="landing-visual" aria-hidden="true">
        <div className="lv-frame">
          <div className="lv-topbar">
            <div className="lv-dots"><span /><span /><span /></div>
            <div className="lv-topbar-title">Vice to Value</div>
          </div>
          <div className="lv-body">
            <div className="lv-stats-row">
              {[['Today','$4.20'],['Week','$28.40'],['Month','$112'],['Saved','$842']].map(([lbl,val],i) => (
                <div key={lbl} className={`lv-stat${i === 3 ? ' lv-stat-green' : ''}`}>
                  <span className="lv-stat-label">{lbl}</span>
                  <span className="lv-stat-val">{val}</span>
                </div>
              ))}
            </div>

            <div className="lv-section-label">Spending — last 7 days</div>
            <div className="lv-chart">
              {[40,65,28,80,52,90,38].map((h,i) => (
                <div key={i} className="lv-bar-col">
                  <div className="lv-bar" style={{ height: `${h}%` }} />
                  <span>{['M','T','W','T','F','S','S'][i]}</span>
                </div>
              ))}
            </div>

            <div className="lv-cards-row">
              <div className="lv-mini-card">
                <div className="lv-mini-head"><span>Streak</span><b>12 days</b></div>
                <div className="lv-mini-pips">
                  {[...Array(7)].map((_,i) => (
                    <div key={i} className={`lv-mini-pip${i < 5 ? ' on' : ''}`} />
                  ))}
                </div>
              </div>
              <div className="lv-mini-card">
                <div className="lv-mini-head"><span>Level</span><b>Lvl 4</b></div>
                <div className="lv-xp-bar"><div className="lv-xp-fill" style={{ width: '67%' }} /></div>
                <div className="lv-mini-sub">340 / 500 XP</div>
              </div>
            </div>

            <div className="lv-goal-card">
              <div className="lv-goal-head"><span>Gaming PC</span><b>67%</b></div>
              <div className="lv-goal-track"><div className="lv-goal-fill" style={{ width: '67%' }} /></div>
              <div className="lv-goal-sub">$560 saved of $840</div>
            </div>
          </div>
        </div>
      </section>

      {drawer && (
        <AuthDrawer mode={drawer} onClose={() => setDrawer(null)} />
      )}
    </div>
  );
}

// Routes based on our own auth state — no Clerk routing primitives
function AppRouter() {
  const { isDemo, isWallet } = useDemoAuth();
  // If a magic link is in the URL, always let SignedOutContent process it first —
  // even when already authenticated. Reset links must work from an active session.
  const hasMagic = new URLSearchParams(window.location.search).has('magic');
  if ((isDemo || isWallet) && !hasMagic) return <AuthenticatedApp />;
  return <SignedOutContent />;
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('App render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#f66', background: '#111', minHeight: '100vh', whiteSpace: 'pre-wrap' }}>
          <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Something went wrong</h2>
          <p style={{ color: '#aaa', marginBottom: '1rem' }}>Open the browser console for more detail.</p>
          <pre style={{ color: '#f99', fontSize: '13px' }}>{String(this.state.error)}</pre>
          <button
            style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppCore() {
  return (
    <AppErrorBoundary>
      <DemoAuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </DemoAuthProvider>
    </AppErrorBoundary>
  );
}

export default function App() {
  // Wrap with ClerkProvider when key is available — enables MetaMask/Base wallet sign-in
  // and legacy Clerk sessions. Primary auth (username+password, magic link) works without it.
  if (PUBLISHABLE_KEY) {
    return (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <AppCore />
      </ClerkProvider>
    );
  }
  return <AppCore />;
}
