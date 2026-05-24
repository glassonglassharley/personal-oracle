import { useState, useEffect } from 'react';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';
import { formatQuantityWithUnit, getUnitLabel } from '../formatUnits';

const fmt$ = n => '$' + Number(n || 0).toFixed(2);
const fmtQ = n => Number(n || 0) % 1 === 0 ? String(Number(n || 0)) : Number(n || 0).toFixed(1);

export default function LogEntry() {
  const api = useApi();
  const { vices, activeViceId } = useViceContext();

  const [selectedViceId, setSelectedViceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState(0);
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [recentEntries, setRecentEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Init selected vice from context once vices are available
  useEffect(() => {
    if (initialized || vices.length === 0) return;
    const initId = activeViceId ? String(activeViceId) : String(vices[0].id);
    setSelectedViceId(initId);
    const v = vices.find(x => String(x.id) === initId);
    if (v) setPricePerUnit(v.default_price);
    setInitialized(true);
  }, [vices, activeViceId, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedViceId) return;
    const vice = vices.find(v => String(v.id) === String(selectedViceId));
    if (vice) setPricePerUnit(vice.default_price);
    api(`/api/entries?vice_id=${selectedViceId}`)
      .then(data => setRecentEntries(data.slice(0, 7)))
      .catch(console.error);
  }, [selectedViceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeVice = vices.find(v => String(v.id) === String(selectedViceId));
  const activeUnitLabel = getUnitLabel(activeVice);

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          vice_id: Number(selectedViceId),
          date,
          quantity: Number(quantity),
          price_per_unit: Number(pricePerUnit),
        }),
      });
      const msg = Number(quantity) === 0 ? 'Clean day logged!' : 'Entry saved!';
      setSavedMsg(msg);
      setTimeout(() => setSavedMsg(''), 2500);
      api(`/api/entries?vice_id=${selectedViceId}`)
        .then(data => setRecentEntries(data.slice(0, 7)));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (vices.length === 0) {
    return (
      <main className="main">
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h2>No vices yet</h2>
          <p>Add a vice in <a href="/vices">Vices</a> before logging entries.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Log Entry</span>
      </div>

      <div className="page-title">Log Entry</div>

      <div className="grid-log">
        <div className="panel">
          <form onSubmit={handleSubmit} className="log-form">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date}
                onChange={e => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="form-group">
              <label className="form-label">Vice</label>
              <select className="form-select" value={selectedViceId}
                onChange={e => setSelectedViceId(e.target.value)}>
                {vices.map(v => (
                  <option key={v.id} value={v.id}>{v.emoji} {v.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Quantity ({activeUnitLabel})
                <span className="form-hint"> — 0 to log a clean day</span>
              </label>
              <input type="number" className="form-input" value={quantity}
                min="0" step="0.5"
                onChange={e => setQuantity(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Price per {activeUnitLabel} ($)</label>
              <input type="number" className="form-input" value={pricePerUnit}
                min="0" step="0.01"
                onChange={e => setPricePerUnit(e.target.value)} />
            </div>

            {Number(quantity) > 0 && (
              <div className="log-total">
                Total: <strong>{fmt$(Number(quantity) * Number(pricePerUnit))}</strong>
              </div>
            )}

            <button type="submit" className="btn" disabled={saving || !selectedViceId}>
              {saving ? 'Saving…' : Number(quantity) === 0 ? 'Log Clean Day' : 'Save Entry'}
            </button>

            {savedMsg && (
              <div className={`save-msg${savedMsg.includes('Clean') ? ' save-msg-clean' : ''}`}>
                {savedMsg}
              </div>
            )}
          </form>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Last 7 Entries</span>
          </div>
          {recentEntries.length === 0 ? (
            <p className="text-muted">No entries yet.</p>
          ) : (
            <div className="entry-list">
              {recentEntries.map(e => {
                const isClean = Number(e.quantity) === 0;
                const d = new Date((e.date + '').split('T')[0] + 'T00:00:00');
                return (
                  <div key={e.id} className={`entry-item ${isClean ? 'clean' : ''}`}>
                    <span className="entry-date">
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {isClean ? (
                      <span className="text-money">Clean day</span>
                    ) : (
                      <>
                        <span className="entry-qty">{formatQuantityWithUnit(e.quantity, activeVice)}</span>
                        <span className="entry-spend">{fmt$(e.quantity * e.price_per_unit)}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
