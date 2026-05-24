import { useState, useEffect, useCallback, useRef } from 'react';
import { ClerkProvider, SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import LogEntry from './pages/LogEntry';
import Savings from './pages/Savings';
import ViceManager from './pages/ViceManager';
import { ViceContext, getViceColor } from './ViceContext';
import { DemoAuthProvider, useApi, useDemoAuth } from './useApi';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const THEMES = ['emerald', 'mint', 'plum', 'noir'];

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/log', label: 'Log Entry' },
  { to: '/savings', label: 'Savings' },
  { to: '/vices', label: 'Vices' },
];

function AccountControl({ collapsed = false }) {
  const { isDemo, demoUsername, stopDemo } = useDemoAuth();

  if (isDemo) {
    return (
      <button className="demo-account" type="button" onClick={stopDemo} title="Exit demo mode">
        <span className="avatar">{demoUsername.slice(0, 2).toUpperCase()}</span>
        {!collapsed && (
          <span className="me-text">
            <span className="me-name">Demo: {demoUsername}</span>
            <span className="me-sub">Click to sign out</span>
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <UserButton afterSignOutUrl="/" />
      {!collapsed && <span className="me-name">Account</span>}
    </>
  );
}

function Sidebar({ theme, setTheme, collapsed, setCollapsed, vices, activeViceId, setActiveViceId, mobileOpen, onMobileClose }) {
  const handleViceClick = id => {
    setActiveViceId(id);
    onMobileClose?.();
  };

  return (
    <aside className={`side${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="side-top">
        <div className="brand">
          <span className="brand-mark">◈</span>
          {!collapsed && <span className="brand-name">Vice Spending</span>}
        </div>
        <button className="side-collapse" onClick={() => setCollapsed(c => !c)} aria-label="Toggle sidebar">
          {collapsed ? '›' : '‹'}
        </button>
        <button className="side-close" onClick={onMobileClose} aria-label="Close menu">×</button>
      </div>

      {vices.length > 0 && (
        <div className="vice-list">
          {vices.map(v => (
            <button
              key={v.id}
              className={`vice-row${v.id === activeViceId ? ' active' : ''}`}
              style={{ '--vice-c': v.color }}
              onClick={() => handleViceClick(v.id)}
            >
              <span className="vice-glyph">{v.emoji || v.name[0]}</span>
              {!collapsed && <span className="vice-name">{v.name}</span>}
            </button>
          ))}
        </div>
      )}

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
        <div className="me">
          <AccountControl collapsed={collapsed} />
        </div>
      </div>
    </aside>
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
        <span className="brand-mark">◈</span>
        <div>
          <div className="mobile-brand-name">Vice Spending</div>
          {subtitle && <div className="mobile-vice-name">{subtitle}</div>}
        </div>
      </div>
      <AccountControl collapsed />
    </header>
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
  const [theme, setTheme] = useState(() => localStorage.getItem('vt-theme') || 'emerald');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vt-sidebar') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.className = `theme-${theme}${mobileOpen ? ' mobile-menu-open' : ''}`;
    localStorage.setItem('vt-theme', theme);
  }, [theme, mobileOpen]);

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

  const ctx = { vices, viceStats, activeViceId, setActiveViceId, loadVices };
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
          setTheme={setTheme}
          collapsed={mobileOpen ? false : collapsed}
          setCollapsed={setCollapsed}
          vices={vices}
          activeViceId={activeViceId}
          setActiveViceId={setActiveViceId}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/log" element={<LogEntry />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/vices" element={<ViceManager />} />
        </Routes>
      </div>
    </ViceContext.Provider>
  );
}

function DemoLogin() {
  const { startDemo } = useDemoAuth();
  const [username, setUsername] = useState('demo');
  const [error, setError] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    try {
      startDemo(username);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="demo-login-card">
      <div>
        <div className="demo-login-title">Demo mode</div>
        <p className="demo-login-copy">Enter any username to try Vice Spending without an email.</p>
      </div>
      <form className="demo-login-form" onSubmit={handleSubmit}>
        <label className="form-label" htmlFor="demo-username">Username</label>
        <div className="demo-login-row">
          <input
            id="demo-username"
            className="form-input"
            value={username}
            placeholder="demo"
            autoComplete="username"
            onChange={e => { setUsername(e.target.value); setError(''); }}
          />
          <button className="btn btn-primary" type="submit">Enter demo</button>
        </div>
        {error && <div className="form-error">{error}</div>}
      </form>
    </div>
  );
}

function SignedOutContent() {
  const { isDemo } = useDemoAuth();
  if (isDemo) return <AuthenticatedApp />;

  return (
    <div className="auth-page">
      <div className="auth-brand">Vice Spending</div>
      <p className="auth-tagline">Track your spending habits. Own your choices.</p>
      <DemoLogin />
      <div className="auth-divider"><span>or sign in with email</span></div>
      <SignIn />
    </div>
  );
}

function SignedInContent() {
  const { isDemo, stopDemo } = useDemoAuth();

  useEffect(() => {
    if (isDemo) stopDemo();
  }, [isDemo, stopDemo]);

  return <AuthenticatedApp />;
}

export default function App() {
  return (
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
  );
}
