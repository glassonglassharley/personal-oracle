import { useState, useEffect, useCallback, useRef, Component, lazy, Suspense } from 'react';
import { ClerkProvider, SignedIn, SignedOut, UserButton, useClerk, useSignIn, useSignUp, useUser } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
const LogEntry          = lazy(() => import('./pages/LogEntry'));
const Savings           = lazy(() => import('./pages/Savings'));
const ViceManager       = lazy(() => import('./pages/ViceManager'));
const Partners          = lazy(() => import('./pages/Partners'));
const Support           = lazy(() => import('./pages/Support'));
const Wrapped           = lazy(() => import('./pages/Wrapped'));
const CompanionOnboarding = lazy(() => import('./pages/CompanionOnboarding'));
const Badges              = lazy(() => import('./pages/Badges'));
import { ViceContext, getViceColor } from './ViceContext';
import { DemoAuthProvider, useApi, useDemoAuth } from './useApi';
import { VtvLogo, VtvMark } from './Logo';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const THEMES = ['emerald', 'mint', 'plum', 'noir', 'red', 'orange', 'pink', 'neon'];

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/savings', label: 'Savings' },
  { to: '/vices', label: 'Vices' },
  { to: '/badges', label: '🏅 Badges' },
  { to: '/partners', label: 'Partners' },
  { to: '/support', label: 'FAQ' },
];

