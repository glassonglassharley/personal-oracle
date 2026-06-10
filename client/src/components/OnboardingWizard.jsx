import { useState } from 'react';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';

const PRESETS = [
  { name: 'Smoking',       emoji: '🚬', unit_label: 'cigarette',  default_price: 0.50  },
  { name: 'Vaping',        emoji: '💨', unit_label: 'session',    default_price: 1.00  },
  { name: 'Alcohol',       emoji: '🍺', unit_label: 'drink',      default_price: 6.00  },
  { name: 'Weed',          emoji: '🌿', unit_label: 'session',    default_price: 5.00  },
  { name: 'Gambling',      emoji: '🎰', unit_label: 'session',    default_price: 20.00 },
  { name: 'Fast Food',     emoji: '🍔', unit_label: 'meal',       default_price: 12.00 },
  { name: 'Energy Drinks', emoji: '⚡', unit_label: 'can',        default_price: 3.50  },
];

export default function OnboardingWizard() {
  const api = useApi();
  const { loadVices } = useViceContext();

  const [step, setStep]           = useState(1);
  const [selected, setSelected]   = useState(null);   // preset object or null for custom
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🔴');
  const [customUnit, setCustomUnit]   = useState('use');
  const [price, setPrice]         = useState('');
  const [todayMode, setTodayMode] = useState(null);   // 'clean' | 'used'
  const [qty, setQty]             = useState('1');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const isCustom = selected === 'custom';
  const viceName  = isCustom ? customName.trim() : selected?.name  || '';
  const viceEmoji = isCustom ? customEmoji        : selected?.emoji || '🔴';
  const viceUnit  = isCustom ? customUnit.trim()  : selected?.unit_label || 'use';
  const vicePrice = isCustom ? Number(price) || 0 : Number(price) || selected?.default_price || 0;

  const canGoStep2 = isCustom ? viceName.length >= 2 : selected !== null;
  const canGoStep3 = vicePrice >= 0;
  const canFinish  = todayMode !== null && (todayMode === 'clean' || Number(qty) > 0);

  async function finish() {
    setSaving(true);
    setError('');
    try {
      const vice = await api('/api/vices', {
        method: 'POST',
        body: JSON.stringify({
          name:          viceName,
          emoji:         viceEmoji,
          unit_label:    viceUnit,
          default_price: vicePrice,
        }),
      });

      const today = new Date().toISOString().split('T')[0];
      await api('/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          vice_id:        vice.id,
          date:           today,
          quantity:       todayMode === 'clean' ? 0 : Number(qty),
          price_per_unit: vicePrice,
        }),
      });

      await loadVices();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    <main className="main">
      <div className="onb-wizard">
        <div className="onb-progress">
          {[1, 2, 3].map(n => (
            <div key={n} className={`onb-pip${step >= n ? ' active' : ''}${step > n ? ' done' : ''}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="onb-step">
            <div className="onb-icon">🎯</div>
            <h2 className="onb-heading">What do you want to track?</h2>
            <p className="onb-sub">Pick a habit to start — you can add more later.</p>
            <div className="onb-presets">
              {PRESETS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  className={`onb-preset${selected === p ? ' selected' : ''}`}
                  onClick={() => { setSelected(p); setPrice(String(p.default_price)); }}
                >
                  <span className="onb-preset-emoji">{p.emoji}</span>
                  <span className="onb-preset-name">{p.name}</span>
                </button>
              ))}
              <button
                type="button"
                className={`onb-preset${selected === 'custom' ? ' selected' : ''}`}
                onClick={() => { setSelected('custom'); setPrice(''); }}
              >
                <span className="onb-preset-emoji">✏️</span>
                <span className="onb-preset-name">Custom</span>
              </button>
            </div>

            {isCustom && (
              <div className="onb-custom-fields">
                <div className="onb-field-row">
                  <input
                    className="form-input onb-emoji-input"
                    value={customEmoji}
                    onChange={e => setCustomEmoji(e.target.value)}
                    maxLength={2}
                    placeholder="🔴"
                  />
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Name your vice (e.g. Coffee)"
                    maxLength={60}
                  />
                </div>
                <input
                  className="form-input"
                  value={customUnit}
                  onChange={e => setCustomUnit(e.target.value)}
                  placeholder="Unit (e.g. cup, cigarette, session)"
                  maxLength={30}
                />
              </div>
            )}

            <button
              className="btn btn-primary onb-next"
              disabled={!canGoStep2}
              onClick={() => { setStep(2); if (!isCustom && !price) setPrice(String(selected?.default_price || '')); }}
            >
              Next →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onb-step">
            <div className="onb-icon">{viceEmoji}</div>
            <h2 className="onb-heading">How much does each {viceUnit} cost?</h2>
            <p className="onb-sub">This is used to calculate your projected savings.</p>
            <div className="onb-price-wrap">
              <span className="onb-price-symbol">$</span>
              <input
                className="form-input onb-price-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
              <span className="onb-price-unit">per {viceUnit}</span>
            </div>
            <div className="onb-footer">
              <button className="btn ghost" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                disabled={!canGoStep3}
                onClick={() => setStep(3)}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onb-step">
            <div className="onb-icon">📅</div>
            <h2 className="onb-heading">How about today?</h2>
            <p className="onb-sub">Log your first entry to start your streak counter.</p>
            <div className="onb-today-choices">
              <button
                type="button"
                className={`onb-today-btn${todayMode === 'clean' ? ' selected' : ''}`}
                onClick={() => setTodayMode('clean')}
              >
                <span className="onb-today-icon">✅</span>
                <span className="onb-today-label">Clean day</span>
                <span className="onb-today-sub">I didn't indulge today</span>
              </button>
              <button
                type="button"
                className={`onb-today-btn${todayMode === 'used' ? ' selected' : ''}`}
                onClick={() => setTodayMode('used')}
              >
                <span className="onb-today-icon">{viceEmoji}</span>
                <span className="onb-today-label">I used it</span>
                <span className="onb-today-sub">Log how many {viceUnit}s</span>
              </button>
            </div>

            {todayMode === 'used' && (
              <div className="onb-qty-wrap">
                <label className="form-label">How many {viceUnit}s?</label>
                <input
                  className="form-input onb-qty-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
              </div>
            )}

            {error && <div className="form-error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="onb-footer">
              <button className="btn ghost" onClick={() => setStep(2)}>← Back</button>
              <button
                className="btn btn-primary"
                disabled={!canFinish || saving}
                onClick={finish}
              >
                {saving ? 'Saving…' : 'Start tracking →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
