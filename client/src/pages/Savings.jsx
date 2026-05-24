import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useViceContext } from '../ViceContext';
import { getUnitLabel } from '../formatUnits';

const fmt$ = n => '$' + Number(n || 0).toFixed(2);
const fmtBig = n => {
  const v = Number(n || 0);
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 10000) return '$' + (v / 1000).toFixed(0) + 'k';
  if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'k';
  return fmt$(v);
};
const fmtDays = d => d >= 3650 ? `${(d / 365).toFixed(0)}yr` : d >= 365 ? `${(d / 365).toFixed(1)}yr` : `${d}d`;

const dailyRate = pct => Math.pow(1 + pct / 100, 1 / 365) - 1;
const dcaFV = (daily, days, annualPct) => {
  const r = dailyRate(annualPct);
  if (r === 0) return daily * days;
  return daily * ((Math.pow(1 + r, days) - 1) / r);
};

const ASSETS = [
  { ticker: 'HYSA', name: 'High-Yield Savings', sub: 'FDIC insured · ~4.5% APY', rate: 4.5 },
  { ticker: 'SPY',  name: 'S&P 500 Index',      sub: 'Diversified large-cap · historical avg', rate: 10.0 },
  { ticker: 'VOO',  name: 'Vanguard S&P 500',   sub: 'Low expense ratio index fund', rate: 10.0 },
  { ticker: 'QQQ',  name: 'Nasdaq 100',          sub: 'Tech-heavy growth index', rate: 13.0 },
  { ticker: 'GOLD', name: 'Gold',                sub: 'Inflation hedge · commodity', rate: 7.5 },
  { ticker: 'BTC',  name: 'Bitcoin',             sub: 'High risk / high variance', rate: 50.0 },
];

const MS_DAYS = [30, 90, 365, 1825, 3650];

const UNLOCKS = [
  { name: 'Coffee run',      detail: 'Local café · specialty drink',      cost: 7 },
  { name: 'Dinner for two',  detail: 'Nice restaurant with drinks',        cost: 120 },
  { name: 'Gym month',       detail: 'Monthly membership pass',           cost: 50 },
  { name: 'Massage',         detail: '60-minute deep tissue session',      cost: 90 },
  { name: 'Round-trip flight', detail: 'Economy domestic',               cost: 350 },
  { name: 'New laptop',      detail: 'MacBook Air M2 · entry level',      cost: 1099 },
  { name: 'Vacation',        detail: '7-night resort all-inclusive',      cost: 2500 },
  { name: 'Emergency fund',  detail: '3 months of expenses · ~$5k avg',   cost: 5000 },
];

