import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const TEAL_LIT = '#1acd8c';
const VIOLET   = '#8b5cf6';
const GOLD     = '#f5c542';
const ORANGE   = '#f7931a';
const GRAY     = '#4a5568';

const DARK_VARS = {
  '--paper':      '#070d0b',
  '--paper-2':    '#0d1a15',
  '--paper-3':    '#142319',
  '--ink':        '#e8f5f0',
  '--ink-2':      '#b0d4c2',
  '--ink-3':      '#5a8a74',
  '--ink-4':      '#2e4a3c',
  '--rule':       'rgba(26,205,140,0.07)',
  '--rule-2':     'rgba(26,205,140,0.16)',
  '--money':      TEAL_LIT,
  '--money-2':    '#0F6E56',
  '--money-soft': 'rgba(26,205,140,0.12)',
  '--warn':       '#f97316',
};

const ASSETS = [
  {
    key: 'Cash',
    label: 'Cash saved',
    cardLabel: 'Cash saved',
    rate: 0,
    color: GRAY,
    dash: [5, 3],
    icon: '💵',
    description: 'No market growth, just money not spent',
  },
  {
    key: 'SP500',
    label: 'S&P 500',
    cardLabel: 'S&P 500',
    rate: 0.10,
    color: VIOLET,
    dash: [],
    icon: '📈',
    description: 'Illustrative 10% annualized return',
  },
  {
    key: 'HYSA',
    label: 'High Yield Savings Account',
    cardLabel: 'High Yield Savings Account',
    rate: 0.04,
    color: TEAL_LIT,
    dash: [],
    icon: '🏦',
    description: 'Illustrative 4% annualized return',
  },
  {
    key: 'BTC',
    label: 'Bitcoin (BTC)',
    cardLabel: 'Bitcoin',
    rate: 0.40,
    color: ORANGE,
    dash: [],
    icon: '₿',
    description: 'Illustrative 40% annualized return',
  },
  {
    key: 'Gold',
    label: 'Gold',
    cardLabel: 'Gold',
    rate: 0.07,
    color: GOLD,
    dash: [],
    icon: '🥇',
    description: 'Illustrative 7% annualized return',
  },
];

const MILESTONES = [
  { days: 30,   label: '1 Month',  sub: '30 days clean' },
  { days: 90,   label: '3 Months', sub: '90 days clean' },
  { days: 365,  label: '1 Year',   sub: '365 days clean' },
  { days: 1825, label: '5 Years',  sub: '1,825 days clean' },
];

const BUYS = [
  { label: 'Coffee run',         sub: 'Local café treat',              cost: 25 },
  { label: 'Nice dinner',        sub: 'For two, with drinks',          cost: 120 },
  { label: 'AirPods Pro',        sub: 'Apple AirPods Pro 2nd gen',    cost: 249 },
  { label: 'Weekend getaway',    sub: 'Airbnb + travel',               cost: 500 },
  { label: 'New iPhone',         sub: 'Latest iPhone Pro',             cost: 999 },
  { label: 'MacBook Air',        sub: 'M3, 16 GB RAM',                 cost: 1299 },
  { label: 'Round-trip flights', sub: 'US → Europe, economy',         cost: 900 },
  { label: 'MacBook Pro',        sub: 'M4 Pro, fully loaded',          cost: 2499 },
  { label: 'E-bike',             sub: 'Premium commuter bike',         cost: 3500 },
  { label: 'Dream vacation',     sub: 'Two weeks abroad',              cost: 4000 },
  { label: 'Down payment fund',  sub: '1 month saved toward a home',  cost: 10000 },
  { label: '10-year milestone',  sub: 'A decade of clean living',      cost: 36500 },
];

function dcaFV(dailyPMT, annualRate, days) {
  const r = annualRate / 365;
  if (r === 0 || days === 0) return dailyPMT * days;
  return dailyPMT * ((Math.pow(1 + r, days) - 1) / r);
}

const fmt$0 = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmt$2 = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtBig(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return fmt$0(n);
}

