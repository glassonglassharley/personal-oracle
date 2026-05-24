import { useState, useEffect, useCallback, useRef } from 'react';
import { ClerkProvider, SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import LogEntry from './pages/LogEntry';
import Savings from './pages/Savings';
import ViceManager from './pages/ViceManager';
import { ViceContext, getViceColor } from './ViceContext';
import { useApi } from './useApi';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const THEMES = ['emerald', 'mint', 'plum', 'noir'];

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/log', label: 'Log Entry' },
  { to: '/savings', label: 'Savings' },
  { to: '/vices', label: 'Vices' },
];

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
          <UserButton afterSignOutUrl="/" />
          {!collapsed && <span className="me-name">Account</span>}
        </div>
      </div>
    </aside>
  );
}

function MobileTopBar({ activeVice, mobileOpen, setMobileOpen }) {
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
          {activeVice && (
            <div className="mobile-vice-name">{activeVice.emoji} {activeVice.name}</div>
          )}
        </div>
      </div>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}

function AuthenticatedApp() {
  const api = useApi();
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

  return (
    <ViceContext.Provider value={ctx}>
      <div className={`shell${collapsed ? ' collapsed' : ''}`}>
        <MobileTopBar activeVice={activeVice} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
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

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <SignedOut>
          <div className="auth-page">
            <div className="auth-brand">Vice Spending</div>
            <p className="auth-tagline">Track your spending habits. Own your choices.</p>
            <SignIn />
          </div>
        </SignedOut>
        <SignedIn>
          <AuthenticatedApp />
        </SignedIn>
      </BrowserRouter>
    </ClerkProvider>
  );
}
