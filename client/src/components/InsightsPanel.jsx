import { useState, useRef, useCallback, useEffect } from 'react';
import { VtvMark } from '../Logo';
import { useViceContext } from '../ViceContext';
import { useApi } from '../useApi';

const PRESETS = [
  "What's my worst vice financially?",
  'Show me my 10-year projection',
  'Where should I cut first?',
  'How am I doing this week?',
];

export default function InsightsPanel({ stats, xpData }) {
  const api = useApi();
  const { vices, viceStats } = useViceContext();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildDataContext = useCallback(() => {
    const lines = ['Current vice spending data:'];
    vices.forEach(v => {
      const s = viceStats[v.id];
      if (!s) { lines.push(`- ${v.emoji} ${v.name}: no entries yet`); return; }
      lines.push(`- ${v.emoji} ${v.name}`);
      lines.push(`  All-time total: $${(s.all_time?.spend ?? 0).toFixed(2)}`);
      lines.push(`  First entry: ${s.first_entry_date ? String(s.first_entry_date).split('T')[0] : 'n/a'}`);
      lines.push(`  Total days logged: ${s.total_logged_days ?? 0}`);
      lines.push(`  Today: $${(s.today?.spend ?? 0).toFixed(2)}`);
      lines.push(`  This week: $${(s.week?.spend ?? 0).toFixed(2)}`);
      lines.push(`  This month: $${(s.month?.spend ?? 0).toFixed(2)}`);
      lines.push(`  This year: $${(s.year?.spend ?? 0).toFixed(2)}`);
      lines.push(`  Avg daily spend (on vice days): $${(s.avg_daily_spend ?? 0).toFixed(2)}`);
      lines.push(`  Projected monthly at current rate: $${(s.averages?.month?.spend ?? 0).toFixed(2)}`);
      lines.push(`  Projected annual at current rate: $${(s.averages?.year?.spend ?? 0).toFixed(2)}`);
      lines.push(`  Clean days: ${s.clean_days ?? 0}`);
      lines.push(`  Current streak: ${s.current_streak ?? 0} days`);
      lines.push(`  Best streak: ${s.best_streak ?? 0} days`);
      lines.push(`  Saved from clean days: $${(s.savings_from_clean_days ?? 0).toFixed(2)}`);
    });
    if (stats) {
      lines.push('\nCombined totals (all vices):');
      lines.push(`  Today: $${(stats.today?.spend ?? 0).toFixed(2)}`);
      lines.push(`  This week: $${(stats.week?.spend ?? 0).toFixed(2)}`);
      lines.push(`  This month: $${(stats.month?.spend ?? 0).toFixed(2)}`);
      lines.push(`  This year: $${(stats.year?.spend ?? 0).toFixed(2)}`);
      lines.push(`  Overall clean days: ${stats.clean_days ?? 0}`);
      lines.push(`  Current combined streak: ${stats.current_streak ?? 0} days`);
      lines.push(`  Best combined streak: ${stats.best_streak ?? 0} days`);
      lines.push(`  Saved from clean days: $${(stats.savings_from_clean_days ?? 0).toFixed(2)}`);
      lines.push(`  Avg daily spend across all vices: $${(stats.avg_daily_spend ?? 0).toFixed(2)}`);
    }
    if (xpData) {
      lines.push('\nProgress:');
      lines.push(`  Level: ${xpData.level} — ${xpData.level_name} ${xpData.level_icon}`);
      lines.push(`  Total XP: ${xpData.total_xp}`);
    }
    return lines.join('\n');
  }, [vices, viceStats, stats, xpData]);

  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError('');
    setInput('');

    // Attach data context to first user message so Claude always has full picture
    const isFirst = messages.length === 0;
    const userContent = isFirst ? `${trimmed}\n\n${buildDataContext()}` : trimmed;
    const next = [...messages, { role: 'user', content: userContent }];
    setMessages(next);
    setLoading(true);

    try {
      const { text: reply } = await api('/api/insights', {
        method: 'POST',
        body: JSON.stringify({
          vices: vices.map(v => ({ id: v.id, name: v.name, emoji: v.emoji })),
          stats: viceStats,
          messages: next,
        }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: reply || '' }]);
    } catch {
      setError('Could not reach your coach right now. Try again in a moment.');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [messages, loading, vices, viceStats, buildDataContext, api]);

  const handleSubmit = (e) => { e.preventDefault(); send(input); };

  const hasData = vices.length > 0;
  const hasConversation = messages.length > 0;

  // Displayed messages hide the injected data context from the user bubble
  const displayMessages = messages.map((m, i) => {
    if (m.role === 'user' && i === 0) {
      const firstLine = m.content.split('\n\nCurrent vice spending data:')[0];
      return { ...m, display: firstLine };
    }
    return { ...m, display: m.content };
  });

  return (
    <section style={s.wrap}>
      <div style={s.header}>
        <span style={s.sparkle}>✦</span>
        <span style={s.title}>AI Coach</span>
        {loading && <VtvMark style={s.pulseMark} className="insights-pulse-mark" />}
        {hasConversation && !loading && (
          <button style={s.clearBtn} onClick={() => { setMessages([]); setError(''); }}>
            New chat
          </button>
        )}
      </div>

      {!hasData && (
        <p style={s.hint}>Add vices and log some entries to start talking with your coach.</p>
      )}

      {hasData && !hasConversation && (
        <>
          <p style={s.hint}>Your personal financial accountability coach — ask anything.</p>
          <div style={s.presets}>
            {PRESETS.map(p => (
              <button key={p} style={s.presetBtn} onClick={() => send(p)} disabled={loading}>
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      {hasConversation && (
        <div style={s.thread}>
          {displayMessages.map((m, i) => (
            <div key={i} style={m.role === 'user' ? s.userBubble : s.coachBubble}>
              {m.role === 'assistant' && <div style={s.coachLabel}>Coach</div>}
              <p style={m.role === 'user' ? s.userText : s.coachText}>
                {m.display}
              </p>
            </div>
          ))}

          {loading && (
            <div style={s.coachBubble}>
              <div style={s.coachLabel}>Coach</div>
              <div style={s.skelWrap}>
                <div style={{ ...s.skelLine, width: '82%' }} />
                <div style={{ ...s.skelLine, width: '67%', marginTop: 8 }} />
                <div style={{ ...s.skelLine, width: '48%', marginTop: 8 }} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {error && <p style={s.errorText}>{error}</p>}

      {hasData && (
        <div style={s.inputArea}>
          {hasConversation && (
            <div style={{ ...s.presets, marginBottom: 10 }}>
              {PRESETS.map(p => (
                <button key={p} style={s.presetBtn} onClick={() => send(p)} disabled={loading}>
                  {p}
                </button>
              ))}
            </div>
          )}
          <form style={s.inputRow} onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              style={s.input}
              placeholder="Ask your coach anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
            <button
              type="submit"
              style={{ ...s.sendBtn, opacity: (!input.trim() || loading) ? 0.45 : 1 }}
              disabled={!input.trim() || loading}
            >
              ↑
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes insights-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
        }
        .insights-pulse-mark { animation: insights-pulse 1.4s ease-in-out infinite; }

        @keyframes insights-skel {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </section>
  );
}

const s = {
  wrap: {
    background: 'var(--paper-2, #122615)',
    border: '1px solid rgba(212,175,55,0.25)',
    borderRadius: 14,
    padding: '24px 28px',
    marginTop: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sparkle: {
    color: '#d4af37',
    fontSize: 18,
    lineHeight: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--ink, #f0f7ec)',
    letterSpacing: '-0.01em',
    flex: 1,
  },
  pulseMark: {
    width: 22,
    height: 22,
  },
  clearBtn: {
    background: 'transparent',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: 12,
    color: 'rgba(212,175,55,0.7)',
    cursor: 'pointer',
  },
  hint: {
    fontSize: 14,
    color: 'var(--ink-3, #8e9a85)',
    marginBottom: 16,
    lineHeight: 1.5,
  },
  presets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    background: 'transparent',
    border: '1px solid rgba(212,175,55,0.35)',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 12.5,
    color: 'rgba(212,175,55,0.8)',
    cursor: 'pointer',
    transition: 'border-color 0.12s, color 0.12s',
  },
  thread: {
    maxHeight: 420,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 16,
    paddingRight: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '78%',
    background: 'rgba(212,175,55,0.12)',
    border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: '14px 14px 4px 14px',
    padding: '10px 14px',
  },
  coachBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
  },
  coachLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#d4af37',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  userText: {
    fontSize: 13.5,
    color: 'rgba(212,175,55,0.9)',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  coachText: {
    fontSize: 14.5,
    color: 'var(--ink, #f0f7ec)',
    lineHeight: 1.75,
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  skelWrap: {
    padding: '4px 0',
  },
  skelLine: {
    height: 13,
    borderRadius: 7,
    background: 'linear-gradient(90deg, var(--paper-3,#1a3328) 25%, var(--rule-2,rgba(232,239,224,0.1)) 50%, var(--paper-3,#1a3328) 75%)',
    backgroundSize: '200% 100%',
    animation: 'insights-skel 1.4s ease infinite',
  },
  errorText: {
    fontSize: 13,
    color: 'var(--warn, #d9583a)',
    marginBottom: 12,
  },
  inputArea: {
    marginTop: 4,
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    background: 'var(--paper-3, #1a3328)',
    border: '1px solid rgba(212,175,55,0.25)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--ink, #f0f7ec)',
    outline: 'none',
  },
  sendBtn: {
    background: '#d4af37',
    color: '#040c06',
    border: 'none',
    borderRadius: 10,
    width: 40,
    height: 40,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
};