export default function Savings() {
  const api = useApi();
  const { vices } = useViceContext();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [horizon, setHorizon] = useState(365);

  useEffect(() => {
    if (vices.length === 0) {
      setData(null);
      return;
    }

    setLoading(true);
    Promise.all(vices.map(async vice => {
      const savings = await api(`/api/savings/${vice.id}?days=1825`);
      return { vice, savings };
    }))
      .then(results => {
        const perDay = results.reduce((sum, { savings }) => sum + Number(savings.per_day || 0), 0);
        setData({
          days: 1825,
          per_day: perDay,
          per_week: perDay * 7,
          per_month: perDay * 30.44,
          byVice: results,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [vices]); // eslint-disable-line react-hooks/exhaustive-deps

  const perDay    = data?.per_day || 0;
  const projected = perDay * horizon;

  // Chart: monthly data points up to horizon
  const maxDays = Math.max(horizon, 90);
  const step    = Math.max(1, Math.floor(maxDays / 48));
  const points  = [];
  for (let d = 0; d <= maxDays; d += step) points.push(d);
  if (points[points.length - 1] !== maxDays) points.push(maxDays);

  const chartLabels = points.map(d => {
    if (d === 0) return 'Now';
    if (d < 365) return `${Math.round(d / 30)}mo`;
    return `${(d / 365).toFixed(d % 365 === 0 ? 0 : 1)}yr`;
  });

  const chartDatasets = ASSETS.map(a => ({
    label: a.label,
    data: points.map(d => Math.round(dcaFV(perDay, a.rate, d))),
    borderColor: a.color,
    backgroundColor: a.color + '1a',
    borderWidth: a.key === 'Cash' ? 1.5 : 2.5,
    borderDash: a.dash,
    pointRadius: 0,
    tension: 0.35,
    fill: false,
  }));

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#5a8a74', boxWidth: 16, padding: 20, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: '#0d1a15',
        borderColor: 'rgba(26,205,140,0.22)',
        borderWidth: 1,
        titleColor: '#b0d4c2',
        bodyColor: '#e8f5f0',
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBig(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(26,205,140,0.06)' },
        ticks: { color: '#5a8a74', maxTicksLimit: 8 },
      },
      y: {
        grid: { color: 'rgba(26,205,140,0.06)' },
        ticks: { color: '#5a8a74', callback: v => fmtBig(v) },
      },
    },
  };

  const msCards = MILESTONES.map(m => ({
    ...m,
    amount: perDay * m.days,
    date: new Date(Date.now() + m.days * 86400000)
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  }));

  const affordable = BUYS.filter(b => b.cost <= projected).slice(-6);
  const nextItems  = BUYS.filter(b => b.cost > projected).slice(0, 3);
  const investmentCards = ASSETS
    .filter(asset => asset.key !== 'Cash')
    .map(asset => {
      const value = dcaFV(perDay, asset.rate, horizon);
      const gain = value - projected;
      const gainPct = projected > 0 ? (gain / projected) * 100 : 0;
      return { ...asset, value, gain, gainPct };
    });

  if (vices.length === 0) {
    return (
      <main className="main sv-page" style={DARK_VARS}>
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h2>Add a vice to see your savings</h2>
          <p>Go to <a href="/vices">Vices</a> to add one.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main sv-page" style={DARK_VARS}>
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Combined Savings</span>
        <span className="crumb-pill">
          <span className="dot" />
          All vices
        </span>
      </div>

      {/* ── Hero ── */}
      <div className="sv-hero">
        <div className="sv-hero-eyebrow">
          If you quit <em>all tracked vices</em> for
        </div>
        <div className="sv-horizon-row">
          {MILESTONES.map(m => (
            <button
              key={m.days}
              className={`sv-horizon-btn${horizon === m.days ? ' on' : ''}`}
              onClick={() => setHorizon(m.days)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <>
            <div className="sv-amount-row">
              <span className="sv-dollar">$</span>
              <span className="sv-big-num">
                {Number(projected).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="sv-chips">
              <span className="sv-chip">
                <span className="sv-chip-lbl">per day</span>{fmt$2(perDay)}
              </span>
              <span className="sv-chip">
                <span className="sv-chip-lbl">per week</span>{fmt$2(perDay * 7)}
              </span>
              <span className="sv-chip">
                <span className="sv-chip-lbl">per month</span>{fmt$2(perDay * 30.44)}
              </span>
            </div>
            {data?.byVice?.length > 0 && (
              <div className="sv-chips" style={{ marginTop: 12 }}>
                {data.byVice.map(({ vice, savings }) => (
                  <span key={vice.id} className="sv-chip">
                    <span className="sv-chip-lbl">{vice.emoji} {vice.name}</span>{fmt$2(savings.per_day)}/day
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Investment projection cards ── */}
      {!loading && perDay > 0 && (
        <div className="sv-section">
          <div className="sv-section-head">
            <span className="sv-section-title">If you bought assets instead</span>
            <span className="sv-section-sub">
              Investing {fmt$2(perDay)}/day for {horizon} days instead of spending it
            </span>
          </div>
          <div className="sv-invest-grid">
            {investmentCards.map(asset => (
              <div key={asset.key} className="sv-invest-card" style={{ '--asset-c': asset.color }}>
                <div className="sv-invest-top">
                  <span className="sv-invest-icon">{asset.icon}</span>
                  <div>
                    <div className="sv-invest-name">{asset.cardLabel}</div>
                    <div className="sv-invest-rate">{Number.isInteger(asset.rate * 100) ? (asset.rate * 100).toFixed(0) : (asset.rate * 100).toFixed(1)}% annualized</div>
                  </div>
                </div>
                <div className="sv-invest-value">{fmt$0(asset.value)}</div>
                <div className="sv-invest-gain">
                  <span>{fmt$0(asset.gain)} more than cash saved</span>
                  <b>+{asset.gainPct.toFixed(0)}%</b>
                </div>
                <div className="sv-invest-note">{asset.description}</div>
              </div>
            ))}
          </div>
          <p className="sv-disclaimer">
            These are illustrative projections using fixed annualized returns — not live prices or financial advice.
          </p>
        </div>
      )}

      {/* ── Investment projection chart ── */}
      {!loading && perDay > 0 && (
        <div className="sv-section">
          <div className="sv-section-head">
            <span className="sv-section-title">Investment growth comparison</span>
            <span className="sv-section-sub">DCA at {fmt$2(perDay)}/day over {horizon} days</span>
          </div>
          <div className="sv-chart-wrap">
            <Line data={{ labels: chartLabels, datasets: chartDatasets }} options={chartOptions} />
          </div>
        </div>
      )}

      {/* ── Milestone cards ── */}
      <div className="sv-section">
        <div className="sv-section-head">
          <span className="sv-section-title">Milestones</span>
          <span className="sv-section-sub">Click a card to update the projection</span>
        </div>
        <div className="sv-ms-grid">
          {msCards.map(m => (
            <div
              key={m.days}
              className={`sv-ms-card${horizon === m.days ? ' active' : ''}`}
              onClick={() => setHorizon(m.days)}
            >
              <div className="sv-ms-label">{m.label}</div>
              <div className="sv-ms-amount">{fmtBig(m.amount)}</div>
              <div className="sv-ms-date">by {m.date}</div>
              <div className="sv-ms-sub">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── What could you do ── */}
      {!loading && (
        <div className="sv-section">
          <div className="sv-section-head">
            <span className="sv-section-title">What could you do with that?</span>
            <span className="sv-section-sub">
              {fmt$2(perDay)}/day × {horizon} days = {fmt$0(projected)}
            </span>
          </div>
          <div className="sv-buys">
            {affordable.length > 0 && (
              <div className="sv-buys-group">
                <div className="sv-buys-label">✓ Within reach</div>
                {affordable.map(b => (
                  <div key={b.label} className="sv-buy sv-buy-yes">
                    <div>
                      <div className="sv-buy-name">{b.label}</div>
                      <div className="sv-buy-sub">{b.sub}</div>
                    </div>
                    <div className="sv-buy-cost">{fmt$0(b.cost)}</div>
                  </div>
                ))}
              </div>
            )}
            {nextItems.length > 0 && (
              <div className="sv-buys-group">
                <div className="sv-buys-label">Almost there…</div>
                {nextItems.map(b => (
                  <div key={b.label} className="sv-buy sv-buy-soon">
                    <div>
                      <div className="sv-buy-name">{b.label}</div>
                      <div className="sv-buy-sub">{b.sub}</div>
                    </div>
                    <div className="sv-buy-cost sv-buy-cost-locked">{fmt$0(b.cost)}</div>
                  </div>
                ))}
              </div>
            )}
            {affordable.length === 0 && projected < 25 && (
              <p className="text-muted" style={{ padding: '24px 0' }}>
                Log more entries to see personalized suggestions here.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
