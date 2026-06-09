import { useState, useEffect, useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';
import { GoalsSection, CelebOverlay } from './GoalsSection';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const ASSETS = [
  {
    key: 'Cash',
    label: 'Cash saved',
    cardLabel: 'Cash saved',
    rate: 0,
    colorKey: 'muted',
    dash: [5, 3],
    icon: '💵',
    description: 'No market growth, just money not spent',
  },
  {
    key: 'SP500',
    label: 'S&P 500',
    cardLabel: 'S&P 500',
    rate: 0.10,
    colorKey: 'secondary',
    dash: [],
    icon: '📈',
    description: 'Illustrative 10% annualized return',
  },
  {
    key: 'HYSA',
    label: 'High Yield Savings Account',
    cardLabel: 'High Yield Savings Account',
    rate: 0.0425,
    colorKey: 'primary',
    dash: [],
    icon: '🏦',
    description: 'Illustrative 4.25% annualized return',
  },
  {
    key: 'BTC',
    label: 'Bitcoin (BTC)',
    cardLabel: 'Bitcoin',
    rate: 0.40,
    colorKey: 'hot',
    dash: [],
    icon: '₿',
    description: 'Illustrative 40% annualized return',
  },
  {
    key: 'Gold',
    label: 'Gold',
    cardLabel: 'Gold',
    rate: 0.07,
    colorKey: 'warm',
    dash: [],
    icon: '🥇',
    description: 'Illustrative 7% annualized return',
  },
];

const MILESTONES = [
  { days: 365,   label: '1 Year',   sub: '365 days clean' },
  { days: 1825,  label: '5 Years',  sub: '1,825 days clean' },
  { days: 3650,  label: '10 Years', sub: '3,650 days clean' },
  { days: 7300,  label: '20 Years', sub: '7,300 days clean' },
  { days: 10950, label: '30 Years', sub: '10,950 days clean' },
];

const BUYS = [
  { label: 'Coffee run',         sub: 'Local café treat',              cost: 25 },
  { label: 'Nice dinner',        sub: 'For two, with drinks',          cost: 120 },
  { label: 'AirPods Pro',        sub: 'Apple AirPods Pro',             cost: 249 },
  { label: 'Weekend getaway',    sub: 'Airbnb + travel',               cost: 500 },
  { label: 'New iPhone',         sub: 'Latest iPhone Pro',             cost: 999 },
  { label: 'MacBook Air',        sub: 'M4, 16 GB RAM',                 cost: 1299 },
  { label: 'Round-trip flights', sub: 'US → Europe, economy',         cost: 900 },
  { label: 'MacBook Pro',        sub: 'M4 Pro, fully loaded',          cost: 2499 },
  { label: 'E-bike',             sub: 'Premium commuter bike',         cost: 3500 },
  { label: 'Dream vacation',     sub: 'Two weeks abroad',              cost: 4000 },
  { label: 'Down payment fund',  sub: '1 month saved toward a home',  cost: 10000 },
  { label: '10-year milestone',  sub: 'A decade of clean living',      cost: 36500 },
];

const CUSTOM_GOALS_KEY = 'viceTracker.customSavingsGoals.v1';

function normalizeCustomGoals(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((goal, index) => {
      const label = String(goal?.label || '').trim().slice(0, 60);
      const cost = Number(goal?.cost);
      if (!label || !Number.isFinite(cost) || cost <= 0) return null;
      return {
        id: String(goal?.id || `custom-${index}`),
        label,
        sub: 'Custom savings goal',
        cost,
        custom: true,
      };
    })
    .filter(Boolean);
}

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

function withAlpha(color, alpha) {
  const rgba = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${alpha})`;
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1];
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

const CATEGORY_PRESETS = [
  { label: 'Stocks / ETFs',         emoji: '📈', rate: 10,  description: 'Broad market index funds' },
  { label: 'Crypto — Bitcoin',      emoji: '₿',  rate: 40,  description: 'Historical BTC annualized return' },
  { label: 'Crypto — Ethereum',     emoji: '⟠',  rate: 30,  description: 'Historical ETH annualized return' },
  { label: 'Crypto — Other',        emoji: '🪙', rate: 25,  description: 'Altcoin (high risk)' },
  { label: 'Real Estate',           emoji: '🏠', rate: 8,   description: 'Appreciation + rental yield' },
  { label: 'Gold / Precious Metals',emoji: '🥇', rate: 7,   description: 'Historical gold return' },
  { label: 'High-Yield Savings',    emoji: '🏦', rate: 4.25, description: 'Typical HYSA rate (~4.25% APY, varies)' },
  { label: 'Art',                   emoji: '🎨', rate: 7,   description: 'Fine art / Masterworks avg' },
  { label: 'Sneakers / Streetwear', emoji: '👟', rate: 20,  description: 'StockX avg resale appreciation' },
  { label: 'Watches',               emoji: '⌚', rate: 10,  description: 'Luxury watch market avg' },
  { label: 'Trading Cards',         emoji: '🃏', rate: 15,  description: 'Sports cards / collectibles' },
  { label: 'Wine / Whiskey',        emoji: '🍷', rate: 12,  description: 'Fine wine / rare spirits' },
  { label: 'Vintage Cars',          emoji: '🚗', rate: 8,   description: 'Classic car appreciation' },
  { label: 'Custom',                emoji: '📦', rate: 0,   description: '' },
];

export default function Savings() {
  const api = useApi();
  const { vices, theme } = useViceContext();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [horizon, setHorizon] = useState(1825);
  const [customGoals, setCustomGoals] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      return normalizeCustomGoals(JSON.parse(window.localStorage.getItem(CUSTOM_GOALS_KEY) || '[]'));
    } catch {
      return [];
    }
  });
  const [customGoalForm, setCustomGoalForm] = useState({ label: '', cost: '' });
  const [customGoalError, setCustomGoalError] = useState('');

  // Actual savings balance
  const [balance, setBalance] = useState({ balance: 0, updated_at: null });
  const [balanceInput, setBalanceInput] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [balanceSaved, setBalanceSaved] = useState(false);

  // Custom assets (server-backed)
  const [userAssets, setUserAssets] = useState([]);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: '', emoji: '📦', category: 'Stocks / ETFs', annual_return_pct: '10', description: '' });
  const [assetFormError, setAssetFormError] = useState('');
  const [assetSaving, setAssetSaving] = useState(false);

  // Goals state
  const [goals, setGoals] = useState([]);
  const [celebGoal, setCelebGoal] = useState(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalAmt, setGoalAmt] = useState('');
  const [goalError, setGoalError] = useState('');
  const celebratedRef = useRef(new Set());

  // Resolve CSS vars synchronously during render — useMemo runs in the render
  // phase, so by the time this fires the body class is already updated and
  // getComputedStyle returns the correct values for the active theme.
  const chartColors = useMemo(() => {
    if (typeof document === 'undefined') return {
      paper2: '#1a1a1a', ink: '#f5f5f5', ink2: '#d4d4d4', ink3: '#9ca3af',
      rule: 'rgba(232,239,224,0.08)', rule2: 'rgba(232,239,224,0.20)',
      money: '#5ec48a', money2: '#2f8a52', warn: '#d9583a',
    };
    const cs = getComputedStyle(document.body);
    const g = v => cs.getPropertyValue(v).trim();
    return {
      paper2: g('--paper-2') || '#1a1a1a',
      ink:    g('--ink')     || '#f5f5f5',
      ink2:   g('--ink-2')   || '#d4d4d4',
      ink3:   g('--ink-3')   || '#9ca3af',
      rule:   g('--rule')    || 'rgba(232,239,224,0.08)',
      rule2:  g('--rule-2')  || 'rgba(232,239,224,0.20)',
      money:  g('--money')   || '#5ec48a',
      money2: g('--money-2') || '#2f8a52',
      warn:   g('--warn')    || '#d9583a',
    };
  }, [theme]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CUSTOM_GOALS_KEY, JSON.stringify(customGoals));
  }, [customGoals]);

  useEffect(() => {
    api('/api/savings/balance')
      .then(data => {
        setBalance(data);
        setBalanceInput(data.balance > 0 ? String(data.balance) : '');
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api('/api/assets').then(setUserAssets).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api('/api/goals').then(setGoals).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const saved = balance.balance;
    goals.filter(g => !g.completed_at).forEach(g => {
      if (saved >= Number(g.target_amount) && !celebratedRef.current.has(g.id)) {
        celebratedRef.current.add(g.id);
        setCelebGoal(g);
      }
    });
  }, [balance.balance, goals]);

  const handleBalanceSave = async (e) => {
    e.preventDefault();
    setBalanceError('');
    const val = Number(balanceInput);
    if (!Number.isFinite(val) || val < 0) { setBalanceError('Enter a valid dollar amount.'); return; }
    setBalanceSaving(true);
    try {
      const data = await api('/api/savings/balance', {
        method: 'PUT',
        body: JSON.stringify({ balance: val }),
      });
      setBalance(data);
      setBalanceSaved(true);
      setTimeout(() => setBalanceSaved(false), 2500);
    } catch (err) {
      setBalanceError(err.message || 'Could not save. Try again.');
    } finally {
      setBalanceSaving(false);
    }
  };

  const createGoal = async (e) => {
    e.preventDefault();
    setGoalError('');
    try {
      const g = await api('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ title: goalTitle, target_amount: goalAmt }),
      });
      setGoals(gs => [g, ...gs]);
      setGoalTitle(''); setGoalAmt(''); setShowGoalForm(false);
    } catch (err) {
      setGoalError(err.message || 'Could not create goal.');
    }
  };

  const markGoalDone = async (id) => {
    try {
      await api(`/api/goals/${id}/complete`, { method: 'PUT' });
      setGoals(gs => gs.map(g => g.id === id ? { ...g, completed_at: new Date().toISOString() } : g));
      setCelebGoal(null);
    } catch (err) { console.error('markGoalDone failed:', err); }
  };

  const deleteGoal = async (id) => {
    try {
      await api(`/api/goals/${id}`, { method: 'DELETE' });
      setGoals(gs => gs.filter(g => g.id !== id));
    } catch (err) { console.error('deleteGoal failed:', err); }
  };

  const handleAssetCategoryChange = (label) => {
    const preset = CATEGORY_PRESETS.find(p => p.label === label);
    if (preset) {
      setAssetForm(f => ({
        ...f,
        category: label,
        emoji: preset.emoji,
        annual_return_pct: String(preset.rate),
        description: preset.description,
      }));
    }
  };

  const handleAssetSubmit = async (e) => {
    e.preventDefault();
    setAssetFormError('');
    const name = assetForm.name.trim();
    if (!name) { setAssetFormError('Give it a name.'); return; }
    const rate = parseFloat(assetForm.annual_return_pct);
    if (!Number.isFinite(rate) || rate < 0) { setAssetFormError('Enter a valid annual return %.'); return; }
    setAssetSaving(true);
    try {
      const created = await api('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          name,
          emoji: assetForm.emoji || '📦',
          category: assetForm.category,
          annual_return_pct: rate,
          description: assetForm.description.trim(),
        }),
      });
      setUserAssets(prev => [...prev, created]);
      setAssetForm({ name: '', emoji: '📦', category: 'Stocks / ETFs', annual_return_pct: '10', description: '' });
      setAssetModalOpen(false);
    } catch (err) {
      setAssetFormError(err.message || 'Could not save. Try again.');
    } finally {
      setAssetSaving(false);
    }
  };

  const removeUserAsset = async (id) => {
    setUserAssets(prev => prev.filter(a => a.id !== id));
    await api(`/api/assets/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleCustomGoalSubmit = event => {
    event.preventDefault();
    const label = customGoalForm.label.trim();
    const cost = Number(customGoalForm.cost);

    if (!label) {
      setCustomGoalError('Name the thing you want to compare.');
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      setCustomGoalError('Enter a valid dollar amount.');
      return;
    }

    setCustomGoals(goals => [
      ...goals,
      {
        id: `custom-${Date.now()}`,
        label: label.slice(0, 60),
        sub: 'Custom savings goal',
        cost,
        custom: true,
      },
    ]);
    setCustomGoalForm({ label: '', cost: '' });
    setCustomGoalError('');
  };

  const removeCustomGoal = id => {
    setCustomGoals(goals => goals.filter(goal => goal.id !== id));
  };

  const perDay    = data?.per_day || 0;
  const projected = perDay * horizon;
  const assetColors = {
    primary:   '#6a92c4',
    secondary: chartColors.money,
    muted:     chartColors.ink3,
    hot:       chartColors.warn,
    warm:      chartColors.money2,
  };
  const themedAssets = ASSETS.map(asset => ({
    ...asset,
    color: assetColors[asset.colorKey] || chartColors.money,
  }));

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

  const chartDatasets = themedAssets.map(a => ({
    label: a.label,
    data: points.map(d => Math.round(dcaFV(perDay, a.rate, d))),
    borderColor: a.color,
    backgroundColor: withAlpha(a.color, 0.1),
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
        labels: { color: chartColors.ink3, boxWidth: 16, padding: 20, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: chartColors.paper2,
        borderColor: chartColors.rule2,
        borderWidth: 1,
        titleColor: chartColors.ink2,
        bodyColor: chartColors.ink,
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBig(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: {
        grid: { color: chartColors.rule },
        ticks: { color: chartColors.ink3, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: chartColors.rule },
        ticks: { color: chartColors.ink3, callback: v => fmtBig(v) },
      },
    },
  };

  const msCards = MILESTONES.map(m => ({
    ...m,
    amount: perDay * m.days,
    date: new Date(Date.now() + m.days * 86400000)
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  }));

  const allBuyComparisons = [...BUYS, ...customGoals].sort((a, b) => a.cost - b.cost);
  const nextItems  = allBuyComparisons.filter(b => b.cost > projected).slice(0, 3);
  const customGoalCards = customGoals
    .map(goal => {
      const savedPct = goal.cost > 0 ? Math.min(100, (projected / goal.cost) * 100) : 0;
      const remaining = Math.max(0, goal.cost - projected);
      const daysAway = perDay > 0 && remaining > 0 ? Math.ceil(remaining / perDay) : 0;
      return { ...goal, savedPct, remaining, daysAway };
    })
    .sort((a, b) => a.cost - b.cost);
  const builtInInvestmentCards = themedAssets
    .filter(asset => asset.key !== 'Cash')
    .map(asset => {
      const value = dcaFV(perDay, asset.rate, horizon);
      const gain = value - projected;
      const gainPct = projected > 0 ? (gain / projected) * 100 : 0;
      return { ...asset, value, gain, gainPct, custom: false };
    });

  const userAssetCards = userAssets.map(asset => {
    const rate = (asset.annual_return_pct || 0) / 100;
    const value = dcaFV(perDay, rate, horizon);
    const gain = value - projected;
    const gainPct = projected > 0 ? (gain / projected) * 100 : 0;
    return {
      key: `user-${asset.id}`,
      id: asset.id,
      cardLabel: asset.name,
      icon: asset.emoji,
      rate,
      description: asset.description || asset.category,
      color: chartColors.ink2,
      value, gain, gainPct,
      custom: true,
    };
  });

  const investmentCards = [...builtInInvestmentCards, ...userAssetCards];

  if (vices.length === 0) {
    return (
      <main className="main sv-page">
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h2>Add a vice to see your savings</h2>
          <p>Go to <a href="/vices">Vices</a> to add one.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main sv-page">
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
          <div style={{ padding: '12px 0' }}>
            <div className="skeleton" style={{ height: 90, width: 300, borderRadius: 8, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 999 }} />
              <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 999 }} />
              <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 999 }} />
            </div>
          </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="sv-section-sub">
                Investing {fmt$2(perDay)}/day for {horizon} days instead of spending it
              </span>
              <button className="sv-add-asset-btn" onClick={() => setAssetModalOpen(true)} title="Add custom asset">
                + Add asset
              </button>
            </div>
          </div>
          <div className="sv-invest-grid">
            {investmentCards.map(asset => (
              <div key={asset.key} className="sv-invest-card" data-asset={asset.key} style={asset.custom ? { borderColor: 'rgba(212,175,55,0.3)' } : {}}>
                <div className="sv-invest-top">
                  <span className="sv-invest-icon">{asset.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div className="sv-invest-name">{asset.cardLabel}</div>
                    <div className="sv-invest-rate">{Number.isInteger(asset.rate * 100) ? (asset.rate * 100).toFixed(0) : (asset.rate * 100).toFixed(1)}% annualized</div>
                  </div>
                  {asset.custom && (
                    <button
                      className="sv-asset-delete"
                      onClick={() => removeUserAsset(asset.id)}
                      aria-label={`Remove ${asset.cardLabel}`}
                    >×</button>
                  )}
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

      {/* ── What could you do ── */}
      {!loading && (
        <div className="sv-section">
          <div className="sv-section-head">
            <span className="sv-section-title">What could you do with that?</span>
            <span className="sv-section-sub">
              {fmt$2(perDay)}/day × {horizon} days = {fmt$0(projected)}
            </span>
          </div>

          <form className="sv-custom-goal-form" onSubmit={handleCustomGoalSubmit}>
            <div>
              <div className="sv-custom-goal-title">Track your own opportunity cost</div>
              <div className="sv-custom-goal-copy">Add anything you want to compare against your avoided vice spending.</div>
            </div>
            <input
              className="form-input"
              type="text"
              value={customGoalForm.label}
              onChange={event => setCustomGoalForm(form => ({ ...form, label: event.target.value }))}
              placeholder="Thing to save for"
              maxLength={60}
            />
            <input
              className="form-input"
              type="number"
              min="1"
              step="1"
              value={customGoalForm.cost}
              onChange={event => setCustomGoalForm(form => ({ ...form, cost: event.target.value }))}
              placeholder="Cost"
            />
            <button className="btn" type="submit">Add</button>
            {customGoalError && <div className="form-error sv-custom-goal-error">{customGoalError}</div>}
          </form>

          {customGoalCards.length > 0 && (
            <div className="sv-custom-goals">
              {customGoalCards.map(goal => (
                <div key={goal.id} className="sv-custom-goal-card">
                  <div className="sv-custom-goal-main">
                    <div className="sv-buy-name">{goal.label}</div>
                    <div className="sv-buy-sub">
                      {goal.remaining === 0
                        ? 'Goal covered now'
                        : `${fmt$0(goal.remaining)} away${goal.daysAway ? ` • about ${goal.daysAway} more days` : ''}`}
                    </div>
                    <div className="sv-custom-progress"><span style={{ width: `${goal.savedPct}%` }} /></div>
                  </div>
                  <div className="sv-custom-goal-side">
                    <div className="sv-buy-cost">{fmt$0(goal.cost)}</div>
                    <button className="sv-custom-delete" type="button" onClick={() => removeCustomGoal(goal.id)} aria-label={`Remove ${goal.label}`}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sv-buys">
            {nextItems.length > 0 && (
              <div className="sv-buys-group">
                <div className="sv-buys-label">Almost there…</div>
                {nextItems.map(b => (
                  <div key={b.id || b.label} className="sv-buy sv-buy-soon">
                    <div>
                      <div className="sv-buy-name">{b.label}{b.custom && <span className="sv-custom-pill">Custom</span>}</div>
                      <div className="sv-buy-sub">{b.sub}</div>
                    </div>
                    <div className="sv-buy-cost sv-buy-cost-locked">{fmt$0(b.cost)}</div>
                  </div>
                ))}
              </div>
            )}
            {nextItems.length === 0 && projected < 25 && (
              <p className="text-muted" style={{ padding: '24px 0' }}>
                Log more entries to see personalized suggestions here.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Add Asset Modal ── */}
      {assetModalOpen && (
        <div className="sv-modal-backdrop" onClick={() => setAssetModalOpen(false)}>
          <div className="sv-modal" onClick={e => e.stopPropagation()}>
            <div className="sv-modal-head">
              <span className="sv-modal-title">Add asset to compare</span>
              <button className="sv-modal-close" onClick={() => setAssetModalOpen(false)}>×</button>
            </div>
            <p className="sv-modal-sub">Stocks, crypto, real estate, art, sneakers, collectibles — anything you might buy instead.</p>
            <form onSubmit={handleAssetSubmit}>
              <div className="sv-modal-field">
                <label className="sv-modal-label">Category</label>
                <select
                  className="form-input"
                  value={assetForm.category}
                  onChange={e => handleAssetCategoryChange(e.target.value)}
                >
                  {CATEGORY_PRESETS.map(p => (
                    <option key={p.label} value={p.label}>{p.emoji} {p.label}</option>
                  ))}
                </select>
              </div>
              <div className="sv-modal-row">
                <div className="sv-modal-field" style={{ flex: '0 0 56px' }}>
                  <label className="sv-modal-label">Icon</label>
                  <input
                    className="form-input sv-emoji-input"
                    value={assetForm.emoji}
                    onChange={e => setAssetForm(f => ({ ...f, emoji: e.target.value }))}
                    maxLength={2}
                    placeholder="📦"
                  />
                </div>
                <div className="sv-modal-field" style={{ flex: 1 }}>
                  <label className="sv-modal-label">Name</label>
                  <input
                    className="form-input"
                    value={assetForm.name}
                    onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Apple Stock, Rolex GMT, Rookie Cards"
                    maxLength={80}
                    autoFocus
                  />
                </div>
              </div>
              <div className="sv-modal-field">
                <label className="sv-modal-label">Expected annual return %</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={assetForm.annual_return_pct}
                  onChange={e => setAssetForm(f => ({ ...f, annual_return_pct: e.target.value }))}
                  placeholder="10"
                />
                <div className="sv-modal-hint">Use historical averages or your own estimate. 0% = no growth (just holding the item).</div>
              </div>
              <div className="sv-modal-field">
                <label className="sv-modal-label">Note <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <input
                  className="form-input"
                  value={assetForm.description}
                  onChange={e => setAssetForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. 10-year avg, my estimate"
                  maxLength={200}
                />
              </div>
              {assetFormError && <div className="form-error" style={{ marginBottom: 12 }}>{assetFormError}</div>}
              <div className="sv-modal-actions">
                <button type="button" className="btn ghost" onClick={() => setAssetModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={assetSaving}>
                  {assetSaving ? 'Saving…' : 'Add to my comparison'}
                </button>
              </div>
            </form>
          </div>
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
            <Line key={theme} data={{ labels: chartLabels, datasets: chartDatasets }} options={chartOptions} />
          </div>
        </div>
      )}

      {/* ── Milestone cards (time horizon) ── */}
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

      {/* ── Savings target milestones ── */}
      {!loading && perDay > 0 && (
        <div className="sv-section">
          <div className="sv-section-head">
            <span className="sv-section-title">Savings targets</span>
            <span className="sv-section-sub">How long until you reach each level</span>
          </div>
          <div className="sv-ms-grid">
            {[1000, 5000, 10000, 25000, 50000].map(target => {
              const daysNeeded = perDay > 0 ? Math.ceil(target / perDay) : Infinity;
              const reached = projected >= target;
              const reachDate = new Date(Date.now() + daysNeeded * 86400000)
                .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              return (
                <div key={target} className={`sv-ms-card${reached ? ' active' : ''}`}>
                  <div className="sv-ms-label">{reached ? '✓ Reached' : `~${daysNeeded < 365 ? Math.round(daysNeeded) + ' days' : (daysNeeded / 365).toFixed(1) + ' yrs'}`}</div>
                  <div className="sv-ms-amount">{fmt$0(target)}</div>
                  {!reached && <div className="sv-ms-date">by {reachDate}</div>}
                  <div className="sv-ms-sub">{target >= 10000 ? 'Significant milestone' : target >= 5000 ? 'Major savings' : 'First milestone'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Actual Savings Balance ── */}
      <div className="panel sv-balance-panel">
        <div className="panel-head">
          <span className="panel-title">My Savings Balance</span>
          {balance.updated_at && (
            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
              Updated {new Date(balance.updated_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <p className="sv-balance-note">
          Enter money you've actually moved into savings. This unlocks the $100, $500, and $1,000 Saved badges.
        </p>
        <div className="sv-balance-body">
          <div className="sv-balance-amount">{fmt$0(balance.balance)}</div>
          <form className="sv-balance-form" onSubmit={handleBalanceSave}>
            <input
              type="number"
              min="0"
              step="0.01"
              className="sv-balance-input"
              value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              placeholder="0.00"
            />
            <button className="btn btn-primary" type="submit" disabled={balanceSaving} style={{ flexShrink: 0 }}>
              {balanceSaving ? 'Saving…' : balanceSaved ? '✓ Saved' : 'Update'}
            </button>
          </form>
          {balanceError && <p className="form-error" style={{ marginTop: 8 }}>{balanceError}</p>}
        </div>
        <div className="sv-balance-badges">
          {[100, 500, 1000].map(target => {
            const pct = Math.min(100, (balance.balance / target) * 100);
            const earned = balance.balance >= target;
            return (
              <div key={target} className={`sv-bb-item${earned ? ' earned' : ''}`}>
                <div className="sv-bb-label">
                  <span className="sv-bb-name">{earned ? '✓' : `${pct.toFixed(0)}%`} ${target.toLocaleString()} saved</span>
                </div>
                <div className="sv-bb-bar">
                  <div className="sv-bb-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <GoalsSection
        goals={goals}
        savings={balance.balance}
        avgDailySpend={data?.per_day || 0}
        showForm={showGoalForm}
        setShowForm={setShowGoalForm}
        goalTitle={goalTitle}
        setGoalTitle={setGoalTitle}
        goalAmt={goalAmt}
        setGoalAmt={setGoalAmt}
        goalError={goalError}
        onCreateGoal={createGoal}
        onDeleteGoal={deleteGoal}
      />

      {celebGoal && (
        <CelebOverlay
          goal={celebGoal}
          onComplete={() => markGoalDone(celebGoal.id)}
          onDismiss={() => setCelebGoal(null)}
        />
      )}
    </main>
  );
}
