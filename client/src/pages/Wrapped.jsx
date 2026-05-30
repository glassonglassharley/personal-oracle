import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../useApi';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const BADGE_EMOJI_MAP = {
  first_log:'✨', streak_3:'🔥', streak_7:'⚡', streak_30:'🌱', streak_100:'👑',
  saved_100:'💰', saved_500:'💵', saved_1000:'🏆', logged_30_days:'📅', plaid_connected:'🏦',
};
const getBadgeEmoji = id => BADGE_EMOJI_MAP[id] || '🏅';

export default function Wrapped() {
  const { year } = useParams();
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api(`/api/wrapped/${year}`)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = () => {
    if (!data) return;
    const text = [
      `My ${year} Vice Spending Wrapped 🎉`,
      `💸 Spent: $${data.total_spent.toFixed(0)}`,
      `💚 Saved: $${data.total_saved.toFixed(0)}`,
      `✅ Clean days: ${data.total_clean_days}`,
      `🔥 Longest streak: ${data.longest_streak} days`,
      data.biggest_vice ? `🏆 Biggest vice: ${data.biggest_vice.emoji} ${data.biggest_vice.name}` : '',
      data.ai_summary ? `\n"${data.ai_summary}"` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (loading) return (
    <div className="wr-loading">
      <div className="insights-dots">
        <div className="insights-dot" />
        <div className="insights-dot" />
        <div className="insights-dot" />
      </div>
      <span>Building your {year} Wrapped…</span>
    </div>
  );

  if (err || !data) return (
    <div className="wr-loading">
      <p style={{ color: 'var(--warn)' }}>{err || 'Something went wrong.'}</p>
      <Link className="btn" to="/">Back to Dashboard</Link>
    </div>
  );

  if (data.empty) return (
    <div className="wr-loading">
      <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
      <h2 style={{ color: '#fff', marginBottom: 8 }}>No data for {year}</h2>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>Start logging vices to get your Wrapped next year.</p>
      <Link className="btn" to="/">Back to Dashboard</Link>
    </div>
  );

  const fmt = n => `$${Number(n || 0).toFixed(0)}`;
  const fmtD = dateStr => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  const slides = [
    // 0 — cover
    <Slide key="cover" accent="#0F6E56" dim>
      <div className="wr-kicker">Vice Spending</div>
      <div className="wr-year">{year}</div>
      <div className="wr-cover-sub">Your year in review</div>
    </Slide>,

    // 1 — total spent
    <Slide key="spent" accent="#e07a5e">
      <div className="wr-eyebrow">Total spent on vices</div>
      <div className="wr-big">{fmt(data.total_spent)}</div>
      <div className="wr-desc">across {data.vices.length} tracked {data.vices.length === 1 ? 'vice' : 'vices'}</div>
      <div className="wr-vice-strip">
        {data.vices.map((v, i) => (
          <div key={i} className="wr-vice-chip">
            <span>{v.emoji}</span>
            <span>{v.name}</span>
            <span className="wr-vice-amt">{fmt(v.total)}</span>
          </div>
        ))}
      </div>
    </Slide>,

    // 2 — saved
    <Slide key="saved" accent="#0F6E56">
      <div className="wr-eyebrow">Saved from clean days</div>
      <div className="wr-big wr-green">{fmt(data.total_saved)}</div>
      <div className="wr-desc">money you chose NOT to spend</div>
    </Slide>,

    // 3 — clean days + streak
    <Slide key="streak" accent="#5ec48a">
      <div className="wr-eyebrow">Your discipline in numbers</div>
      <div className="wr-two-stat">
        <div>
          <div className="wr-big wr-green">{data.total_clean_days}</div>
          <div className="wr-stat-label">clean days</div>
        </div>
        <div className="wr-divider" />
        <div>
          <div className="wr-big wr-green">{data.longest_streak}</div>
          <div className="wr-stat-label">longest streak</div>
        </div>
      </div>
    </Slide>,

    // 4 — biggest vice
    data.biggest_vice && (
      <Slide key="vice" accent="#ffd700">
        <div className="wr-eyebrow">Your biggest vice</div>
        <div className="wr-emoji-big">{data.biggest_vice.emoji}</div>
        <div className="wr-big" style={{ fontSize: 'clamp(36px,8vw,64px)' }}>{data.biggest_vice.name}</div>
        <div className="wr-desc">{fmt(data.biggest_vice.total)} spent · {data.biggest_vice.cleanDays} clean days</div>
      </Slide>
    ),

    // 5 — most expensive day
    data.most_expensive_day?.date && (
      <Slide key="expensive" accent="#ff9f43">
        <div className="wr-eyebrow">Most expensive single day</div>
        <div className="wr-big">{fmt(data.most_expensive_day.amount)}</div>
        <div className="wr-desc">{fmtD(data.most_expensive_day.date)}</div>
      </Slide>
    ),

    // 6 — months
    (data.best_month || data.worst_month) && (
      <Slide key="months" accent="#74c0fc">
        <div className="wr-eyebrow">Month breakdown</div>
        <div className="wr-months-grid">
          {data.best_month && (
            <div className="wr-month-card wr-month-best">
              <div className="wr-month-label">Best month 🌱</div>
              <div className="wr-month-name">{data.best_month.name}</div>
              <div className="wr-month-amt">{fmt(data.best_month.total)}</div>
            </div>
          )}
          {data.worst_month && data.worst_month.month !== data.best_month?.month && (
            <div className="wr-month-card wr-month-worst">
              <div className="wr-month-label">Toughest month</div>
              <div className="wr-month-name">{data.worst_month.name}</div>
              <div className="wr-month-amt">{fmt(data.worst_month.total)}</div>
            </div>
          )}
        </div>
      </Slide>
    ),

    // 7 — AI summary
    data.ai_summary && (
      <Slide key="ai" accent="#9c6fae" dim>
        <div className="wr-eyebrow">Your year in one sentence</div>
        <div className="wr-ai-quote">"{data.ai_summary}"</div>
      </Slide>
    ),

    // 8 — Personality type
    data.personality_type && (
      <Slide key="personality" accent="#e07a5e">
        <div className="wr-eyebrow">Your 2026 personality</div>
        <div className="wr-big" style={{ fontSize: 'clamp(32px,7vw,56px)' }}>{data.personality_type}</div>
        <div className="wr-desc">{data.personality_desc}</div>
      </Slide>
    ),

    // 9 — XP & level
    data.total_xp > 0 && (
      <Slide key="xp" accent="#ffd700" dim>
        <div className="wr-eyebrow">XP earned this year</div>
        <div className="wr-big" style={{ color: '#ffd700' }}>{data.total_xp.toLocaleString()}</div>
        <div className="wr-desc">Level {data.highest_level} reached</div>
      </Slide>
    ),

    // 10 — Badges this year
    data.badges_this_year?.length > 0 && (
      <Slide key="badges" accent="#74c0fc" dim>
        <div className="wr-eyebrow">{data.badges_this_year.length} badge{data.badges_this_year.length !== 1 ? 's' : ''} earned</div>
        <div className="wr-badge-strip">
          {data.badges_this_year.slice(0, 8).map(id => (
            <span key={id} className="wr-badge-chip">{getBadgeEmoji(id)}</span>
          ))}
        </div>
      </Slide>
    ),

    // 11 — Most expensive single entry
    data.most_expensive_entry && (
      <Slide key="expensive-entry" accent="#ff9f43">
        <div className="wr-eyebrow">Most expensive single purchase</div>
        <div className="wr-emoji-big">{data.most_expensive_entry.vice_emoji}</div>
        <div className="wr-big">{fmt(data.most_expensive_entry.spend)}</div>
        <div className="wr-desc">{data.most_expensive_entry.vice_name} · {fmtD(data.most_expensive_entry.date)}</div>
      </Slide>
    ),

    // 8 — share
    <Slide key="share" accent="#0F6E56" dim>
      <div className="wr-kicker">That's a wrap</div>
      <div className="wr-year" style={{ fontSize: 'clamp(48px,12vw,96px)' }}>{year}</div>
      <div className="wr-cover-sub" style={{ marginBottom: 36 }}>Keep going in {Number(year) + 1}</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={share} style={{ background: '#0F6E56', borderColor: '#0F6E56' }}>
          {copied ? '✓ Copied!' : '⬆ Share my Wrapped'}
        </button>
        <Link className="btn ghost" to="/" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
          Back to Dashboard
        </Link>
      </div>
    </Slide>,
  ].filter(Boolean);

  return (
    <div className="wr-page" ref={scrollRef}>
      {slides}
    </div>
  );
}

function Slide({ children, accent = '#0F6E56', dim = false }) {
  return (
    <div
      className={`wr-slide${dim ? ' wr-slide-dim' : ''}`}
      style={{ '--wr-accent': accent }}
    >
      <div className="wr-slide-inner">{children}</div>
    </div>
  );
}
