import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';
import { formatQuantityWithUnit, getUnitLabel } from '../formatUnits';
import { BadgeCelebOverlay } from './BadgeCelebOverlay';

const fmt$ = n => '$' + Number(n || 0).toFixed(2);

export default function LogEntry() {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const { vices, activeViceId } = useViceContext();

  const [selectedViceId, setSelectedViceId] = useState('');
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA').format(new Date()));
  const [quantity, setQuantity] = useState(0);
  const [totalSpent, setTotalSpent] = useState('');
  const [recentEntries, setRecentEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [viceStreak, setViceStreak] = useState(null); // { current, best }
  const [newBadges, setNewBadges] = useState([]);

  const loadRecentEntries = viceId => {
    if (!viceId) return Promise.resolve();
    return api(`/api/entries?vice_id=${viceId}`)
      .then(data => setRecentEntries(data.slice(0, 7)))
      .catch(console.error);
  };

  // Init selected vice from context once vices are available
  useEffect(() => {
    if (initialized || vices.length === 0) return;
    const initId = activeViceId ? String(activeViceId) : String(vices[0].id);
    setSelectedViceId(initId);
    // totalSpent depends on quantity, so leave it blank on init
    setInitialized(true);
  }, [vices, activeViceId, initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedViceId) return;
    if (!editingEntry) setTotalSpent('');
    loadRecentEntries(selectedViceId);
    api(`/api/stats/${selectedViceId}?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`)
      .then(s => setViceStreak({ current: s.current_streak, best: s.best_streak }))
      .catch(() => {});
  }, [selectedViceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeVice = vices.find(v => String(v.id) === String(selectedViceId));
  const activeUnitLabel = getUnitLabel(activeVice);

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      const qty = Number(quantity);
      const total = Number(totalSpent) || 0;
      const payload = {
        vice_id: Number(selectedViceId),
        date,
        quantity: qty,
        price_per_unit: qty > 0 ? total / qty : 0,
      };
      await api(editingEntry ? `/api/entries/${editingEntry.id}` : '/api/entries', {
        method: editingEntry ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const msg = editingEntry
        ? 'Entry updated!'
        : Number(quantity) === 0 ? 'Clean day logged!' : 'Entry saved!';
      setSavedMsg(msg);
      setTimeout(() => setSavedMsg(''), 2500);
      setEditingEntry(null);
      loadRecentEntries(selectedViceId);
      // Check for newly earned badges after every save
      api('/api/badges/check', { method: 'POST' })
        .then(({ newly_earned }) => { if (newly_earned?.length) setNewBadges(newly_earned); })
        .catch(() => {});
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Could not save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleViceChange = e => {
    setSelectedViceId(e.target.value);
    if (!editingEntry) setTotalSpent('');
  };

  const startEdit = entry => {
    const entryDate = String(entry.date || '').split('T')[0];
    setEditingEntry(entry);
    setSelectedViceId(String(entry.vice_id));
    setDate(entryDate);
    setQuantity(Number(entry.quantity || 0));
    setTotalSpent(Number(entry.quantity || 0) > 0
      ? String((Number(entry.quantity) * Number(entry.price_per_unit || 0)).toFixed(2))
      : '');
    setSavedMsg('');
    setErrorMsg('');
  };

  useEffect(() => {
    const entry = location.state?.editEntry;
    if (!entry || vices.length === 0) return;
    startEdit(entry);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, vices.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelEdit = () => {
    setEditingEntry(null);
    setDate(new Intl.DateTimeFormat('en-CA').format(new Date()));
    setQuantity(0);
    setTotalSpent('');
    setErrorMsg('');
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

      {viceStreak && (viceStreak.current > 0 || viceStreak.best > 0) && (
        <div className="log-streak-banner">
          <span className="log-streak-flame">{viceStreak.current > 0 ? '🔥' : '💤'}</span>
          <span className="log-streak-text">
            {viceStreak.current > 0
              ? <><strong>{viceStreak.current}-day</strong> clean streak{viceStreak.best > viceStreak.current ? ` · best ${viceStreak.best}` : ''}</>
              : <>No current streak · best <strong>{viceStreak.best}</strong> days</>
            }
          </span>
        </div>
      )}

      <div className="grid-log">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">{editingEntry ? 'Edit Entry' : 'New Entry'}</span>
            {editingEntry && <span className="panel-sub">Editing {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
          </div>
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
                onChange={handleViceChange}>
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
              <label className="form-label">Total spent ($)</label>
              <input type="number" className="form-input" value={totalSpent}
                min="0" step="0.01" placeholder="0.00"
                onChange={e => setTotalSpent(e.target.value)} />
            </div>

            {Number(quantity) > 0 && Number(totalSpent) > 0 && (
              <div className="log-calc-row">
                <div className="log-calc-item">
                  <span className="log-calc-label">Total</span>
                  <strong className="log-calc-val text-money">{fmt$(Number(totalSpent))}</strong>
                </div>
                <div className="log-calc-divider" />
                <div className="log-calc-item">
                  <span className="log-calc-label">Per {activeUnitLabel}</span>
                  <strong className="log-calc-val">{fmt$(Number(totalSpent) / Number(quantity))}</strong>
                </div>
              </div>
            )}

            <div className="log-actions">
              <button type="submit" className="btn" disabled={saving || !selectedViceId} style={{ minWidth: 140 }}>
                {saving
                  ? <><div className="btn-spinner" />{editingEntry ? 'Updating…' : 'Saving…'}</>
                  : editingEntry ? 'Update Entry' : Number(quantity) === 0 ? '🌿 Log Clean Day' : 'Save Entry'
                }
              </button>
              {editingEntry && (
                <button type="button" className="btn ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>

            {errorMsg && <div className="inline-error">{errorMsg}</div>}

            {savedMsg && (
              <div className={`inline-success`}>
                {savedMsg.includes('Clean') ? '🌿 ' : '✓ '}{savedMsg}
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
                  <div key={e.id} className={`entry-item ${isClean ? 'clean' : ''}${editingEntry?.id === e.id ? ' editing' : ''}`}>
                    <span className="entry-date">
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {isClean ? (
                      <span className="text-money entry-label">Clean day</span>
                    ) : (
                      <>
                        <span className="entry-qty">{formatQuantityWithUnit(e.quantity, activeVice)}</span>
                        <span className="entry-spend">{fmt$(e.quantity * e.price_per_unit)}</span>
                      </>
                    )}
                    <button type="button" className="entry-edit-btn" onClick={() => startEdit(e)}>
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {newBadges.length > 0 && (
        <BadgeCelebOverlay
          badges={newBadges}
          onDismiss={() => setNewBadges([])}
        />
      )}
    </main>
  );
}
