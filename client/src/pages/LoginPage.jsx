import Logo from '../components/Logo';

/**
 * Branded split-screen login page.
 *
 * Pass a Clerk auth component as `authComponent`:
 *   import { SignIn } from '@clerk/clerk-react';
 *   <Route path="/sign-in" element={<LoginPage authComponent={SignIn} />} />
 *
 * Or pass any custom auth UI as children:
 *   <LoginPage><YourAuthForm /></LoginPage>
 */
export default function LoginPage({ authComponent: AuthComponent, children }) {
  return (
    <div style={s.page}>
      <div style={s.bgOne} aria-hidden="true" />
      <div style={s.bgTwo} aria-hidden="true" />

      {/* ── Left hero panel ── */}
      <section style={s.hero} aria-label="Vice to Value">
        <div style={s.logoRow}>
          <Logo size={52} variant="full" pulse />
        </div>

        <div style={s.heroCopy} className="vtv-animate-up">
          <p style={s.kicker}>Cut Today. Grow Tomorrow.</p>
          <h1 style={s.h1}>See what your vices really cost — then turn that money into goals.</h1>
          <p style={s.sub}>Track spending, clean days, savings projections, and custom opportunity costs in one polished dashboard.</p>
        </div>

        <div style={s.previewCard} className="vtv-animate-up vtv-animate-up-2">
          <div style={s.previewTop}>
            <span style={{ color: 'rgba(240,247,236,0.5)', fontSize: 12 }}>Monthly savings forecast</span>
            <strong style={{ color: '#d4af37', fontSize: 22, fontWeight: 700 }}>$842</strong>
          </div>
          <div style={s.bars} aria-hidden="true">
            {[38, 54, 71, 48, 86, 64].map((h, i) => (
              <span key={i} style={{ ...s.bar, height: `${h}%`, animationDelay: `${i * 0.07}s` }} />
            ))}
          </div>
          <div style={s.previewFoot}>
            <span style={{ color: 'rgba(240,247,236,0.5)', fontSize: 12 }}>Clean streak</span>
            <b style={{ color: '#d4af37' }}>12 days</b>
          </div>
        </div>

        <div style={s.featureGrid} className="vtv-animate-up vtv-animate-up-3">
          {['Combined dashboard', 'Editable entries', 'Savings goals', 'Username token access'].map(f => (
            <span key={f} style={s.feature}>✓ {f}</span>
          ))}
        </div>
      </section>

      {/* ── Right auth panel ── */}
      <section style={s.authPanel} aria-label="Sign in">
        <div style={s.authInner}>
          {AuthComponent ? <AuthComponent /> : children}
        </div>
      </section>
    </div>
  );
}

const s = {
  page: {
    display: 'flex',
    minHeight: '100vh',
    background: '#040c06',
    color: '#f0f7ec',
    fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  bgOne: {
    position: 'absolute', top: '-30%', left: '-10%',
    width: '55%', paddingBottom: '55%',
    background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgTwo: {
    position: 'absolute', bottom: '-20%', right: '-5%',
    width: '45%', paddingBottom: '45%',
    background: 'radial-gradient(circle, rgba(18,38,21,0.8) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  hero: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '48px 52px',
    gap: 28,
    position: 'relative',
    zIndex: 1,
  },
  logoRow: { display: 'flex' },
  heroCopy: { display: 'flex', flexDirection: 'column', gap: 14 },
  kicker: {
    fontSize: 12, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: '#d4af37',
  },
  h1: {
    fontSize: 'clamp(24px, 3.2vw, 38px)', fontWeight: 700,
    lineHeight: 1.2, letterSpacing: '-0.02em',
    color: '#f0f7ec',
  },
  sub: { fontSize: 15, color: 'rgba(240,247,236,0.55)', lineHeight: 1.6 },
  previewCard: {
    background: '#122615',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 14,
    padding: '18px 20px',
    maxWidth: 320,
  },
  previewTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  bars: {
    display: 'flex', alignItems: 'flex-end', gap: 5,
    height: 60, marginBottom: 14,
  },
  bar: {
    flex: 1, borderRadius: 4,
    background: 'linear-gradient(to top, #d4af37, rgba(212,175,55,0.4))',
    animation: 'vtv-up 0.5s ease both',
  },
  previewFoot: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  featureGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px',
  },
  feature: {
    fontSize: 13, color: 'rgba(240,247,236,0.55)',
  },
  authPanel: {
    width: 'min(460px, 44vw)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
    background: 'rgba(18,38,21,0.55)',
    borderLeft: '1px solid rgba(212,175,55,0.12)',
    position: 'relative',
    zIndex: 1,
  },
  authInner: { width: '100%', maxWidth: 380 },
};