// ── SVG area/bars chart ──────────────────────────────────
function SvgChart({ days, perDay, viceColor }) {
  const [mode, setMode] = useState('area');
  const W = 600, H = 240;
  const PL = 16, PR = 20, PT = 12, PB = 8;
  const cW = W - PL - PR, cH = H - PT - PB;

  const pts = useMemo(() => {
    const n = Math.min(days, 150);
    return Array.from({ length: n }, (_, i) => {
      const d = Math.round(((i + 1) / n) * days);
      return { d, y: perDay * d };
    });
  }, [days, perDay]);

  const maxY = pts[pts.length - 1]?.y || 1;
  const sx = d => PL + (d / days) * cW;
  const sy = y => PT + (1 - y / maxY) * cH;

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.d).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${sx(days).toFixed(1)},${(PT + cH).toFixed(1)} L${PL},${(PT + cH).toFixed(1)} Z`;

  const mDots = MS_DAYS.filter(m => m < days).map(m => ({ m, x: sx(m), y: sy(perDay * m) }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div className="seg">
          <button className={mode === 'area' ? 'on' : ''} onClick={() => setMode('area')}>Area</button>
          <button className={mode === 'bars' ? 'on' : ''} onClick={() => setMode('bars')}>Bars</button>
        </div>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={viceColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={viceColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75, 1].map(t => (
            <line key={t} x1={PL} y1={PT + (1 - t) * cH} x2={W - PR} y2={PT + (1 - t) * cH}
              stroke="var(--rule)" strokeWidth="0.6" />
          ))}

          {mode === 'area' ? (
            <>
              <path d={areaPath} fill="url(#sg)" />
              <path d={linePath} fill="none" stroke={viceColor} strokeWidth="2" strokeLinejoin="round" />
            </>
          ) : (
            pts.map((p, i) => {
              const bw = Math.max(1, cW / pts.length - 0.5);
              const bh = (p.y / maxY) * cH;
              return (
                <rect key={i} x={sx(p.d) - bw / 2} y={PT + cH - bh}
                  width={bw} height={bh} fill={viceColor} opacity="0.55" rx="1" />
              );
            })
          )}

          {mDots.map(({ m, x, y }) => (
            <g key={m}>
              <line x1={x} y1={PT} x2={x} y2={PT + cH}
                stroke="var(--rule-2)" strokeWidth="0.8" strokeDasharray="3,3" />
              <circle cx={x} cy={y} r="3.5" fill={viceColor} stroke="var(--paper-2)" strokeWidth="2" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Mini sparkline for investment table ──────────────────
function Sparkline({ days, perDay, rate }) {
  const W = 80, H = 28;
  const pts = Array.from({ length: 20 }, (_, i) => {
    const d = Math.round(((i + 1) / 20) * days);
    return { d, y: dcaFV(perDay, d, rate) };
  });
  const maxY = pts[pts.length - 1]?.y || 1;
  const pathD = pts
    .map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${((p.d / days) * W).toFixed(1)},${(H - (p.y / maxY) * H).toFixed(1)}`
    )
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
      <path d={pathD} fill="none" stroke="var(--money)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function Savings() {
  const { vices, viceStats, activeViceId, setActiveViceId } = useViceContext();
  const [days, setDays] = useState(365);
  const [qtyPerDay, setQtyPerDay] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState(5);

  const activeVice = vices.find(v => v.id === activeViceId);
  const activeUnitLabel = getUnitLabel(activeVice);
  const stats = activeViceId ? viceStats[activeViceId] : null;
  const viceColor = activeVice?.color || 'var(--money)';

  useEffect(() => {
    const s = viceStats[activeViceId];
    if (!s) return;
    if (s.avg_quantity_per_day > 0) setQtyPerDay(Math.max(0.5, s.avg_quantity_per_day));
    if (s.avg_price_per_unit > 0)   setPricePerUnit(Math.max(1, Math.min(50, s.avg_price_per_unit)));
  }, [activeViceId, viceStats]);

  const perDay   = useMemo(() => qtyPerDay * pricePerUnit, [qtyPerDay, pricePerUnit]);
  const projected = perDay * days;
  const perWeek  = perDay * 7;
  const perMonth = perDay * 30.44;

  const [whole, cents] = projected.toFixed(2).split('.');
  const wholeStr = Number(whole).toLocaleString();

  const maxDailySpend = Math.max(
    1,
    ...vices.map(v => viceStats[v.id]?.avg_daily_spend || 0)
  );
  const BAR_H = 160;

  if (vices.length === 0) {
    return (
      <main className="main">
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h2>No vices yet</h2>
          <p>Add a vice in <Link to="/vices">Vices</Link> to see your savings potential.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main" style={{ '--vice-c': viceColor }}>
      {/* Breadcrumbs */}
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Savings</span>
        {activeVice && (
          <span className="crumb-pill">
            <span className="dot" />
            {activeVice.emoji} {activeVice.name}
          </span>
        )}
      </div>

      {/* Hero */}
      <div className="hero">
        <div>
          <div className="hero-eyebrow">
            If you quit <b>{activeVice?.name || 'today'}</b>
          </div>
          <div className="hero-headline">
            You'd save <em>this much</em><br />
            in {days >= 365 ? `${(days / 365).toFixed(1)} years` : `${days} days`}
          </div>
          <div className="hero-amount-wrap">
            <div className="hero-amount">
              <span className="dollar">$</span>{wholeStr}<span className="cents">.{cents}</span>
            </div>
          </div>
          <div className="hero-foot">
            <span className="chip"><span className="glyph">d</span>{fmt$(perDay)}/day</span>
            <span className="chip"><span className="glyph">w</span>{fmt$(perWeek)}/wk</span>
            <span className="chip"><span className="glyph">m</span>{fmtBig(perMonth)}/mo</span>
          </div>
        </div>

        <div className="inputs">
          <div className="inputs-title">
            <span>Projection settings</span>
            {stats && (
              <button className="reset" onClick={() => {
                const s = stats;
                if (s.avg_quantity_per_day > 0) setQtyPerDay(Math.max(0.5, s.avg_quantity_per_day));
                if (s.avg_price_per_unit > 0) setPricePerUnit(Math.max(1, Math.min(50, s.avg_price_per_unit)));
                setDays(365);
              }}>↺ Reset</button>
            )}
          </div>

          <div className="field">
            <div className="field-head">
              <span className="field-label">Time horizon</span>
              <span className="field-val">
                {days >= 365 ? (days / 365).toFixed(1) : days}
                <span className="unit">{days >= 365 ? ' yr' : ' days'}</span>
              </span>
            </div>
            <input type="range" className="slider" min={7} max={3650} step={1} value={days}
              onChange={e => setDays(Number(e.target.value))} />
            <div className="ticks"><span>7d</span><span>1yr</span><span>5yr</span><span>10yr</span></div>
          </div>

          <div className="field">
            <div className="field-head">
              <span className="field-label">{activeUnitLabel}/day</span>
              <span className="field-val">
                {Number(qtyPerDay).toFixed(1)}
                <span className="unit"> {activeUnitLabel}</span>
              </span>
            </div>
            <input type="range" className="slider" min={0.5} max={20} step={0.5} value={qtyPerDay}
              onChange={e => setQtyPerDay(Number(e.target.value))} />
            <div className="ticks"><span>0.5</span><span>5</span><span>10</span><span>20</span></div>
          </div>

          <div className="field">
            <div className="field-head">
              <span className="field-label">Price / {activeUnitLabel}</span>
              <span className="field-val">{fmt$(pricePerUnit)}</span>
            </div>
            <input type="range" className="slider" min={1} max={50} step={0.5} value={pricePerUnit}
              onChange={e => setPricePerUnit(Number(e.target.value))} />
            <div className="ticks"><span>$1</span><span>$15</span><span>$30</span><span>$50</span></div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="stats-strip">
        {[
          { key: 'Per day',   val: perDay },
          { key: 'Per week',  val: perWeek },
          { key: 'Per month', val: perMonth },
          { key: fmtDays(days), val: projected },
        ].map(({ key, val }) => (
          <div key={key} className="stat">
            <div className="stat-key">{key}</div>
            <div className="stat-val">{fmtBig(val)}</div>
          </div>
        ))}
      </div>

      {/* Category bars + chart */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">
            Spending by vice
            <span className="small">daily avg</span>
          </span>
          <span className="panel-sub">{vices.length} tracked</span>
        </div>

        <div className="cat-head">
          <div>
            <div className="cat-total-label">Total daily spend</div>
            <div className="cat-total-val">
              {fmtBig(vices.reduce((s, v) => s + (viceStats[v.id]?.avg_daily_spend || 0), 0))}
              <span className="small">/day</span>
            </div>
          </div>
        </div>

        <div className="cat-bars">
          {vices.map(v => {
            const s = viceStats[v.id];
            const daily = s?.avg_daily_spend || 0;
            const barH = maxDailySpend > 0 ? Math.max(4, (daily / maxDailySpend) * BAR_H) : 4;
            const isActive = v.id === activeViceId;
            return (
              <div
                key={v.id}
                className={`cat-bar-col${isActive ? ' active' : ''}`}
                style={{ '--bar-c': v.color }}
                onClick={() => setActiveViceId(v.id)}
              >
                <div className="cat-bar-val">{daily > 0 ? fmt$(daily) : '—'}</div>
                <div className="cat-bar-track" style={{ height: BAR_H + 'px' }}>
                  <div className="cat-bar-fill" style={{ height: barH + 'px' }} />
                </div>
                <div className="cat-bar-meta">
                  <div className="cat-bar-glyph">{v.emoji}</div>
                  <div className="cat-bar-name">{v.name}</div>
                  <div className="cat-bar-sub">
                    {s ? `${Number(s.avg_quantity_per_day || 0).toFixed(1)}/day` : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 32 }}>
          <SvgChart days={days} perDay={perDay} viceColor={viceColor} />
        </div>
      </div>

      {/* Investment comparison */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">
            If you'd invested it instead
            <span className="small">DCA · {fmtDays(days)}</span>
          </span>
        </div>
        <div className="invested-head">
          <span className="invested-eyebrow">{fmt$(perDay)}/day deposited for {days} days</span>
          <span className="invested-legend">projected value</span>
        </div>
        <div className="inv-table">
          <div className="inv-thead">
            <div>Asset</div>
            <div>CAGR</div>
            <div className="inv-spark">Trend</div>
            <div style={{ textAlign: 'right' }}>Value</div>
            <div style={{ textAlign: 'right' }}>vs. cash</div>
          </div>
          {(() => {
            const rows = ASSETS.map(a => ({
              ...a,
              fv: dcaFV(perDay, days, a.rate),
              gain: dcaFV(perDay, days, a.rate) - projected,
            })).sort((a, b) => b.fv - a.fv);
            const maxFv = rows[0].fv;
            return rows.map((r, i) => (
              <div key={r.ticker} className={`inv-row${i === 0 ? ' win' : ''}`}>
                <div className="inv-asset">
                  <span className="inv-ticker">{r.ticker}</span>
                  <div>
                    <div className="inv-name">{r.name}</div>
                    <div className="inv-sub">{r.sub}</div>
                  </div>
                </div>
                <div className="inv-cagr">
                  {r.rate.toFixed(1)}<span className="cagr-unit">%</span>
                </div>
                <div className="inv-spark">
                  <Sparkline days={days} perDay={perDay} rate={r.rate} />
                  <div className="inv-bar">
                    <span style={{ width: `${(r.fv / maxFv) * 100}%` }} />
                  </div>
                </div>
                <div className="inv-val">
                  <div className="inv-val-big">{fmtBig(r.fv)}</div>
                </div>
                <div className="inv-gain">
                  <div className={`inv-gain-num ${r.gain >= 0 ? 'up' : 'down'}`}>
                    {r.gain >= 0 ? '+' : ''}{fmtBig(r.gain)}
                  </div>
                  <div className="inv-gain-pct">
                    {projected > 0 ? `${((r.fv / projected - 1) * 100).toFixed(0)}% vs cash` : ''}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Milestones + Unlocks */}
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Future you</span>
            <span className="panel-sub">click to set horizon</span>
          </div>
          <ul className="milestones">
            {MS_DAYS.map(m => {
              const amt = perDay * m;
              const isActive = days === m;
              const dateStr = new Date(Date.now() + m * 864e5)
                .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              const labels = {
                30: <><em>One month</em> clear</>,
                90: <><em>Three months</em> clean</>,
                365: <>A full <em>year</em> free</>,
                1825: <><em>Five years</em> ahead</>,
                3650: <><em>A decade</em> gained</>,
              };
              return (
                <li key={m} className={`ms${isActive ? ' active' : ''}`} onClick={() => setDays(m)}>
                  <div className="ms-date">
                    <b>{dateStr}</b>
                    {fmtDays(m)}
                  </div>
                  <div className="ms-label">{labels[m]}</div>
                  <div className="ms-amt">{fmtBig(amt)}</div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">What that buys</span>
            <span className="panel-sub">{fmtBig(projected)} total</span>
          </div>
          <div className="unlocks">
            {UNLOCKS.filter(u => projected >= u.cost).map(u => (
              <div key={u.name} className="unlock">
                <div>
                  <div className="unlock-name">{u.name}</div>
                  <div className="unlock-detail">{u.detail}</div>
                </div>
                <div className="unlock-val">
                  ×{Math.floor(projected / u.cost).toLocaleString()}
                  <span className="suffix">{fmt$(u.cost)}</span>
                </div>
              </div>
            ))}
            {UNLOCKS.filter(u => projected >= u.cost).length === 0 && (
              <p style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
                Adjust the sliders to see what you could buy.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-row">
        <Link to="/log" className="btn">
          Log today <span className="arrow">→</span>
        </Link>
        <Link to="/vices" className="btn ghost">
          Manage vices
        </Link>
      </div>
    </main>
  );
}