function AccountControl({ collapsed = false }) {
  const { isDemo, demoUsername, stopDemo, isWallet, walletPublicKey, stopWallet } = useDemoAuth();
  const { user } = useUser();
  const accountName = user?.username
    || user?.fullName
    || user?.primaryEmailAddress?.emailAddress?.split('@')[0]
    || 'Account';

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

  if (isDemo) {
    return (
      <button className="demo-account" type="button" onClick={stopDemo} title="Exit demo mode">
        <span className="avatar">{demoUsername.slice(0, 2).toUpperCase()}</span>
        {!collapsed && (
          <span className="me-text">
            <span className="me-name">{demoUsername}</span>
            <span className="me-sub">Username token account</span>
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <UserButton afterSignOutUrl="/" />
      {!collapsed && <span className="me-name">{accountName}</span>}
    </>
  );
}

function Sidebar({ theme, setTheme, collapsed, setCollapsed, mobileOpen, onMobileClose }) {
  const { signOut } = useClerk();
  const { isDemo, stopDemo, isWallet, stopWallet } = useDemoAuth();

  const handleLogout = () => {
    onMobileClose?.();
    if (isWallet) {
      stopWallet();
      return;
    }
    if (isDemo) {
      stopDemo();
      return;
    }
    signOut({ redirectUrl: '/' });
  };

  return (
    <aside className={`side${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="side-top">
        <div className="brand">
          {collapsed
            ? <VtvMark className="brand-mark-svg" />
            : <VtvLogo className="brand-logo-svg" />}
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

function MobileTopBar({ subtitle, mobileOpen, setMobileOpen }) {
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
        <VtvMark className="brand-mark-svg" />
        <div>
          <div className="mobile-brand-name">Vice to Value</div>
          {subtitle && <div className="mobile-vice-name">{subtitle}</div>}
        </div>
      </div>
      <AccountControl collapsed />
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
    </nav>
  );
}

function AuthenticatedApp() {
  const api = useApi();
  const location = useLocation();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [vices, setVices] = useState([]);
  const [viceStats, setViceStats] = useState({});
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
    apiRef.current('/api/vices').then(data => {
      const enriched = data.map((v, i) => ({ ...v, color: getViceColor(v, i) }));
      setVices(enriched);
      setActiveViceId(prev => prev ?? (enriched[0]?.id ?? null));
      enriched.forEach(v => {
        apiRef.current(`/api/stats/${v.id}`)
          .then(s => setViceStats(st => ({ ...st, [v.id]: s })))
          .catch(() => {});
      });
    }).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadVices(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const ctx = { vices, viceStats, activeViceId, setActiveViceId, loadVices, companion, setCompanion, setShowOnboarding, theme };
  const activeVice = vices.find(v => v.id === activeViceId);
  const mobileSubtitle = location.pathname === '/log' && activeVice
    ? `${activeVice.emoji} ${activeVice.name}`
    : 'All vices';

  return (
    <ViceContext.Provider value={ctx}>
      <div className={`shell${collapsed ? ' collapsed' : ''}`}>
        <MobileTopBar subtitle={mobileSubtitle} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
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
            <Route path="/log" element={<LogEntry />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/vices" element={<ViceManager />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/support" element={<Support />} />
            <Route path="/badges" element={<Badges />} />
            <Route path="/wrapped/:year" element={<Wrapped />} />
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

function DemoLogin() {
  const { startDemo } = useDemoAuth();
  const [username, setUsername] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [issuedToken, setIssuedToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setIssuedToken('');
    setLoading(true);
    try {
      const result = await startDemo(username, accessToken);
      if (result.created) setIssuedToken(result.token);
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
          <div className="demo-login-title">Username access</div>
          <p className="demo-login-copy">Claim a unique username. The app creates a one-time private access token that cannot be regenerated or copied by another user.</p>
        </div>
        <span className="demo-badge">Token</span>
      </div>
      <form onSubmit={handleSubmit} className="demo-login-form">
        <label className="form-label" htmlFor="demo-username">Unique username</label>
        <input
          id="demo-username"
          className="form-input"
          value={username}
          placeholder="your-name"
          autoComplete="username"
          required
          minLength={3}
          onChange={e => { setUsername(e.target.value); setError(''); setIssuedToken(''); }}
        />
        <label className="form-label" htmlFor="username-token">Access token</label>
        <input
          id="username-token"
          className="form-input"
          value={accessToken}
          placeholder="Leave blank to claim a new username"
          autoComplete="off"
          onChange={e => { setAccessToken(e.target.value); setError(''); setIssuedToken(''); }}
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Checking…' : 'Continue with username'}
        </button>
        {issuedToken && (
          <div className="username-token-issued">
            <strong>Save this private token now:</strong>
            <code>{issuedToken}</code>
            <span>You will need it to use this username on another device. It is stored on this device automatically.</span>
          </div>
        )}
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

function QuickDemo() {
  const { startDemo } = useDemoAuth();
  const [loading, setLoading] = useState(false);

  const handleQuickDemo = async () => {
    setLoading(true);
    try {
      const demoName = 'demo-' + Math.random().toString(36).slice(2, 7);
      await startDemo(demoName, '');
    } catch {
      // ignore — user will see the full form below
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-demo-cta">
      <button type="button" className="auth-demo-btn" onClick={handleQuickDemo} disabled={loading}>
        {loading
          ? <><div className="btn-spinner btn-spinner-dark" /><span className="auth-demo-label">Starting demo…</span></>
          : <>
              <span className="auth-demo-icon">🚀</span>
              <span>
                <span className="auth-demo-label">Continue as Demo</span>
                <span className="auth-demo-sub">Try Vice to Value — no account required</span>
              </span>
            </>
        }
      </button>
    </div>
  );
}

function SignedOutContent() {
  const { isDemo, isWallet } = useDemoAuth();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  if (isDemo || isWallet) return <AuthenticatedApp />;

  const isSmall = typeof window !== 'undefined' && window.innerWidth <= 768;
  const showGate = isSmall && !mobileExpanded;

  return (
    <div className="auth-page">
      <div className="auth-bg auth-bg-one" />
      <div className="auth-bg auth-bg-two" />

      <section className={`auth-shell${mobileExpanded ? ' mobile-forms-open' : ''}`} aria-label="Vice Spending sign in">
        <div className="auth-hero-panel">
          <div className="auth-logo-row">
            <VtvLogo className="auth-logo-svg" />
          </div>

          <div className="auth-hero-copy">
            <div className="auth-kicker">Cut Today. Grow Tomorrow.</div>
            <h1>See what your vices really cost — then turn that money into goals.</h1>
            <p>Track spending by category, savings projections, streaks, and custom opportunity costs in one polished dashboard.</p>
          </div>

          <div className="auth-preview-card">
            <div className="auth-preview-top">
              <span>Monthly savings forecast</span>
              <strong>$842</strong>
            </div>
            <div className="auth-preview-bars" aria-hidden="true">
              <span style={{ height: '38%' }} />
              <span style={{ height: '54%' }} />
              <span style={{ height: '71%' }} />
              <span style={{ height: '48%' }} />
              <span style={{ height: '86%' }} />
              <span style={{ height: '64%' }} />
            </div>
            <div className="auth-preview-foot">
              <span>Streak</span>
              <b>12 days</b>
            </div>
          </div>

          <div className="auth-feature-grid">
            <span>✓ Combined dashboard</span>
            <span>✓ Editable entries</span>
            <span>✓ Savings goals</span>
            <span>✓ Username token access</span>
          </div>
        </div>

        <div className="auth-card-panel">
          <div className="auth-card-head">
            <span className="auth-pill">Private progress tracker</span>
            <h2>Welcome back</h2>
            <p>Connect with Phantom, MetaMask, Base Wallet, claim a username token, or sign in securely with email.</p>
          </div>

          {/* Mobile gate — two choices before showing all auth methods */}
          <div className={`mobile-auth-gate${showGate ? '' : ' hidden'}`}>
            <button type="button" className="btn btn-lg mobile-auth-btn" onClick={() => setMobileExpanded(true)}>
              Log In <span className="arrow">→</span>
            </button>
            <button type="button" className="btn ghost btn-lg mobile-auth-btn" onClick={() => setMobileExpanded(true)}>
              Create Account <span className="arrow">→</span>
            </button>
            <div className="mobile-auth-sep" />
            <QuickDemo />
          </div>

          {/* Auth forms — always visible on desktop, revealed on mobile after gate */}
          <div className={`auth-forms${showGate ? ' mobile-hidden' : ''}`}>
            {isSmall && mobileExpanded && (
              <button type="button" className="mobile-auth-back" onClick={() => setMobileExpanded(false)}>
                ← All sign-in options
              </button>
            )}
            <WalletSignIn />
            <div className="auth-divider"><span>or claim a username</span></div>
            <DemoLogin />
            <div className="auth-divider"><span>or continue with email</span></div>
            <div className="clerk-frame">
              <EmailAuth />
            </div>
            <div className="auth-divider"><span>or sign in with phone</span></div>
            <div className="clerk-frame">
              <PhoneAuth />
            </div>
            <QuickDemo />
          </div>
        </div>
      </section>
    </div>
  );
}

function SignedInContent() {
  const { isDemo, stopDemo, isWallet, stopWallet } = useDemoAuth();

  useEffect(() => {
    if (isDemo) stopDemo();
    if (isWallet) stopWallet();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthenticatedApp />;
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

export default function App() {
  if (!PUBLISHABLE_KEY) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#f66', background: '#111', minHeight: '100vh' }}>
        <h2 style={{ color: '#fff' }}>Configuration error</h2>
        <p style={{ color: '#aaa' }}>VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to your Vercel environment variables.</p>
      </div>
    );
  }
  return (
    <AppErrorBoundary>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <DemoAuthProvider>
          <BrowserRouter>
            <SignedOut>
              <SignedOutContent />
            </SignedOut>
            <SignedIn>
              <SignedInContent />
            </SignedIn>
          </BrowserRouter>
        </DemoAuthProvider>
      </ClerkProvider>
    </AppErrorBoundary>
  );
}
