'use client';

import { useEffect, useMemo, useState } from 'react';

// ============ User avatar — illustrated character ============
function UserAvatar({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="av-bg" x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#232320" />
          <stop offset="100%" stopColor="#131311" />
        </linearGradient>
        <linearGradient id="av-ring" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(199,161,74,0.65)" />
          <stop offset="100%" stopColor="rgba(120,90,30,0.25)" />
        </linearGradient>
        <clipPath id="av-clip">
          <circle cx="16" cy="16" r="14.5" />
        </clipPath>
      </defs>

      {/* Background disc */}
      <circle cx="16" cy="16" r="16" fill="url(#av-bg)" />

      <g clipPath="url(#av-clip)">
        {/* Body / torso */}
        <ellipse cx="16" cy="31" rx="11" ry="8" fill="#1C3A5A" opacity="0.75" />
        {/* Collar V */}
        <path d="M13 25.5 L15.5 23 L16 23.8 L16.5 23 L19 25.5" stroke="#2A5A8A" strokeWidth="1.1" fill="none" opacity="0.85" />

        {/* Neck */}
        <rect x="14.2" y="20.5" width="3.6" height="3" rx="1" fill="#C28660" />

        {/* Head */}
        <ellipse cx="16" cy="15.5" rx="7.5" ry="8.5" fill="#C88B64" />
        {/* Facial shading */}
        <ellipse cx="16" cy="16.5" rx="5" ry="6" fill="#B87C52" opacity="0.22" />

        {/* Hair — full cap */}
        <ellipse cx="16" cy="8.5" rx="7.5" ry="5" fill="#18120C" />
        <path
          d="M8.5 14 C8 10 9.5 6.5 16 6.5 C22.5 6.5 24 10 23.5 14 C23.5 11.5 22 9 16 9 C10 9 8.5 11.5 8.5 14Z"
          fill="#18120C"
        />
        {/* Hairline fade */}
        <path d="M10 13.5 C10 10.5 12.5 8.5 16 8.5 C19.5 8.5 22 10.5 22 13.5" stroke="#18120C" strokeWidth="2.5" fill="none" />

        {/* Eyes */}
        <ellipse cx="13.2" cy="14.8" rx="1.3" ry="1.4" fill="#1A0E08" />
        <ellipse cx="18.8" cy="14.8" rx="1.3" ry="1.4" fill="#1A0E08" />
        {/* Eye whites */}
        <ellipse cx="13.2" cy="14.8" rx="1.3" ry="1.4" fill="white" opacity="0.08" />
        {/* Pupils + highlight */}
        <circle cx="13.5" cy="14.5" r="0.4" fill="rgba(255,255,255,0.55)" />
        <circle cx="19.1" cy="14.5" r="0.4" fill="rgba(255,255,255,0.55)" />

        {/* Subtle smile */}
        <path d="M13.8 18 C14.8 19.2 17.2 19.2 18.2 18" stroke="#8A4E2A" strokeWidth="0.85" strokeLinecap="round" fill="none" />
      </g>

      {/* Gold ring border */}
      <circle cx="16" cy="16" r="14.5" stroke="url(#av-ring)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// ============ Vice catalogue ============
const VICES = [
  { id: "beer",     name: "Beer",        unit: "beer",        unitPlural: "beers",        glyph: "B", color: "#d4a04a", defaultQty: 1.4, defaultPrice: 5.78, qtyMin: 0.25, qtyMax: 10, qtyStep: 0.25, priceMax: 18, priceStep: 0.25 },
  { id: "cigs",     name: "Cigarettes",  unit: "cigarette",   unitPlural: "cigarettes",   glyph: "C", color: "#7a8392", defaultQty: 8,   defaultPrice: 0.65, qtyMin: 1,    qtyMax: 40, qtyStep: 1,    priceMax: 2,  priceStep: 0.05 },
  { id: "coffee",   name: "Coffee shop", unit: "drink",       unitPlural: "drinks",       glyph: "K", color: "#8a5530", defaultQty: 1.1, defaultPrice: 5.25, qtyMin: 0.25, qtyMax: 5,  qtyStep: 0.25, priceMax: 12, priceStep: 0.25 },
  { id: "doordash", name: "Delivery",    unit: "order",       unitPlural: "orders",       glyph: "D", color: "#d04a3a", defaultQty: 0.4, defaultPrice: 28,   qtyMin: 0.1,  qtyMax: 3,  qtyStep: 0.1,  priceMax: 80, priceStep: 1 },
  { id: "vape",     name: "Vape pods",   unit: "pod",         unitPlural: "pods",         glyph: "V", color: "#8a6ac4", defaultQty: 0.3, defaultPrice: 22,   qtyMin: 0.1,  qtyMax: 2,  qtyStep: 0.1,  priceMax: 60, priceStep: 1 },
];

function money(n, { cents = false, abbr = false } = {}) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (abbr && v >= 10000) {
    return sign + "$" + (v / 1000).toFixed(v >= 100000 ? 0 : 1) + "k";
  }
  if (cents) return sign + "$" + v.toFixed(2);
  return sign + "$" + Math.round(v).toLocaleString();
}

function splitMoney(n) {
  const v = Math.max(0, Math.round(n * 100) / 100);
  const dollars = Math.floor(v);
  const cents = Math.round((v - dollars) * 100);
  return {
    dollars: dollars.toLocaleString(),
    cents: cents.toString().padStart(2, "0"),
  };
}

function addDays(d, days) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function fmtDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

// ============ Sidebar ============
function Sidebar({ viceId, setViceId, perDay, collapsed, setCollapsed, page, setPage, activeTheme, setTheme }) {
  const navItems = [
    { id: "dashboard",   label: "Dashboard" },
    { id: "log",         label: "Log entry" },
    { id: "savings",     label: "Savings" },
    { id: "milestones",  label: "Milestones" },
    { id: "connections", label: "Connections" },
    { id: "settings",    label: "Settings" },
  ];
  return (
    <aside className={"side" + (collapsed ? " collapsed" : "")} data-screen-label="Sidebar">
      <div className="side-top">
        <div className="brand">
          <div className="brand-mark">v</div>
          {!collapsed && (
            <div className="brand-text">
              <div className="brand-name">Vice <i style={{ fontStyle: "italic", color: "var(--ink-3)" }}>Spending</i></div>
              <div className="brand-sub">Savings · No. 03</div>
            </div>
          )}
        </div>
        <button className="side-collapse" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label="Toggle sidebar">
          {collapsed ? "\u203A" : "\u2039"}
        </button>
      </div>

      <div>
        {!collapsed && <div className="side-label">Your vices</div>}
        <div className="vice-list">
          {VICES.map(v => {
            const active = v.id === viceId;
            const daily = active ? perDay : v.defaultQty * v.defaultPrice;
            return (
              <div key={v.id} className={"vice-row" + (active ? " active" : "")} onClick={() => setViceId(v.id)} title={collapsed ? v.name : undefined} style={{ "--vice-c": v.color }}>
                <div className="vice-glyph">{v.glyph}</div>
                <div className="vice-name">{v.name}</div>
                <div className="vice-meta">${daily.toFixed(2)}/d</div>
              </div>
            );
          })}
          <div className="vice-row" style={{ color: "var(--ink-3)" }} title={collapsed ? "Add a vice" : undefined}>
            <div className="vice-glyph" style={{ borderStyle: "dashed", color: "var(--ink-3)" }}>+</div>
            <div className="vice-name" style={{ fontWeight: 400, color: "var(--ink-3)" }}>Add a vice</div>
            <div className="vice-meta">⌘N</div>
          </div>
        </div>
      </div>

      <div>
        {!collapsed && <div className="side-label">Navigate</div>}
        <div className="nav">
          {navItems.map(item => (
            <button key={item.id}
              type="button"
              className={"nav-item" + (page === item.id ? " active" : "")}
              title={collapsed ? item.label : undefined}
              onClick={() => setPage(item.id)}>
              <span className="dot" />
              <span className="nav-item-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!collapsed && (
        <div>
          <div className="side-label">Theme</div>
          <div className="theme-pills">
            {["emerald", "mint", "plum", "noir"].map(theme => (
              <button
                key={theme}
                type="button"
                className={"theme-pill" + (activeTheme === theme ? " active" : "")}
                onClick={() => setTheme(theme)}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="me">
        <UserAvatar size={32} />
        {!collapsed && (
          <div className="me-text">
            <div className="me-name">Jake D.</div>
            <div className="me-sub">61 days clean · streak</div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ============ Hero amount, articulated ============
function HeroAmount({ total }) {
  const { dollars, cents } = splitMoney(total);
  return (
    <div className="hero-amount-wrap">
      <div className="hero-amount" aria-label={`${money(total, { cents: true })}`}>
        <span className="dollar">$</span>
        <span>{dollars}</span>
        <span className="cents">.{cents}</span>
      </div>
    </div>
  );
}

// ============ Chart (area + bar) ============
function Chart({ days, dailySaving, style, accent }) {
  const W = 800, H = 280, padL = 44, padR = 16, padT = 16, padB = 30;
  const N = 60; // resolution

  const points = useMemo(() => {
    const arr = [];
    for (let i = 0; i <= N; i++) {
      const d = Math.round((i / N) * days);
      arr.push({ d, v: d * dailySaving });
    }
    return arr;
  }, [days, dailySaving]);

  const maxV = points[points.length - 1].v || 1;
  const niceMax = niceCeil(maxV);

  const x = (i) => padL + (i / N) * (W - padL - padR);
  const y = (v) => padT + (1 - v / niceMax) * (H - padT - padB);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const areaPath = linePath + ` L ${x(N).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  // y gridlines
  const ticks = 4;
  const yTicks = [];
  for (let t = 0; t <= ticks; t++) {
    const v = (niceMax * t) / ticks;
    yTicks.push({ v, y: y(v) });
  }

  // x labels: 6 evenly spaced
  const xLabels = [];
  const xCount = 5;
  for (let t = 0; t <= xCount; t++) {
    const i = Math.round((t / xCount) * N);
    const d = points[i].d;
    xLabels.push({ x: x(i), label: d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}yr` });
  }

  // milestones markers
  const milestoneDays = [30, 90, 365, 1825].filter(d => d <= days);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
          <pattern id="dotPattern" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="var(--ink-4)" opacity="0.5" />
          </pattern>
        </defs>

        {/* grid */}
        {yTicks.map((t, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={t.y} y2={t.y}
            stroke="var(--rule)" strokeWidth="1" strokeDasharray={i === 0 ? "" : "2 4"} />
        ))}

        {/* y labels */}
        {yTicks.map((t, i) => (
          <text key={i} x={padL - 8} y={t.y + 3}
            fontSize="10.5" fontFamily="var(--mono)" fill="var(--ink-4)" textAnchor="end">
            {money(t.v, { abbr: true })}
          </text>
        ))}

        {style === "area" ? (
          <>
            <path d={areaPath} fill="url(#areaGrad)" />
            <path d={linePath} fill="none" stroke={accent} strokeWidth="2" />
          </>
        ) : (
          // bar style: stepped columns
          (() => {
            const barN = 28;
            const bars = [];
            const bw = (W - padL - padR) / barN - 3;
            for (let i = 0; i < barN; i++) {
              const d = Math.round(((i + 1) / barN) * days);
              const v = d * dailySaving;
              const bx = padL + (i / barN) * (W - padL - padR);
              const by = y(v);
              bars.push(
                <rect key={i} x={bx + 1.5} y={by} width={bw} height={Math.max(0, y(0) - by)} fill={accent} opacity={0.85 - (1 - (i + 1) / barN) * 0.55} rx="1" />
              );
            }
            return bars;
          })()
        )}

        {/* milestone markers */}
        {style === "area" && milestoneDays.map((md, i) => {
          const idx = Math.round((md / days) * N);
          const px = x(idx);
          const py = y(points[idx].v);
          return (
            <g key={md}>
              <line x1={px} x2={px} y1={py} y2={y(0)} stroke="var(--rule-2)" strokeDasharray="2 3" />
              <circle cx={px} cy={py} r="3.5" fill={accent} />
              <circle cx={px} cy={py} r="6.5" fill="none" stroke={accent} strokeOpacity="0.25" />
            </g>
          );
        })}

        {/* x labels */}
        {xLabels.map((t, i) => (
          <text key={i} x={t.x} y={H - 10}
            fontSize="10.5" fontFamily="var(--mono)" fill="var(--ink-4)" textAnchor="middle">
            {t.label}
          </text>
        ))}

        {/* annotation: final value */}
        <g transform={`translate(${x(N) - 4}, ${y(points[N].v) - 14})`}>
          <text fontSize="11" fontFamily="var(--mono)" fill="var(--ink-2)" textAnchor="end">
            {money(points[N].v, { abbr: true })}
          </text>
        </g>
      </svg>
    </div>
  );
}

function niceCeil(n) {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / pow;
  let m;
  if (norm <= 1) m = 1;
  else if (norm <= 2) m = 2;
  else if (norm <= 2.5) m = 2.5;
  else if (norm <= 5) m = 5;
  else m = 10;
  return m * pow;
}

// ============ Milestones ============
function Milestones({ dailySaving, days, setDays, vice }) {
  const today = useMemo(() => new Date(), []);
  const rows = [
    { d: 30, label: "First month", note: "habit forms" },
    { d: 90, label: "Three months", note: "a weekend trip" },
    { d: 365, label: "One year", note: "you'd notice" },
    { d: 730, label: "Two years", note: "a used car" },
    { d: 1825, label: "Five years", note: "a small Roth IRA" },
  ];
  return (
    <ul className="milestones">
      {rows.map(r => {
        const active = days === r.d;
        return (
          <li key={r.d} className={"ms" + (active ? " active" : "")} onClick={() => setDays(r.d)}>
            <div className="ms-date">
              <b>{r.d}d</b>
              {fmtDate(addDays(today, r.d))}
            </div>
            <div>
              <div className="ms-label">{r.label} <em>· {r.note}</em></div>
            </div>
            <div className="ms-amt">{money(dailySaving * r.d, { abbr: true })}</div>
          </li>
        );
      })}
    </ul>
  );
}

// ============ Category bars: spend by vice ============
function CategoryBars({ activeViceId, setViceId, currentQty, currentPrice }) {
  // Each vice contributes its monthly spend. Active vice uses live qty/price
  // (so the bar moves as you slide), inactive vices use their defaults.
  const rows = VICES.map(v => {
    const isActive = v.id === activeViceId;
    const daily = isActive ? (currentQty * currentPrice) : (v.defaultQty * v.defaultPrice);
    return { ...v, daily, monthly: daily * 30, active: isActive };
  });
  const max = Math.max(...rows.map(r => r.monthly), 1);
  const total = rows.reduce((s, r) => s + r.monthly, 0);
  const niceMaxV = niceCeil(max);

  // viewBox dims
  const H = 240, padT = 18, padB = 0;
  const chartH = 180;

  return (
    <div className="cat-wrap">
      <div className="cat-head">
        <div className="cat-totals">
          <div className="cat-total-label">Total monthly outlay</div>
          <div className="cat-total-val">{money(total)}<span className="small">/mo</span></div>
        </div>
        <div className="cat-totals">
          <div className="cat-total-label">Annualised</div>
          <div className="cat-total-val">{money(total * 12, { abbr: true })}<span className="small">/yr</span></div>
        </div>
        <div className="cat-totals">
          <div className="cat-total-label">Tracking</div>
          <div className="cat-total-val">{rows.length}<span className="small">vices</span></div>
        </div>
      </div>

      <div className="cat-chart">
        <div className="cat-bars" role="list">
          {rows.map(r => {
            const h = Math.max(2, (r.monthly / niceMaxV) * chartH);
            return (
              <div key={r.id} className={"cat-bar-col" + (r.active ? " active" : "")} role="listitem"
                onClick={() => setViceId(r.id)}
                style={{ "--bar-c": r.color }}
                title={`${r.name} · ${money(r.monthly)}/mo`}>
                <div className="cat-bar-val">{money(r.monthly)}</div>
                <div className="cat-bar-track" style={{ height: chartH + "px" }}>
                  <div className="cat-bar-fill" style={{ height: h + "px" }} />
                </div>
                <div className="cat-bar-meta">
                  <div className="cat-bar-glyph">{r.glyph}</div>
                  <div className="cat-bar-name">{r.name}</div>
                  <div className="cat-bar-sub">${r.daily.toFixed(2)}/d</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ Invested-instead ============
// Static fallback CAGRs used when live fetch fails or is loading.
const ASSETS = [
  { id: "spy",   ticker: "SPY",   name: "S&P 500 ETF",        sub: "large-cap blend · 10y",  cagr: 0.130, kind: "etf",    featured: true },
  { id: "voo",   ticker: "VOO",   name: "Vanguard 500",       sub: "S&P 500 · low-cost",     cagr: 0.131, kind: "etf" },
  { id: "qqq",   ticker: "QQQ",   name: "Nasdaq 100 ETF",     sub: "tech-heavy · 10y",       cagr: 0.180, kind: "etf" },
  { id: "btc",   ticker: "BTC",   name: "Bitcoin",            sub: "volatile · 10y",         cagr: 0.550, kind: "crypto", featured: true },
  { id: "gold",  ticker: "GOLD",  name: "Gold",               sub: "spot price · 10y",       cagr: 0.085, kind: "metal",  featured: true },
  { id: "hysa",  ticker: "HYSA",  name: "High-yield savings", sub: "Marcus / Ally · APY",    cagr: 0.043, kind: "cash",   featured: true },
];

// Yahoo Finance tickers for live CAGR fetch (HYSA has no ticker — stays static)
const ASSET_TICKERS = { spy: "SPY", voo: "VOO", qqq: "QQQ", btc: "BTC-USD", gold: "GLD" };

// FV of daily deposits at annual rate, compounded daily.
function investedFV(dailyDeposit, days, annualRate) {
  if (days <= 0) return 0;
  const d = Math.pow(1 + annualRate, 1 / 365) - 1;
  if (Math.abs(d) < 1e-12) return dailyDeposit * days;
  return dailyDeposit * ((Math.pow(1 + d, days) - 1) / d);
}

function Sparkline({ dailyDeposit, days, cagr, accent, win }) {
  const W = 96, H = 28;
  const N = 24;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = Math.round((i / N) * days);
    pts.push(investedFV(dailyDeposit, t, cagr));
  }
  const max = pts[pts.length - 1] || 1;
  const x = (i) => (i / N) * W;
  const y = (v) => H - (v / max) * (H - 4) - 2;
  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = line + ` L ${x(N).toFixed(1)} ${H} L 0 ${H} Z`;
  const stroke = win ? accent : "var(--ink-3)";
  const fill = win ? accent : "var(--ink-3)";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <path d={area} fill={fill} opacity="0.12" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" />
      <circle cx={x(N)} cy={y(pts[N])} r="2.5" fill={stroke} />
    </svg>
  );
}

function useAssetCAGRs() {
  const [cagrMap, setCagrMap] = useState({});
  const [priceStatus, setPriceStatus] = useState("loading");
  useEffect(() => {
    let active = true;
    Promise.allSettled(
      Object.entries(ASSET_TICKERS).map(([id, ticker]) =>
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=10y&interval=1y`)
          .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(json => {
            const result = json?.chart?.result?.[0];
            const closes = (
              result?.indicators?.adjclose?.[0]?.adjclose ??
              result?.indicators?.quote?.[0]?.close ?? []
            ).filter(v => v != null && isFinite(v));
            if (closes.length < 2) throw new Error("insufficient data");
            const cagr = Math.pow(closes[closes.length - 1] / closes[0], 1 / (closes.length - 1)) - 1;
            return { id, cagr };
          })
      )
    ).then(results => {
      if (!active) return;
      const map = {};
      let live = 0;
      results.forEach(r => { if (r.status === "fulfilled") { map[r.value.id] = r.value.cagr; live++; } });
      setCagrMap(map);
      setPriceStatus(live > 0 ? "live" : "fallback");
    });
    return () => { active = false; };
  }, []);
  return { cagrMap, priceStatus };
}

function InvestedInstead({ dailySaving, days, total, accent }) {
  const { cagrMap, priceStatus } = useAssetCAGRs();

  const rows = useMemo(() => ASSETS.map(a => {
    const cagr = cagrMap[a.id] ?? a.cagr;
    return { ...a, cagr, value: investedFV(dailySaving, days, cagr) };
  }).sort((a, b) => b.value - a.value), [cagrMap, dailySaving, days]);

  const max = rows[0]?.value || 1;
  const winId = rows[0]?.id;

  return (
    <div className="invested">
      <div className="invested-head">
        <div>
          <div className="invested-eyebrow">DCA · {money(dailySaving, { cents: true })}/day for {days} days · principal {money(total)}</div>
        </div>
        <div className="invested-legend" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {priceStatus === "loading" && <span>fetching live rates…</span>}
          {priceStatus === "live" && (
            <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--money)", display: "inline-block", flexShrink: 0 }} /><span style={{ color: "var(--money)" }}>live · 10yr actual</span></>
          )}
          {priceStatus === "fallback" && <span>past returns · not advice</span>}
        </div>
      </div>
      <div className="inv-table">
        <div className="inv-thead">
          <div>Asset</div>
          <div>CAGR</div>
          <div>Growth</div>
          <div style={{ textAlign: "right" }}>Would be worth</div>
          <div style={{ textAlign: "right" }}>Gain</div>
        </div>
        {rows.map(r => {
          const gain = r.value - total;
          const win = r.id === winId;
          const bar = Math.max(2, (r.value / max) * 100);
          return (
            <div key={r.id} className={"inv-row" + (win ? " win" : "") + (r.featured ? " inv-row--featured" : "")}>
              <div className="inv-asset">
                <div className="inv-ticker">{r.ticker}</div>
                <div>
                  <div className="inv-name">{r.name}</div>
                  <div className="inv-sub">{r.sub}</div>
                </div>
              </div>
              <div className="inv-cagr">
                <span className="cagr-num">{(r.cagr * 100).toFixed(1)}%</span>
                <span className="cagr-unit">/yr</span>
              </div>
              <div className="inv-spark">
                <Sparkline dailyDeposit={dailySaving} days={days} cagr={r.cagr} accent={accent} win={win} />
              </div>
              <div className="inv-val">
                <div className="inv-val-big">{money(r.value, { abbr: r.value >= 10000 })}</div>
                <div className="inv-bar"><span style={{ width: bar + "%", background: win ? accent : "var(--ink-4)" }} /></div>
              </div>
              <div className="inv-gain">
                <div className={"inv-gain-num " + (gain >= 0 ? "up" : "down")}>
                  {gain >= 0 ? "+" : "−"}{money(Math.abs(gain), { abbr: Math.abs(gain) >= 10000 })}
                </div>
                <div className="inv-gain-pct">
                  {gain >= 0 ? "+" : "−"}{Math.abs((gain / Math.max(1, total)) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Unlocks ============
function Unlocks({ total, vice }) {
  // Each unlock: name, detail, computeFn
  const items = [
    {
      name: "Round-trip flights to Europe",
      detail: "avg $720 economy",
      val: Math.floor(total / 720),
      suffix: "trips",
    },
    {
      name: "Months of average US rent",
      detail: "$1,650/mo",
      val: (total / 1650).toFixed(1),
      suffix: "months",
    },
    {
      name: "Invested at 7% for 10 years",
      detail: "S&P average return",
      val: money(total * Math.pow(1.07, 10), { abbr: true }),
      suffix: null,
    },
    {
      name: "Years of a $12 streaming bundle",
      detail: "Netflix + Spotify + 1",
      val: (total / (12 * 12)).toFixed(1),
      suffix: "years",
    },
    {
      name: "A respectable used bicycle",
      detail: "or four nicer ones",
      val: Math.max(1, Math.floor(total / 600)),
      suffix: "bikes",
    },
  ];
  return (
    <div className="unlocks">
      {items.map((it, i) => (
        <div className="unlock" key={i}>
          <div>
            <div className="unlock-name">{it.name}</div>
            <div className="unlock-detail">{it.detail}</div>
          </div>
          <div className="unlock-val">
            <span className="num">{it.val}</span>
            {it.suffix && <span className="suffix">{it.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ Connections page (Stripe Financial Connections) ============
function ConnectionsPage({ vice }) {
  const [state, setState] = useState("connected"); // "empty" | "connecting" | "connected"

  return (
    <main className="main" data-screen-label="Connections" style={{ "--vice-c": vice.color }}>
      <div className="crumbs">
        <span>Personal Oracle</span>
        <span className="sep">/</span>
        <span style={{ color: vice.color, fontWeight: 500 }}>{vice.name}</span>
        <span className="sep">/</span>
        <span className="here">Connections</span>
        <span className="pill"><span className="dot" /> beta · Stripe Financial Connections</span>
      </div>

      <section className="hero" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 56, alignItems: "start", paddingTop: 24, marginBottom: 32 }}>
        <div>
          <div className="hero-eyebrow"><b>Connect</b> · auto-categorize spending</div>
          <div className="hero-headline" style={{ maxWidth: "18ch" }}>
            Stop typing. <em>Let your bank do the logging.</em>
          </div>
          <p style={{ fontSize: 16, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: "52ch", margin: "0 0 24px" }}>
            Link a checking account, debit, or credit card via Stripe. We scan new transactions for the merchants you've told us are "vices" — beer, smokes, coffee runs — and log them automatically. Read-only. We never move money.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setState("connecting")}>
              {state === "connected" ? "Link another account" : "Connect with Stripe"}
              <span className="arrow">→</span>
            </button>
            <button className="btn ghost" style={{ borderColor: "var(--rule-2)" }}>How it works</button>
          </div>
        </div>

        {/* Trust card */}
        <div className="inputs" style={{ padding: 22 }}>
          <div className="inputs-title" style={{ marginBottom: 14 }}>
            <span>Privacy &amp; safety</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.08em" }}>SOC 2 · PCI</span>
          </div>
          {[
            ["Read-only access", "We can see transactions. We can't move money, change settings, or charge anything."],
            ["Powered by Stripe", "Same infrastructure used by Shopify, Lyft, and Substack. We never see your bank password."],
            ["Disconnect anytime", "One click. We delete the access token, the linked-account record, and stop pulling new data."],
            ["Local categorization", "Transaction matching happens server-side under your user ID. Merchants aren't shared with anyone."],
          ].map(([h, b], i) => (
            <div key={i} className="field" style={{ paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{h}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--money)" }}>✓</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>{b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* State switcher (demo) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <span style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-4)", marginRight: 8 }}>Preview state</span>
        <div className="seg">
          <button className={state === "empty" ? "on" : ""} onClick={() => setState("empty")}>Not connected</button>
          <button className={state === "connecting" ? "on" : ""} onClick={() => setState("connecting")}>Connecting</button>
          <button className={state === "connected" ? "on" : ""} onClick={() => setState("connected")}>Connected</button>
        </div>
      </div>

      {state === "empty" && <EmptyConnections onConnect={() => setState("connecting")} />}
      {state === "connecting" && <ConnectingState onDone={() => setState("connected")} />}
      {state === "connected" && <ConnectedAccounts />}

    </main>
  );
}

function EmptyConnections({ onConnect }) {
  return (
    <section className="panel" style={{ textAlign: "center", padding: "56px 28px" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 16,
        background: "var(--paper-3)", border: "1px dashed var(--rule-2)",
        display: "grid", placeItems: "center",
        margin: "0 auto 22px",
        fontFamily: "var(--serif)", fontSize: 30, fontStyle: "italic", color: "var(--ink-3)"
      }}>$</div>
      <div className="panel-title" style={{ marginBottom: 8 }}>No accounts connected yet</div>
      <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55, maxWidth: "44ch", margin: "0 auto 22px" }}>
        Link one account and we'll catch every beer at every bar from now on. Most users connect a debit card or their main checking.
      </p>
      <button className="btn" onClick={onConnect}>Connect an account<span className="arrow">→</span></button>
    </section>
  );
}

function ConnectingState({ onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    "Opening Stripe Connect…",
    "Authenticating with your bank…",
    "Selecting accounts to share…",
    "Pulling last 90 days of transactions…",
    "Categorizing against your vices…",
  ];
  useEffect(() => {
    if (step >= steps.length) { setTimeout(onDone, 400); return; }
    const t = setTimeout(() => setStep(s => s + 1), 700);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <section className="panel" style={{ padding: "32px 28px" }}>
      <div className="panel-title" style={{ marginBottom: 18 }}>Setting up your connection</div>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {steps.map((s, i) => (
          <li key={i} style={{
            display: "grid", gridTemplateColumns: "24px 1fr auto",
            gap: 14, alignItems: "center",
            padding: "12px 0",
            borderTop: i === 0 ? "none" : "1px solid var(--rule)",
            opacity: i > step ? 0.4 : 1,
            transition: "opacity 0.2s"
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: i < step ? "var(--money)" : i === step ? "var(--money-soft)" : "var(--paper-3)",
              color: i < step ? "var(--paper)" : "var(--money)",
              display: "grid", placeItems: "center",
              fontFamily: "var(--mono)", fontSize: 11, fontWeight: 500
            }}>
              {i < step ? "✓" : i + 1}
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-2)", fontFamily: "var(--serif)", letterSpacing: "-0.005em" }}>
              {s}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-4)" }}>
              {i < step ? "done" : i === step ? "…" : ""}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ConnectedAccounts() {
  // Example connected accounts
  const accounts = [
    { id: "chase",   name: "Chase Debit",         last4: "4291", type: "Checking",   status: "active",  pulled: 142 },
    { id: "amex",    name: "Amex Gold",           last4: "1003", type: "Credit",     status: "active",  pulled: 87  },
  ];

  // Per-vice rules (merchants we know about)
  const rules = [
    { vice: "Beer",        color: "#d4a04a", merchants: ["Joe's Bar", "Total Wine", "Untappd Pay", "+ 4 more"], confidence: 0.92, lastMatch: "2h ago" },
    { vice: "Coffee shop", color: "#8a5530", merchants: ["Blue Bottle", "Starbucks", "Devoción", "+ 12 more"], confidence: 0.97, lastMatch: "this morning" },
    { vice: "Delivery",    color: "#d04a3a", merchants: ["DoorDash", "Uber Eats", "Grubhub", "Caviar"],         confidence: 0.99, lastMatch: "yesterday" },
    { vice: "Cigarettes",  color: "#7a8392", merchants: ["7-Eleven (filtered)", "Bodega lookups"],              confidence: 0.62, lastMatch: "3 days ago" },
    { vice: "Vape pods",   color: "#8a6ac4", merchants: ["Juul.com", "Vapor Authority"],                        confidence: 0.88, lastMatch: "5 days ago" },
  ];

  return (
    <>
      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-head">
          <div>
            <div className="panel-title">Connected accounts</div>
            <div className="panel-sub">Read-only via Stripe Financial Connections. We pull every 4 hours.</div>
          </div>
          <div className="panel-sub" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>last sync · 14m ago</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {accounts.map((a, i) => (
            <div key={a.id} style={{
              display: "grid", gridTemplateColumns: "44px 1fr auto auto",
              gap: 16, alignItems: "center",
              padding: "16px 0",
              borderTop: i === 0 ? "none" : "1px solid var(--rule)"
            }}>
              <div style={{
                width: 44, height: 32, borderRadius: 6,
                background: "linear-gradient(135deg, var(--money), var(--money-2))",
                display: "grid", placeItems: "center",
                fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, color: "var(--paper)",
                letterSpacing: "0.04em"
              }}>{a.type === "Credit" ? "CC" : "DR"}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
                  •••• {a.last4} · {a.type}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                  {a.pulled}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>transactions</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "4px 10px", borderRadius: 999,
                  background: "var(--money-soft)", color: "var(--money)",
                  fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.04em"
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--money)" }} /> {a.status}
                </div>
                <button className="ghost" style={{ padding: "5px 10px", fontSize: 11, background: "transparent", border: "1px solid var(--rule-2)", color: "var(--ink-3)", borderRadius: 6, cursor: "pointer", fontFamily: "var(--sans)" }}>Disconnect</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Auto-categorisation rules</div>
            <div className="panel-sub">Which merchants we'll count as which vice. Edit to teach the matcher.</div>
          </div>
          <button className="ghost" style={{ padding: "6px 12px", fontSize: 12, background: "transparent", border: "1px solid var(--rule-2)", color: "var(--ink-2)", borderRadius: 8, cursor: "pointer", fontFamily: "var(--sans)" }}>+ Add rule</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {rules.map((r, i) => (
            <div key={r.vice} style={{
              display: "grid", gridTemplateColumns: "180px 1fr 120px 100px",
              gap: 18, alignItems: "center",
              padding: "16px 0",
              borderTop: i === 0 ? "none" : "1px solid var(--rule)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, boxShadow: `0 0 0 3px ${r.color}22` }} />
                <span style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em" }}>{r.vice}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {r.merchants.map((m, j) => (
                  <span key={j} style={{
                    fontSize: 11.5, fontFamily: "var(--mono)",
                    padding: "3px 9px", borderRadius: 4,
                    background: "var(--paper-3)", color: "var(--ink-2)",
                    border: "1px solid var(--rule)",
                  }}>{m}</span>
                ))}
              </div>
              <div>
                <div style={{
                  height: 4, borderRadius: 2, background: "var(--rule)",
                  overflow: "hidden", marginBottom: 4
                }}>
                  <div style={{
                    width: (r.confidence * 100) + "%", height: "100%",
                    background: r.color
                  }} />
                </div>
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", display: "flex", justifyContent: "space-between" }}>
                  <span>{Math.round(r.confidence * 100)}%</span>
                  <span style={{ color: "var(--ink-4)" }}>match</span>
                </div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
                {r.lastMatch}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ============ Stub pages (placeholder content for unbuilt screens) ============
const STUB_PAGES = {
  dashboard: {
    title: "Dashboard",
    lede: "A daily-at-a-glance view: streak count, today's vice spend, this week's progress vs your average, and quick-log shortcuts for the vices you log most.",
    bullets: [
      "Streak counter for each tracked vice — days since last logged entry.",
      "Today's running total plus a weekly sparkline.",
      "Quick-log buttons sized to your top three vices.",
      "Glanceable comparison: this week vs. your 4-week rolling average.",
      "Surface upcoming milestones — \"3 days until 90-day streak\".",
    ],
  },
  log: {
    title: "Log entry",
    lede: "The fast path for recording a vice. One screen, one tap, done — designed to take less effort than the vice itself usually does.",
    bullets: [
      "Pick a vice (defaults to most recent), set quantity, confirm price.",
      "Date defaults to now; can backdate with a swipe.",
      "Optional context: location, mood, trigger — for pattern analysis later.",
      "Receipt photo upload — OCR to auto-fill amount when bank link isn't connected.",
      "Logs feed into the savings projection and dashboard streak in real time.",
    ],
  },
  milestones: {
    title: "Milestones",
    lede: "All your savings milestones in one timeline — past wins on the left, the next target on the right. Celebrate hitting them with shareable cards.",
    bullets: [
      "Per-vice timeline: day 1, first $100, first month, first $1k, first year.",
      "Shareable milestone cards — pre-rendered images for social or text.",
      "Custom goals: \"Save $500 by July\" with daily required pace.",
      "Comparison view: \"At this pace, you'll hit $5k by …\".",
      "Optional accountability buddy — DM them when you hit a milestone.",
    ],
  },
  settings: {
    title: "Settings",
    lede: "Account, vice configuration, notification preferences, and data controls. Sign in with email to save data across devices.",
    bullets: [
      "Sign in / sign up via magic link (no passwords).",
      "Add, edit, or archive vices — set custom name, unit, default price.",
      "Notification preferences — daily prompt, weekly summary, milestone alerts.",
      "Data: export everything as CSV, delete account.",
      "Optional: connect a debit card via Plaid for auto-categorisation (read-only).",
      "Theme + display preferences.",
    ],
  },
};

function StubPage({ title, lede, bullets, vice }) {
  return (
    <main className="main" data-screen-label={title} style={{ "--vice-c": vice.color }}>
      <div className="crumbs">
        <span>Personal Oracle</span>
        <span className="sep">/</span>
        <span style={{ color: vice.color, fontWeight: 500 }}>{vice.name}</span>
        <span className="sep">/</span>
        <span className="here">{title}</span>
        <span className="pill"><span className="dot" /> coming soon · v1.1</span>
      </div>

      <section className="hero" style={{ gridTemplateColumns: "1fr", gap: 24, alignItems: "start", paddingTop: 24 }}>
        <div>
          <div className="hero-eyebrow">
            <b>{title}</b> · placeholder
          </div>
          <div className="hero-headline" style={{ maxWidth: "22ch" }}>
            <em>{title}</em> isn't wired up in this prototype yet.
          </div>
          <p style={{ fontSize: 16, color: "var(--ink-2)", lineHeight: 1.55, maxWidth: "54ch", margin: "0 0 28px" }}>
            {lede}
          </p>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <div>
            <div className="panel-title">What this page will do</div>
            <div className="panel-sub">Spec for the real build.</div>
          </div>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 0 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{
              display: "grid", gridTemplateColumns: "auto 1fr",
              gap: 18, alignItems: "baseline",
              padding: "16px 0", borderTop: i === 0 ? "none" : "1px solid var(--rule)"
            }}>
              <div style={{
                fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-4)",
                letterSpacing: "0.16em", minWidth: 32
              }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 400, color: "var(--ink-2)", letterSpacing: "-0.01em", lineHeight: 1.45 }}>
                {b}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

// ============ App ============
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "emerald",
  "chartStyle": "area",
  "viceId": "beer",
  "showSidebar": true
}/*EDITMODE-END*/;

export default function ViceSpendingPage() {
  const [t, setTweaks] = useState(TWEAK_DEFAULTS);
  const setTweak = (key, value) => setTweaks(prev => ({ ...prev, [key]: value }));
  const vice = VICES.find(v => v.id === t.viceId) || VICES[0];

  const [days, setDays] = useState(365);
  const [qty, setQty] = useState(vice.defaultQty);
  const [price, setPrice] = useState(vice.defaultPrice);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("side-collapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("side-collapsed", collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);
  const [page, setPage] = useState(() => {
    try { return localStorage.getItem("page") || "savings"; } catch { return "savings"; }
  });
  useEffect(() => {
    try { localStorage.setItem("page", page); } catch {}
  }, [page]);

  // when vice changes, reset to its defaults
  useEffect(() => {
    setQty(vice.defaultQty);
    setPrice(vice.defaultPrice);
  }, [t.viceId]);

  // theme class on body
  useEffect(() => {
    document.body.className = "theme-" + t.theme;
  }, [t.theme]);

  const dailySaving = qty * price;
  const total = dailySaving * days;

  const reset = () => {
    setDays(365);
    setQty(vice.defaultQty);
    setPrice(vice.defaultPrice);
  };

  const accent = useMemo(() => {
    const map = {
      emerald: "#5ec48a",
      mint:    "#b88a2a",
      plum:    "#e8b85a",
      noir:    "#5ec48a",
    };
    return map[t.theme] || "#5ec48a";
  }, [t.theme]);

  return (
    <>
    <ViceSpendingStyles />
    <div className={"shell" + (!t.showSidebar ? " no-side" : collapsed ? " collapsed" : "")}>
      {t.showSidebar && (
        <Sidebar viceId={t.viceId} setViceId={(id) => setTweak("viceId", id)} perDay={dailySaving} collapsed={collapsed} setCollapsed={setCollapsed} page={page} setPage={setPage} activeTheme={t.theme} setTheme={(theme) => setTweak("theme", theme)} />
      )}

      {page === "connections" && <ConnectionsPage vice={vice} />}
      {page !== "savings" && page !== "connections" && (
        <StubPage vice={vice} {...STUB_PAGES[page]} />
      )}

      {page === "savings" && (
      <main className="main" data-screen-label="Savings" style={{ "--vice-c": vice.color }}>
        <div className="crumbs">
          <span>Personal Oracle</span>
          <span className="sep">/</span>
          <span style={{ color: vice.color, fontWeight: 500 }}>{vice.name}</span>
          <span className="sep">/</span>
          <span className="here">Savings projection</span>
          <span className="pill"><span className="dot" /> live · last logged 2h ago</span>
        </div>

        {/* ============ HERO ============ */}
        <section className="hero" data-screen-label="Hero">
          <div>
            <div className="hero-eyebrow">
              If you stayed off <b>{vice.name.toLowerCase()}</b> · projected over <b>{days} days</b>
            </div>
            <div className="hero-headline">
              You'd quietly put away <em>this much</em> by {fmtDate(addDays(new Date(), days))}.
            </div>
            <HeroAmount total={total} />
            <div className="hero-foot">
              <span className="chip"><span className="glyph">×</span> {qty.toFixed(qty < 10 ? 2 : 0)} {qty === 1 ? vice.unit : vice.unitPlural}/day</span>
              <span className="chip"><span className="glyph">@</span> {money(price, { cents: true })} each</span>
              <span className="chip"><span className="glyph">=</span> {money(dailySaving, { cents: true })}/day</span>
              <span style={{ color: "var(--ink-3)" }}>· that's {money(dailySaving * 30)} a month, without thinking about it.</span>
            </div>
          </div>

          <div className="inputs">
            <div className="inputs-title">
              <span>Adjust the assumptions</span>
              <button className="reset" onClick={reset}>Reset</button>
            </div>

            <div className="field">
              <div className="field-head">
                <span className="field-label">Project for</span>
                <span className="field-val">{days}<span className="unit"> days</span></span>
              </div>
              <input className="slider" type="range" min={7} max={1825} step={1} value={days} onChange={e => setDays(+e.target.value)} />
              <div className="ticks"><span>1w</span><span>1mo</span><span>6mo</span><span>1y</span><span>3y</span><span>5y</span></div>
            </div>

            <div className="field">
              <div className="field-head">
                <span className="field-label">{vice.unitPlural} per day</span>
                <span className="field-val">{qty.toFixed(qty < 10 ? 2 : 0)}</span>
              </div>
              <input className="slider" type="range" min={vice.qtyMin} max={vice.qtyMax} step={vice.qtyStep} value={qty} onChange={e => setQty(+e.target.value)} />
              <div className="ticks"><span>{vice.qtyMin}</span><span>{vice.qtyMax}</span></div>
            </div>

            <div className="field">
              <div className="field-head">
                <span className="field-label">Price per {vice.unit}</span>
                <span className="field-val">{money(price, { cents: true })}</span>
              </div>
              <input className="slider" type="range" min={vice.priceStep} max={vice.priceMax} step={vice.priceStep} value={price} onChange={e => setPrice(+e.target.value)} />
              <div className="ticks"><span>{money(vice.priceStep, { cents: true })}</span><span>{money(vice.priceMax, { cents: true })}</span></div>
            </div>
          </div>
        </section>

        {/* ============ CATEGORY BARS ============ */}
        <section className="panel" data-screen-label="Spend by category">
          <div className="panel-head">
            <div>
              <div className="panel-title">Spend by category</div>
              <div className="panel-sub">All your tracked vices, monthly. Tap a bar to switch which one you're projecting.</div>
            </div>
            <div className="panel-sub" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
              live · {VICES.length} categories
            </div>
          </div>
          <CategoryBars activeViceId={t.viceId} setViceId={(id) => setTweak("viceId", id)} currentQty={qty} currentPrice={price} />
        </section>

        {/* ============ CHART ============ */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Cumulative savings <span className="small">{days} days</span></div>
              <div className="panel-sub">Each marker is a milestone you can hover or click in the timeline below.</div>
            </div>
            <div className="seg">
              <button className={t.chartStyle === "area" ? "on" : ""} onClick={() => setTweak("chartStyle", "area")}>Area</button>
              <button className={t.chartStyle === "bars" ? "on" : ""} onClick={() => setTweak("chartStyle", "bars")}>Bars</button>
            </div>
          </div>
          <Chart days={days} dailySaving={dailySaving} style={t.chartStyle} accent={accent} />
        </section>

        {/* ============ INVESTED INSTEAD ============ */}
        <section className="panel" data-screen-label="Invested instead">
          <div className="panel-head">
            <div>
              <div className="panel-title">If you'd invested it instead</div>
              <div className="panel-sub">{money(dailySaving, { cents: true })}/day dollar-cost-averaged into each, compounded daily.</div>
            </div>
            <div className="panel-sub" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
              {days}d horizon
            </div>
          </div>
          <InvestedInstead dailySaving={dailySaving} days={days} total={total} accent={accent} />
        </section>

        {/* ============ TIMELINE + UNLOCKS ============ */}
        <section className="grid-2">
          <div className="panel" data-screen-label="Milestones">
            <div className="panel-head">
              <div>
                <div className="panel-title">Future you</div>
                <div className="panel-sub">Tap a row to set the projection horizon.</div>
              </div>
              <div className="panel-sub" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                today · {fmtDate(new Date())}
              </div>
            </div>
            <Milestones dailySaving={dailySaving} days={days} setDays={setDays} vice={vice} />
          </div>

          <div className="panel" data-screen-label="Unlocks">
            <div className="panel-head">
              <div>
                <div className="panel-title">What that buys</div>
                <div className="panel-sub">{money(total)} translated into things you might actually want.</div>
              </div>
            </div>
            <Unlocks total={total} vice={vice} />
          </div>
        </section>

        {/* CTA */}
        <div className="cta-row" style={{ marginTop: 28 }}>
          <button className="btn">Set a savings goal <span className="arrow">→</span></button>
          <button className="btn ghost" style={{ borderColor: "var(--rule-2)" }}>Share this projection</button>
          <button className="btn ghost" style={{ borderColor: "var(--rule-2)", marginLeft: "auto", color: "var(--ink-3)" }}>Manage vices</button>
        </div>
      </main>
      )}
    </div>
    </>
  );
}


function ViceSpendingStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Geist:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap');
  .app-navbar,
  .harley-chat-toggle,
  .harley-chat-window { display: none !important; }
  .app-main { padding-top: 0 !important; }

  :root {
    --sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif;
    --serif: "Newsreader", "Iowan Old Style", "Hoefler Text", Georgia, serif;
    --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  }

  /* ============ Theme: EMERALD (default — deep forest, monochrome green) ============ */
  body.theme-emerald {
    --paper:    #0a1f17;
    --paper-2:  #11281f;
    --paper-3:  #1a3328;
    --ink:      #e8efe0;
    --ink-2:    #c8d4be;
    --ink-3:    #8e9a85;
    --ink-4:    #4d5a4f;
    --rule:    rgba(232,239,224,0.08);
    --rule-2:  rgba(232,239,224,0.20);
    --money:    #5ec48a;     /* forest mint that pops on dark forest bg */
    --money-2:  #2f8a52;
    --money-soft: rgba(94,196,138,0.14);
    --warn:     #d9583a;
    --good:     #5ec48a;
    --shadow:   0 1px 0 rgba(232,239,224,0.04) inset, 0 12px 30px rgba(0,0,0,0.40);
  }
  /* ============ Theme: MINT (light — pale mint + emerald + gold) ============ */
  body.theme-mint {
    --paper:    #eef4e8;
    --paper-2:  #e2eaD8;
    --paper-3:  #d2dcc4;
    --ink:      #0c2a1f;
    --ink-2:    #234538;
    --ink-3:    #5e7868;
    --ink-4:    #8a9c8d;
    --rule:    rgba(12,42,31,0.12);
    --rule-2:  rgba(12,42,31,0.22);
    --money:    #b88a2a;
    --money-2:  #d4a84a;
    --money-soft: rgba(184,138,42,0.12);
    --warn:     #a83a2a;
    --good:     #2f6d4a;
    --shadow:   0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(12,42,31,0.08);
  }
  /* ============ Theme: PLUM (deep aubergine + gold) ============ */
  body.theme-plum {
    --paper:    #19102a;
    --paper-2:  #211532;
    --paper-3:  #2c1e42;
    --ink:      #f0e6dc;
    --ink-2:    #d4c4b8;
    --ink-3:    #9a8aa4;
    --ink-4:    #5f4e6a;
    --rule:    rgba(240,230,220,0.08);
    --rule-2:  rgba(240,230,220,0.20);
    --money:    #e8b85a;
    --money-2:  #c89a3a;
    --money-soft: rgba(232,184,90,0.14);
    --warn:     #d96a6a;
    --good:     #7ec4a4;
    --shadow:   0 1px 0 rgba(240,230,220,0.04) inset, 0 12px 30px rgba(0,0,0,0.40);
  }
  /* ============ Theme: NOIR (near-black + emerald + gold) ============ */
  body.theme-noir {
    --paper:    #0d100f;
    --paper-2:  #141816;
    --paper-3:  #1c211f;
    --ink:      #ece8dc;
    --ink-2:    #c9c4b4;
    --ink-3:    #807c70;
    --ink-4:    #4d4a40;
    --rule:    rgba(236,232,220,0.08);
    --rule-2:  rgba(236,232,220,0.20);
    --money:    #5ec48a;
    --money-2:  #d4a84a;
    --money-soft: rgba(94,196,138,0.14);
    --warn:     #e07a5e;
    --good:     #5ec48a;
    --shadow:   0 1px 0 rgba(236,232,220,0.04) inset, 0 12px 30px rgba(0,0,0,0.40);
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    min-height: 100vh;
  }

  /* ============ Shell ============ */
  .shell {
    display: grid;
    grid-template-columns: 280px 1fr;
    min-height: 100vh;
    transition: grid-template-columns 0.28s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .shell.collapsed { grid-template-columns: 68px 1fr; }
  .shell.no-side { grid-template-columns: 1fr; }

  /* Sidebar */
  .side {
    border-right: 1px solid var(--rule);
    padding: 22px 18px 22px;
    display: flex; flex-direction: column; gap: 26px;
    background: var(--paper);
    position: sticky; top: 0; height: 100vh; overflow-y: auto; overflow-x: hidden;
    transition: padding 0.28s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .side.collapsed { padding: 22px 10px 22px; }

  .side-top {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px;
  }
  .side.collapsed .side-top { flex-direction: column; gap: 14px; }
  .side-collapse {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--rule-2); background: transparent;
    color: var(--ink-3); cursor: pointer;
    display: grid; place-items: center;
    font-family: var(--mono); font-size: 14px;
    transition: color 0.12s, background 0.12s;
    flex-shrink: 0;
  }
  .side-collapse:hover { color: var(--ink); background: var(--paper-2); }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .brand-mark {
    width: 32px; height: 32px; border-radius: 8px;
    background: var(--money); color: var(--paper);
    display: grid; place-items: center;
    font-family: var(--serif); font-style: italic; font-weight: 500; font-size: 19px;
    box-shadow: 0 0 0 3px var(--money-soft);
  }
  .brand-name {
    font-family: var(--serif); font-size: 19px; font-weight: 500; letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .brand-sub {
    font-size: 11px; color: var(--ink-3); letter-spacing: 0.12em; text-transform: uppercase;
    margin-top: 1px;
    white-space: nowrap;
  }

  /* collapsed: hide labels, keep glyphs */
  .side.collapsed .brand-text,
  .side.collapsed .vice-name,
  .side.collapsed .vice-meta,
  .side.collapsed .side-label,
  .side.collapsed .nav-item-label,
  .side.collapsed .me-text {
    display: none;
  }
  .side.collapsed .vice-row {
    grid-template-columns: 1fr; justify-items: center; padding: 8px 0;
  }
  .side.collapsed .nav-item { justify-content: center; padding: 8px 0; }
  .side.collapsed .me { justify-content: center; }

  .side-label {
    font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ink-3); margin-bottom: 10px; font-weight: 500;
  }

  .vice-list { display: flex; flex-direction: column; gap: 2px; }
  .vice-row {
    display: grid; grid-template-columns: 28px 1fr auto; align-items: center;
    gap: 12px; padding: 10px 10px; border-radius: 8px; cursor: pointer;
    color: var(--ink-2);
    transition: background 0.12s;
    position: relative;
  }
  .vice-row:hover { background: var(--paper-2); }
  .vice-row.active {
    background: var(--paper-2); color: var(--ink);
  }
  .vice-row.active::before {
    content: ""; position: absolute; left: 0; top: 8px; bottom: 8px;
    width: 3px; border-radius: 2px;
    background: var(--vice-c, var(--money));
  }
  .vice-glyph {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--rule-2);
    display: grid; place-items: center;
    font-family: var(--serif); font-size: 14px; font-style: italic;
    color: var(--ink-2); background: var(--paper-2);
    flex-shrink: 0;
    position: relative;
  }
  .vice-glyph::after {
    content: ""; position: absolute; right: -3px; top: -3px;
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--vice-c, var(--money));
    border: 2px solid var(--paper);
  }
  .vice-row.active .vice-glyph {
    background: var(--vice-c, var(--money));
    color: #fff;
    border-color: var(--vice-c, var(--money));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--vice-c, var(--money)) 14%, transparent);
  }
  .vice-row.active .vice-glyph::after { display: none; }
  .vice-name { font-size: 13.5px; font-weight: 500; letter-spacing: -0.005em; }
  .vice-meta { font-size: 11px; color: var(--ink-3); font-family: var(--mono); }

  /* Nav buttons — now real <button> elements */
  .nav { display: flex; flex-direction: column; gap: 1px; }
  .nav-item {
    padding: 8px 10px; font-size: 13px; color: var(--ink-3); cursor: pointer;
    border-radius: 6px; display: flex; align-items: center; gap: 10px;
    background: transparent; border: none;
    font-family: inherit; text-align: left; width: 100%;
    transition: color 0.12s, background 0.12s;
  }
  .nav-item:hover { color: var(--ink-2); background: var(--paper-2); }
  .nav-item.active { color: var(--ink); font-weight: 500; background: var(--paper-2); }
  .nav-item .dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: 0.4; }
  .nav-item.active .dot { background: var(--money); opacity: 1; box-shadow: 0 0 0 3px var(--money-soft); }

  .me {
    margin-top: auto; display: flex; align-items: center; gap: 10px;
    padding-top: 18px; border-top: 1px solid var(--rule);
  }
  .avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--paper-3); color: var(--ink);
    display: grid; place-items: center;
    font-size: 12px; font-weight: 500;
    border: 1px solid var(--rule-2);
  }
  .me-name { font-size: 13px; font-weight: 500; }
  .me-sub { font-size: 11px; color: var(--ink-3); }

  /* Main */
  .main { padding: 36px 56px 64px; max-width: 1180px; }
  @media (max-width: 1100px) { .main { padding: 28px 32px 48px; } }

  .crumbs {
    display: flex; align-items: center; gap: 10px;
    font-size: 12px; color: var(--ink-3);
    margin-bottom: 22px;
  }
  .crumbs .sep { opacity: 0.5; }
  .crumbs .here { color: var(--ink); }
  .crumbs .pill {
    margin-left: auto; font-family: var(--mono); font-size: 11px;
    padding: 4px 10px; border: 1px solid var(--rule-2); border-radius: 999px;
    color: var(--ink-2); background: var(--paper); letter-spacing: 0.04em;
  }
  .crumbs .pill .dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--vice-c, var(--money)); margin-right: 6px; vertical-align: 1px;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--vice-c, var(--money)) 14%, transparent);
    animation: pulse 2.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--vice-c, var(--money)) 14%, transparent); }
    50%      { box-shadow: 0 0 0 6px transparent; }
  }

  /* ============ Hero ============ */
  .hero {
    border-top: 1px solid var(--rule);
    padding-top: 28px;
    display: grid; grid-template-columns: 1.4fr 1fr; gap: 56px;
    align-items: end;
    margin-bottom: 44px;
  }
  .hero-eyebrow {
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 500; margin-bottom: 18px;
  }
  .hero-eyebrow b { color: var(--ink); font-weight: 500; }
  .hero-headline {
    font-family: var(--serif); font-weight: 400;
    font-size: 38px; line-height: 1.08; letter-spacing: -0.02em;
    color: var(--ink-2);
    max-width: 14ch;
    margin-bottom: 18px;
  }
  .hero-headline em {
    font-style: italic; color: var(--ink);
  }
  .hero-amount-wrap { display: flex; align-items: baseline; gap: 4px; margin-bottom: 14px; }
  .hero-amount {
    font-family: var(--serif); font-weight: 400;
    font-size: 132px; line-height: 0.9; letter-spacing: -0.045em;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .hero-amount .dollar {
    font-size: 64px; vertical-align: 0.55em;
    font-family: var(--serif); font-style: italic;
    color: var(--money); margin-right: 4px;
    letter-spacing: -0.02em;
  }
  .hero-amount .cents {
    font-size: 28px; color: var(--ink-3);
    font-family: var(--mono); font-weight: 300;
    letter-spacing: 0; margin-left: 6px;
    vertical-align: 1.1em;
  }
  .hero-foot {
    font-size: 13px; color: var(--ink-3);
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  }
  .hero-foot .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    background: var(--paper-2); color: var(--ink-2);
    font-family: var(--mono); font-size: 11.5px;
  }
  .hero-foot .chip .glyph { color: var(--ink-3); font-family: var(--serif); font-style: italic; font-size: 12px; }

  /* Right column — inputs */
  .inputs {
    background: var(--paper-2);
    border: 1px solid var(--rule);
    border-radius: 12px;
    padding: 18px 20px;
    position: relative;
    overflow: hidden;
  }
  .inputs::before {
    content: ""; position: absolute; inset: 0;
    background: radial-gradient(circle at 100% 0%, var(--money-soft), transparent 60%);
    pointer-events: none;
  }
  .inputs > * { position: relative; }
  .inputs-title {
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 500;
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px;
  }
  .inputs-title .reset {
    font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ink-3); cursor: pointer; background: none; border: none; padding: 0;
    font-family: var(--sans);
  }
  .inputs-title .reset:hover { color: var(--ink); }
  .field { padding: 10px 0; border-top: 1px solid var(--rule); }
  .field:first-of-type { border-top: none; padding-top: 4px; }
  .field-head {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 8px;
  }
  .field-label { font-size: 12.5px; color: var(--ink-2); font-weight: 500; }
  .field-val {
    font-family: var(--mono); font-size: 14px; color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .field-val .unit { color: var(--ink-3); font-size: 11px; margin-left: 2px; }
  .slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 18px; background: transparent; cursor: pointer; margin: 0;
  }
  .slider:focus { outline: none; }
  .slider::-webkit-slider-runnable-track {
    height: 2px; background: var(--rule-2); border-radius: 2px;
  }
  .slider::-moz-range-track {
    height: 2px; background: var(--rule-2); border-radius: 2px;
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--money); border: 2px solid var(--paper-2);
    box-shadow: 0 0 0 1px var(--money), 0 0 0 4px var(--money-soft);
    margin-top: -6px;
  }
  .slider::-moz-range-thumb {
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--money); border: 2px solid var(--paper-2);
    box-shadow: 0 0 0 1px var(--money), 0 0 0 4px var(--money-soft);
  }
  .ticks {
    display: flex; justify-content: space-between;
    font-family: var(--mono); font-size: 10px; color: var(--ink-4);
    margin-top: 4px; letter-spacing: 0.04em;
  }

  /* ============ Chart card ============ */
  .panel {
    border: 1px solid var(--rule);
    border-radius: 12px;
    background: var(--paper-2);
    padding: 22px 24px;
    margin-bottom: 24px;
  }
  .panel-head {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 18px;
  }
  .panel-title {
    font-family: var(--serif); font-size: 22px; letter-spacing: -0.015em;
    font-weight: 500;
  }
  .panel-title .small {
    font-family: var(--sans); font-size: 11px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--ink-3); margin-left: 10px;
    font-weight: 500;
  }
  .panel-sub { font-size: 12.5px; color: var(--ink-3); }

  .seg {
    display: inline-flex; padding: 3px; background: var(--paper-2);
    border-radius: 8px; border: 1px solid var(--rule);
  }
  .seg button {
    font: inherit; font-size: 11.5px; padding: 5px 11px;
    background: transparent; color: var(--ink-3); border: none; cursor: pointer;
    border-radius: 5px; letter-spacing: 0.02em;
    font-family: var(--sans);
  }
  .seg button.on { background: var(--paper); color: var(--ink); box-shadow: 0 1px 0 var(--rule); }

  .chart-wrap { position: relative; height: 280px; }
  .chart-wrap svg { display: block; width: 100%; height: 100%; }

  /* axis labels under the chart */
  .axis {
    display: flex; justify-content: space-between;
    font-family: var(--mono); font-size: 10.5px; color: var(--ink-4);
    margin-top: 8px;
  }

  /* ============ Category bars ============ */
  .cat-wrap { }
  .cat-head {
    display: grid; grid-template-columns: repeat(3, auto);
    gap: 36px; padding: 4px 0 18px;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 22px;
    justify-content: start;
  }
  .cat-totals {}
  .cat-total-label {
    font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 500; margin-bottom: 8px;
  }
  .cat-total-val {
    font-family: var(--serif); font-size: 26px; font-weight: 500;
    letter-spacing: -0.02em; color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .cat-total-val .small {
    font-family: var(--mono); font-size: 11px; color: var(--ink-3);
    margin-left: 6px; letter-spacing: 0;
  }

  .cat-chart {
    position: relative;
  }

  .cat-bars {
    display: grid; grid-template-columns: repeat(5, 1fr);
    gap: 18px;
    align-items: end;
    position: relative;
  }
  .cat-bars::before {
    content: ""; position: absolute; left: 0; right: 0; top: 20px;
    height: 180px;
    background-image:
      linear-gradient(to top, var(--rule) 1px, transparent 1px);
    background-size: 100% 25%;
    background-position: 0 100%;
    pointer-events: none;
  }

  .cat-bar-col {
    display: flex; flex-direction: column; align-items: center;
    cursor: pointer;
    position: relative;
  }

  .cat-bar-val {
    font-family: var(--mono); font-size: 11px;
    color: var(--ink-3);
    margin-bottom: 6px; height: 14px;
    letter-spacing: 0.02em;
    transition: color 0.12s;
  }
  .cat-bar-col.active .cat-bar-val { color: var(--ink); font-weight: 500; }

  .cat-bar-track {
    width: 100%; max-width: 80px;
    display: flex; align-items: flex-end;
    justify-content: center;
  }
  .cat-bar-fill {
    width: 100%;
    background: var(--bar-c);
    opacity: 0.45;
    border-radius: 4px 4px 0 0;
    transition: opacity 0.16s, height 0.3s cubic-bezier(0.2, 0.7, 0.2, 1), transform 0.12s;
    position: relative;
  }
  .cat-bar-col:hover .cat-bar-fill { opacity: 0.7; }
  .cat-bar-col.active .cat-bar-fill {
    opacity: 1;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--bar-c) 18%, transparent);
  }
  .cat-bar-col.active .cat-bar-fill::after {
    content: ""; position: absolute; top: -6px; left: 50%;
    transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 5px solid var(--bar-c);
  }

  .cat-bar-meta {
    margin-top: 12px;
    display: flex; flex-direction: column; align-items: center;
    gap: 4px;
    text-align: center;
  }
  .cat-bar-glyph {
    width: 22px; height: 22px; border-radius: 4px;
    border: 1px solid var(--rule-2);
    display: grid; place-items: center;
    font-family: var(--serif); font-size: 12px; font-style: italic;
    color: var(--ink-3); background: var(--paper-3);
    transition: all 0.12s;
  }
  .cat-bar-col.active .cat-bar-glyph {
    background: var(--bar-c); color: #fff; border-color: var(--bar-c);
  }
  .cat-bar-name { font-size: 12px; font-weight: 500; color: var(--ink-2); }
  .cat-bar-col.active .cat-bar-name { color: var(--ink); }
  .cat-bar-sub {
    font-family: var(--mono); font-size: 10px; color: var(--ink-4);
    letter-spacing: 0.02em;
  }

  /* ============ Invested instead ============ */
  .invested { }
  .invested-head {
    display: flex; align-items: baseline; justify-content: space-between;
    margin-bottom: 14px;
  }
  .invested-eyebrow {
    font-family: var(--mono); font-size: 11px; color: var(--ink-3);
    letter-spacing: 0.02em;
  }
  .invested-legend {
    font-size: 10.5px; color: var(--ink-4); letter-spacing: 0.12em;
    text-transform: uppercase; font-weight: 500;
  }
  .inv-table { display: flex; flex-direction: column; }
  .inv-thead, .inv-row {
    display: grid;
    grid-template-columns: minmax(180px, 1.4fr) 80px 110px 1.2fr 110px;
    align-items: center;
    gap: 18px;
    padding: 14px 0;
    border-top: 1px solid var(--rule);
  }
  .inv-thead {
    border-top: none; padding: 0 0 10px;
    font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 500;
  }
  .inv-row { transition: background 0.12s; border-radius: 4px; }
  .inv-row:hover { background: var(--paper-2); }

  .inv-asset { display: grid; grid-template-columns: 50px 1fr; gap: 12px; align-items: center; }
  .inv-ticker {
    font-family: var(--mono); font-size: 11px; font-weight: 500;
    letter-spacing: 0.04em;
    padding: 5px 6px; border: 1px solid var(--rule-2); border-radius: 4px;
    color: var(--ink-2); background: var(--paper); text-align: center;
  }
  .inv-row.win .inv-ticker {
    background: var(--ink); color: var(--paper); border-color: var(--ink);
  }
  .inv-name { font-size: 14px; font-weight: 500; color: var(--ink); letter-spacing: -0.005em; }
  .inv-sub { font-size: 11.5px; color: var(--ink-3); margin-top: 1px; }

  .inv-cagr {
    font-family: var(--mono); font-size: 13px; color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  .inv-cagr .cagr-unit { color: var(--ink-4); margin-left: 2px; font-size: 10.5px; }

  .inv-spark svg { color: var(--ink-3); }

  .inv-val { text-align: right; }
  .inv-val-big {
    font-family: var(--serif); font-size: 22px; font-weight: 500;
    color: var(--ink); letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .inv-row.win .inv-val-big { color: var(--money); }
  .inv-bar {
    margin-top: 5px; height: 2px; background: var(--rule); border-radius: 2px;
    overflow: hidden;
  }
  .inv-bar span {
    display: block; height: 100%; background: var(--ink-3);
    transition: width 0.3s cubic-bezier(0.2, 0.7, 0.2, 1);
  }

  .inv-gain { text-align: right; }
  .inv-gain-num {
    font-family: var(--mono); font-size: 13px; font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .inv-gain-num.up { color: var(--money); }
  .inv-gain-num.down { color: var(--warn); }
  .inv-gain-pct {
    font-family: var(--mono); font-size: 11px; color: var(--ink-3);
    margin-top: 2px;
  }

  @media (max-width: 900px) {
    .inv-thead, .inv-row { grid-template-columns: 1.4fr 60px 1fr 110px; }
    .inv-spark { display: none; }
  }

  /* ============ Two column row ============ */
  .grid-2 { display: grid; grid-template-columns: 1.05fr 1fr; gap: 24px; }
  @media (max-width: 980px) { .grid-2 { grid-template-columns: 1fr; } }

  /* ============ Timeline / milestones ============ */
  .milestones {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column;
  }
  .ms {
    display: grid; grid-template-columns: 70px 1fr auto;
    align-items: center; gap: 16px;
    padding: 16px 0; border-top: 1px solid var(--rule);
    cursor: pointer; position: relative;
  }
  .ms:first-of-type { border-top: none; }
  .ms-date {
    font-family: var(--mono); font-size: 11px;
    color: var(--ink-3); letter-spacing: 0.04em;
    line-height: 1.4;
  }
  .ms-date b { display: block; color: var(--ink-2); font-weight: 500; font-size: 11px; }
  .ms-label {
    font-family: var(--serif); font-size: 18px; font-weight: 400;
    color: var(--ink-2); letter-spacing: -0.01em;
  }
  .ms-label em { font-style: italic; color: var(--ink-3); }
  .ms-amt {
    font-family: var(--serif); font-size: 28px; font-weight: 400;
    color: var(--money); letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .ms.active { }
  .ms.active::before {
    content: ""; position: absolute; left: -16px; top: 50%;
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--money);
    transform: translateY(-50%);
  }
  .ms.active .ms-amt { color: var(--money); }
  .ms.active .ms-label { color: var(--ink); }
  .ms-amt { color: var(--money); }

  /* ============ Unlocks ============ */
  .unlocks {
    display: flex; flex-direction: column;
  }
  .unlock {
    display: grid; grid-template-columns: 1fr auto;
    gap: 12px; padding: 16px 0;
    border-top: 1px solid var(--rule);
    align-items: baseline;
  }
  .unlock:first-of-type { border-top: none; }
  .unlock-name { font-family: var(--serif); font-size: 17px; color: var(--ink-2); font-weight: 400; letter-spacing: -0.01em; }
  .unlock-detail { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; font-family: var(--mono); letter-spacing: 0.02em; }
  .unlock-val {
    font-family: var(--serif); font-size: 22px; color: var(--ink); font-weight: 400;
    font-variant-numeric: tabular-nums; letter-spacing: -0.015em;
    white-space: nowrap;
  }
  .unlock-val .num { color: var(--ink); }
  .unlock-val .suffix { font-size: 12px; color: var(--ink-3); margin-left: 4px; font-family: var(--sans); letter-spacing: 0; }

  /* CTA */
  .cta-row { display: flex; gap: 12px; margin-top: 8px; }
  .btn {
    font: inherit; font-family: var(--sans);
    padding: 11px 16px; border-radius: 8px;
    border: 1px solid var(--money); background: var(--money); color: var(--paper);
    font-size: 13px; font-weight: 500; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    letter-spacing: -0.005em;
    box-shadow: var(--shadow);
  }
  .btn .arrow { font-family: var(--serif); font-style: italic; font-size: 14px; }
  .btn.ghost { background: transparent; color: var(--ink); }
  .btn:hover { transform: translateY(-1px); transition: transform 0.1s; }

  /* Tweaks override for tweaks panel placement */
  .tweaks-panel { font-family: var(--sans); }

  /* Section divider */
  .section-title {
    font-family: var(--serif); font-size: 26px; font-weight: 500;
    letter-spacing: -0.02em; margin: 0 0 4px;
  }
  .section-sub { font-size: 13px; color: var(--ink-3); margin-bottom: 18px; }

  /* Visually hidden */
  .sr-only { position: absolute; left: -10000px; }

  /* Numbers animation */
  .num-roll { display: inline-block; transition: opacity 0.15s; }

  .theme-pills { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .theme-pill {
    border: 1px solid var(--rule); background: var(--paper-2); color: var(--ink-3);
    border-radius: 7px; padding: 7px 8px; font: 11px var(--mono); text-transform: capitalize;
    cursor: pointer; transition: color .12s, border-color .12s, background .12s;
  }
  .theme-pill:hover, .theme-pill.active { color: var(--ink); border-color: var(--rule-2); background: var(--paper-3); }

  @media (max-width: 760px) {
    .shell, .shell.collapsed { grid-template-columns: 1fr; }
    .side { position: relative; height: auto; border-right: none; border-bottom: 1px solid var(--rule); }
    .side.collapsed { display: none; }
    .main { padding: 24px 18px 48px; }
    .hero { grid-template-columns: 1fr; gap: 24px; align-items: start; }
    .hero-amount { font-size: clamp(72px, 24vw, 116px); }
    .hero-amount .dollar { font-size: .48em; }
.cat-head { grid-template-columns: 1fr; gap: 14px; }
    .cat-bars { gap: 10px; overflow-x: auto; padding-bottom: 4px; }
    .cat-bar-col { min-width: 84px; }
    .panel-head, .invested-head { flex-direction: column; align-items: flex-start; gap: 8px; }
    .inv-thead { display: none; }
    .inv-table { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .inv-row:not(.inv-row--featured) { display: none; }
    .inv-row { display: flex; flex-direction: column; gap: 10px; background: var(--paper-3); border-radius: 10px; padding: 14px 12px; border: 1px solid var(--rule); border-top: 1px solid var(--rule); }
    .inv-row.win { border-color: var(--rule-2); }
    .inv-asset { grid-template-columns: 32px 1fr; gap: 8px; align-items: center; }
    .inv-ticker { font-size: 9.5px; padding: 3px 5px; }
    .inv-name { font-size: 12.5px; }
    .inv-sub { display: none; }
    .inv-spark { display: none; }
    .inv-cagr { font-size: 11.5px; }
    .inv-val { text-align: left; }
    .inv-val-big { font-size: 20px; }
    .inv-bar { display: block; }
    .inv-gain { text-align: left; display: flex; align-items: baseline; gap: 6px; }
    .inv-gain-num { font-size: 12px; }
    .inv-gain-pct { font-size: 11px; }
    .ms { grid-template-columns: 58px 1fr; }
    .ms-amt { grid-column: 2; font-size: 24px; }
    .cta-row { flex-direction: column; }
    .cta-row .btn { justify-content: center; }
  }

    `}</style>
  );
}
