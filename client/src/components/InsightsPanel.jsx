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

// Caches the opener for the browser session so revisiting the dashboard doesn't
// regenerate the greeting.
const OPENER_KEY = 'vtv-coach-opener';

export default function InsightsPanel({ stats, xpData, weeklyInsight = null, placement = 'default' }) {
  const api = useApi();
  const { vices, viceStats } = useViceContext();
  const isTopPlacement = placement === 'top';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(() => isTopPlacement);
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const openerRef = useRef(false);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Stats travel in the request body and are rendered into the system prompt server-side,
  // so they never enter the messages array or show up in a chat bubble.
  const buildPayload = useCallback(() => ({
    vices: vices.map(v => ({ id: v.id, name: v.name, emoji: v.emoji })),
    stats: viceStats,
    combined_stats: stats,
    xp: xpData || null,
  }), [vices, viceStats, stats, xpData]);

  // OPENER — the stats-driven greeting. Fires once per chat (session start or "New chat"),
  // never on a reply. Cached for the browser session so remounting the dashboard doesn't
  // regenerate it.
  const loadOpener = useCallback(async ({ force = false } = {}) => {
    if (openerRef.current && !force) return;
    openerRef.current = true;

    if (!force) {
      try {
        const cached = sessionStorage.getItem(OPENER_KEY);
        if (cached) { setMessages([{ role: 'assistant', content: cached }]); return; }
      } catch { /* sessionStorage unavailable — just fetch */ }
    }

    setError('');
    setLoading(true);
    try {
      const { text: opener } = await api('/api/insights', {
        method: 'POST',
        body: JSON.stringify({ ...buildPayload(), mode: 'opener' }),
      });
      if (opener) {
        setMessages([{ role: 'assistant', content: opener }]);
        try { sessionStorage.setItem(OPENER_KEY, opener); } catch { /* non-fatal */ }
      }
    } catch {
      // No opener is fine — the user can still start the conversation themselves.
      openerRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [api, buildPayload]);

  useEffect(() => {
    if (vices.length > 0 && !collapsed) loadOpener();
  }, [vices.length, loadOpener, collapsed]);

  const startNewChat = useCallback(() => {
    try { sessionStorage.removeItem(OPENER_KEY); } catch { /* non-fatal */ }
    setMessages([]);
    setError('');
    loadOpener({ force: true });
  }, [loadOpener]);

  // TURN — every user message. Sends the full history (all prior user AND assistant turns
  // in this session) so the model can see what it already said and what the user just said.
  const send = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError('');
    setInput('');

    const next = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setLoading(true);

    try {
      const { text: reply } = await api('/api/insights', {
        method: 'POST',
        body: JSON.stringify({
          ...buildPayload(),
          mode: 'turn',
          messages: next,
        }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: reply || '' }]);
    } catch {
      setError('Could not reach your coach right now. Try again in a moment.');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    }
  }, [messages, loading, buildPayload, api]);

  const handleSubmit = (e) => { e.preventDefault(); send(input); };

  const hasData = vices.length > 0;
  const hasConversation = messages.length > 0;


  return (
    <section style={{ ...s.wrap, ...(isTopPlacement ? s.topWrap : null) }} className="merged-insights-card">
      <div style={{ ...s.header, ...(collapsed ? s.collapsedHeader : null) }}>
        <span style={s.sparkle}>✦</span>
        <span style={s.title}>{weeklyInsight ? 'Insights' : 'Coach Insight'}</span>
        {isTopPlacement && (
          <button
            type="button"
            style={s.toggleBtn}
            onClick={() => setCollapsed(value => !value)}
            aria-expanded={!collapsed}
          >
            {collapsed ? 'Open' : 'Hide'}
          </button>
        )}
        {loading && <VtvMark style={s.pulseMark} className="insights-pulse-mark" />}
        {hasConversation && !loading && !collapsed && (
          <button style={s.clearBtn} onClick={startNewChat}>
            New chat
          </button>
        )}
      </div>

      {collapsed && null}

      {!collapsed && (
        <>

      {weeklyInsight && (
        <div style={s.weeklyPanel}>
          <div style={s.weeklyMeta}>Weekly</div>
          <p style={s.weeklyText}>{weeklyInsight}</p>
        </div>
      )}

      {!hasData && (
        <p style={s.hint}>Add vices and log some entries to start talking with your coach.</p>
      )}

      {hasData && !hasConversation && !isTopPlacement && (
        <>
          <p style={{ ...s.hint, ...(weeklyInsight ? s.coachIntro : null) }}>Your personal financial accountability coach — ask anything.</p>
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
        <div ref={threadRef} style={s.thread}>
          {messages.map((m, i) => (
            <div key={i} style={m.role === 'user' ? s.userBubble : s.coachBubble}>
              {m.role === 'assistant' && <div style={s.coachLabel}>Coach</div>}
              <p style={m.role === 'user' ? s.userText : s.coachText}>
                {m.content}
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

        </div>
      )}

      {error && <p style={s.errorText}>{error}</p>}

      {hasData && (
        <div style={s.inputArea}>
          {hasConversation && !isTopPlacement && (
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

        </>
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

        .merged-insights-card {
          position: relative;
          overflow: hidden;
        }
        .merged-insights-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--money, #d4af37) 18%, transparent), transparent 38%),
            radial-gradient(circle at 100% 14%, color-mix(in srgb, var(--success, #5ec48a) 14%, transparent), transparent 42%);
          opacity: 0.9;
        }
        .merged-insights-card > * { position: relative; z-index: 1; }
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
  topWrap: {
    marginTop: 0,
    marginBottom: 24,
    padding: '16px 18px 18px',
    borderColor: 'color-mix(in srgb, var(--money, #d4af37) 34%, var(--rule, rgba(232,239,224,0.08)))',
    background: 'linear-gradient(145deg, color-mix(in srgb, var(--paper-2, #122615) 88%, var(--money, #d4af37) 6%), var(--paper-2, #122615))',
    boxShadow: '0 18px 48px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  collapsedHeader: {
    marginBottom: 0,
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
  toggleBtn: {
    background: 'transparent',
    border: '1px solid rgba(212,175,55,0.35)',
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: 12,
    color: 'rgba(212,175,55,0.82)',
    cursor: 'pointer',
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
  coachIntro: {
    marginTop: 16,
    marginBottom: 12,
  },
  weeklyPanel: {
    display: 'grid',
    gap: 6,
    padding: '0 0 12px',
    marginBottom: 12,
    borderBottom: '1px solid color-mix(in srgb, var(--money, #d4af37) 22%, var(--rule, rgba(232,239,224,0.08)))',
  },
  weeklyMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--money, #d4af37)',
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  weeklyText: {
    margin: 0,
    color: 'var(--ink, #f0f7ec)',
    fontSize: 14.5,
    lineHeight: 1.45,
    letterSpacing: '-0.01em',
    whiteSpace: 'pre-wrap',
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
    maxHeight: 180,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 10,
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
    maxWidth: '100%',
  },
  coachLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#d4af37',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  userText: {
    fontSize: 13.5,
    color: 'rgba(212,175,55,0.9)',
    lineHeight: 1.6,
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  coachText: {
    fontSize: 13.5,
    color: 'var(--ink, #f0f7ec)',
    lineHeight: 1.5,
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
    padding: '8px 12px',
    fontSize: 13.5,
    color: 'var(--ink, #f0f7ec)',
    outline: 'none',
  },
  sendBtn: {
    background: '#d4af37',
    color: '#040c06',
    border: 'none',
    borderRadius: 10,
    width: 36,
    height: 36,
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
