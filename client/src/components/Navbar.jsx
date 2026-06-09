import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import Logo from './Logo';

const NAV = [
  { to: '/',         label: 'Dashboard', end: true },
  { to: '/log',      label: 'Log Today' },
  { to: '/savings',  label: 'Savings' },
  { to: '/vices',    label: 'Vices' },
  { to: '/partners', label: 'Partners' },
  { to: '/support',  label: 'FAQ' },
];

const s = {
  bar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    display: 'flex', alignItems: 'center', gap: 0,
    height: 56,
    background: 'rgba(4,12,6,0.92)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(212,175,55,0.2)',
    padding: '0 20px',
  },
  logoWrap: { display: 'flex', alignItems: 'center', marginRight: 32, flexShrink: 0 },
  nav: { display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflowX: 'auto' },
  link: {
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    color: 'rgba(240,247,236,0.55)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'color 0.12s, background 0.12s',
  },
  linkActive: {
    color: '#d4af37',
    background: 'rgba(212,175,55,0.10)',
  },
  right: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  hamburger: {
    display: 'none',
    background: 'none',
    border: 'none',
    color: '#f0f7ec',
    cursor: 'pointer',
    padding: 4,
    marginRight: 8,
    fontSize: 22,
  },
  mobileMenu: {
    position: 'fixed', top: 56, left: 0, right: 0, zIndex: 99,
    background: 'rgba(4,12,6,0.97)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(212,175,55,0.2)',
    padding: '12px 20px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  mobileLink: {
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    color: 'rgba(240,247,236,0.7)',
    textDecoration: 'none',
    transition: 'color 0.12s, background 0.12s',
  },
};

export default function Navbar({ onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const activeLinkStyle = ({ isActive }) => ({
    ...s.link,
    ...(isActive ? s.linkActive : {}),
  });

  const activeMobileStyle = ({ isActive }) => ({
    ...s.mobileLink,
    ...(isActive ? { color: '#d4af37', background: 'rgba(212,175,55,0.10)' } : {}),
  });

  return (
    <>
      <header style={s.bar}>
        <button
          style={s.hamburger}
          className="vtv-navbar-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <div style={s.logoWrap} className="vtv-navbar-logo">
          <Logo size={36} variant="full" />
        </div>

        <nav style={s.nav} className="vtv-navbar-links">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={activeLinkStyle}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={s.right}>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {menuOpen && (
        <nav style={s.mobileMenu}>
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={activeMobileStyle}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          {onSignOut && (
            <button
              onClick={() => { setMenuOpen(false); onSignOut(); }}
              style={{ ...s.mobileLink, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              Sign out
            </button>
          )}
        </nav>
      )}

      <style>{`
        @media (max-width: 680px) {
          .vtv-navbar-links { display: none !important; }
          .vtv-navbar-hamburger { display: flex !important; }
          .vtv-navbar-logo {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            pointer-events: none;
          }
        }
      `}</style>
    </>
  );
}
