import { useState, useRef, useCallback, useEffect } from 'react';
import { VtvMark } from '../Logo';
import { useViceContext } from '../ViceContext';
import { useApi } from '../useApi';

const PRESET_PROMPTS = [
  "What's my worst vice financially?",
  'Show me my 10-year projection',
  'Where should I cut first?',
];

export default function InsightsPanel() {
  const api = useApi();
  const { vices, viceStats } = useViceContext();

  const [insight, setInsight] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const typewriterRef = useRef(null);

  useEffect(() => () => clearInterval(typewriterRef.current), []);

  const runInsight = useCallback(async (prompt = null) => {
    if (streaming) return;
    clearInterval(typewriterRef.current);
    setInsight('');
    setError('');
    setStreaming(true);

    try {
      const { text } = await api('/api/insights', {
        method: 'POST',
        body: JSON.stringify({
          vices: vices.map(v => ({
            id: v.id,
            name: v.name,
            emoji: v.emoji,
            price_per_unit: v.price_per_unit,
            unit: v.unit,
          })),
          stats: viceStats,
          prompt: prompt || undefined,
        }),
      });
      if (!text) throw new Error('No response from AI.');

      let i = 0;
      typewriterRef.current = setInterval(() => {
        i++;
        setInsight(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(typewriterRef.current);
          setStreaming(false);
        }
      }, 14);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setStreaming(false);
    }
  }, [streaming, vices, viceStats, api]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData = vices.length > 0;

  return (
    <section style={s.wrap}>
      <div style={s.header}>
        <span style={s.sparkle}>✦</span>
        <span style={s.title}>AI Insights</span>
        {streaming && <VtvMark style={s.pulseMark} className="insights-pulse-mark" />}
      </div>

      {!hasData && (
        <p style={s.noData}>Add vices and log some entries to get personalized insights.</p>
      )}

      {hasData && !insight && !streaming && !error && (
        <p style={s.hint}>Your personal financial accountability coach — powered by AI.</p>
      )}

      {streaming && !insight && (
        <div style={s.skeleton}>
          <div style={{ ...s.skelLine, width: '85%' }} />
          <div style={{ ...s.skelLine, width: '70%', marginTop: 10 }} />
          <div style={{ ...s.skelLine, width: '55%', marginTop: 10 }} />
        </div>
      )}

      {insight && (
        <div style={s.response}>
          <p style={s.responseText}>
            {insight}
            {streaming && <span style={s.cursor} className="insights-cursor">▌</span>}
          </p>
        </div>
      )}

      {error && <p style={s.errorText}>{error}</p>}

      {hasData && (
        <div style={s.actions}>
          <button
            style={{ ...s.mainBtn, opacity: streaming ? 0.6 : 1 }}
            onClick={() => runInsight(null)}
            disabled={streaming}
          >
            {streaming ? 'Analyzing…' : insight ? 'Refresh Insights' : 'Get My Insights'}
          </button>
        </div>
      )}

      {hasData && (
        <div style={s.presets}>
          {PRESET_PROMPTS.map(p => (
            <button
              key={p}
              style={{ ...s.presetBtn, opacity: streaming ? 0.5 : 1 }}
              onClick={() => runInsight(p)}
              disabled={streaming}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes insights-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .insights-cursor { animation: insights-cursor-blink 0.8s step-end infinite; }

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
  hint: {
    fontSize: 14,
    color: 'var(--ink-3, #8e9a85)',
    marginBottom: 16,
  },
  noData: {
    fontSize: 14,
    color: 'var(--ink-3, #8e9a85)',
  },
  skeleton: {
    padding: '4px 0 16px',
  },
  skelLine: {
    height: 14,
    borderRadius: 7,
    background: 'linear-gradient(90deg, var(--paper-3,#1a3328) 25%, var(--rule-2,rgba(232,239,224,0.1)) 50%, var(--paper-3,#1a3328) 75%)',
    backgroundSize: '200% 100%',
    animation: 'insights-skel 1.4s ease infinite',
  },
  response: {
    marginBottom: 20,
  },
  responseText: {
    fontSize: 14.5,
    lineHeight: 1.7,
    color: '#d4af37',
    whiteSpace: 'pre-wrap',
  },
  cursor: {
    color: '#d4af37',
    marginLeft: 1,
  },
  errorText: {
    fontSize: 13,
    color: 'var(--warn, #d9583a)',
    marginBottom: 16,
  },
  actions: {
    marginBottom: 16,
  },
  mainBtn: {
    background: '#d4af37',
    color: '#040c06',
    border: 'none',
    borderRadius: 8,
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  presets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
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
};
