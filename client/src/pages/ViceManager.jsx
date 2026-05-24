import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';
import { formatQuantityWithUnit, getUnitLabel } from '../formatUnits';

const EMOJI_CHOICES = ['🍺','🚬','☕','🍷','🎰','🍕','🎮','💊','🍫','🛒','💸','🔴'];
const fmt$ = n => '$' + Number(n || 0).toFixed(2);
const fmtDate = value => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not logged yet';

function DetailStat({ label, value, sub }) {
  return (
    <div className="vice-detail-stat">
      <span className="vice-detail-label">{label}</span>
      <span className="vice-detail-value">{value}</span>
      {sub && <span className="vice-detail-sub">{sub}</span>}
    </div>
  );
}

function PeriodDetail({ label, data, vice }) {
  return (
    <div className="vice-period-card">
      <span className="vice-period-label">{label}</span>
      <span className="vice-period-spend">{fmt$(data?.spend)}</span>
      <span className="vice-period-qty">{formatQuantityWithUnit(data?.quantity || 0, vice)}</span>
    </div>
  );
}

function ViceCard({ vice, stats, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    name: vice.name,
    unit_label: vice.unit_label,
    default_price: vice.default_price,
    emoji: vice.emoji,
    category: vice.category,
    monthly_budget: vice.monthly_budget ?? '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    onUpdate(vice.id, {
      ...form,
      default_price: Number(form.default_price),
      monthly_budget: form.monthly_budget === '' ? null : Number(form.monthly_budget),
    });
    setEditing(false);
  };

  const budgetPct = vice.monthly_budget && stats
    ? Math.min(100, ((stats.month?.spend || 0) / vice.monthly_budget) * 100)
    : 0;
  const overBudget = stats && vice.monthly_budget && (stats.month?.spend || 0) > vice.monthly_budget;
  const unitLabel = getUnitLabel(vice);

  return (
    <div className="vice-card">
      <div className="vice-header">
        <div className="vice-identity">
          <span className="vice-emoji">{vice.emoji}</span>
          <div>
            <div className="vice-name-text">{vice.name}</div>
            <div className="vice-meta">
              {unitLabel} · {fmt$(vice.default_price)}/{unitLabel} · {vice.category}
              {vice.monthly_budget ? ` · ${fmt$(vice.monthly_budget)}/mo budget` : ''}
            </div>
          </div>
        </div>
        <div className="vice-actions">
          <button className="vice-expand-btn" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Hide details' : 'Full details'}
            <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
          </button>
          <button className="icon-btn" onClick={() => setEditing(e => !e)} title="Edit">✏️</button>
          <button className="icon-btn danger" onClick={() => onDelete(vice)} title="Delete">🗑️</button>
        </div>
      </div>

      {stats && (
        <div className="vice-stats-row">
          <span>{formatQuantityWithUnit(stats.avg_quantity_per_day || 0, vice)}/day</span>
          <span>{fmt$(stats.avg_price_per_unit)}/{unitLabel}</span>
          <span>{stats.total_logged_days} active days</span>
          {stats.clean_days > 0 && <span className="text-teal">{stats.clean_days} clean days</span>}
        </div>
      )}

      {vice.monthly_budget && stats && (
        <div className="budget-bar-wrap">
          <div className="budget-bar-label">
            <span>Monthly budget</span>
            <span style={{ color: overBudget ? '#E53535' : 'inherit' }}>
              {fmt$(stats.month?.spend || 0)} / {fmt$(vice.monthly_budget)}
            </span>
          </div>
          <div className="budget-bar">
            <div className="budget-bar-fill"
              style={{ width: `${budgetPct}%`, background: overBudget ? '#E53535' : '#0F6E56' }} />
          </div>
        </div>
      )}

      {expanded && stats && (
        <div className="vice-details-panel">
          <div className="vice-details-section">
            <div className="vice-details-heading">Totals</div>
            <div className="vice-detail-grid">
              <DetailStat label="Default price" value={`${fmt$(vice.default_price)}/${unitLabel}`} />
              <DetailStat label="Average price" value={`${fmt$(stats.avg_price_per_unit)}/${unitLabel}`} />
              <DetailStat label="All-time spent" value={fmt$(stats.all_time?.spend)} />
              <DetailStat label="All-time quantity" value={formatQuantityWithUnit(stats.all_time?.quantity || 0, vice)} />
              <DetailStat label="Active days" value={stats.total_logged_days || 0} sub={`${stats.clean_days || 0} clean days`} />
              <DetailStat label="Logged range" value={fmtDate(stats.first_entry_date)} sub={`Last: ${fmtDate(stats.last_entry_date)}`} />
            </div>
          </div>

          <div className="vice-details-section">
            <div className="vice-details-heading">Current spend + quantity</div>
            <div className="vice-period-grid">
              <PeriodDetail label="Today" data={stats.today} vice={vice} />
              <PeriodDetail label="This week" data={stats.week} vice={vice} />
              <PeriodDetail label="This month" data={stats.month} vice={vice} />
              <PeriodDetail label="This year" data={stats.year} vice={vice} />
            </div>
          </div>

          <div className="vice-details-section">
            <div className="vice-details-heading">Average pace</div>
            <div className="vice-period-grid">
              <PeriodDetail label="Per day" data={stats.averages?.day} vice={vice} />
              <PeriodDetail label="Per week" data={stats.averages?.week} vice={vice} />
              <PeriodDetail label="Per month" data={stats.averages?.month} vice={vice} />
              <PeriodDetail label="Per year" data={stats.averages?.year} vice={vice} />
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="edit-panel">
          <div className="emoji-picker">
            {EMOJI_CHOICES.map(e => (
              <button key={e} type="button" className={`emoji-btn ${form.emoji === e ? 'active' : ''}`}
                onClick={() => set('emoji', e)}>{e}</button>
            ))}
            <input className="emoji-custom" value={form.emoji} maxLength={2} placeholder="✏️"
              onChange={e => set('emoji', e.target.value)} />
          </div>
          <div className="edit-grid">
            {[
              ['name', 'Name', 'text'],
              ['unit_label', 'Unit label', 'text'],
              ['default_price', 'Default price ($)', 'number'],
              ['category', 'Category', 'text'],
              ['monthly_budget', 'Monthly budget ($)', 'number'],
            ].map(([key, label, type]) => (
              <div key={key} className="form-group">
                <label className="form-label">{label}</label>
                <input type={type} className="form-input" value={form[key]}
                  min={type === 'number' ? 0 : undefined}
                  step={type === 'number' ? '0.01' : undefined}
                  onChange={e => set(key, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="edit-actions">
            <button className="btn btn-primary" onClick={handleSave}>Save changes</button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ViceManager() {
  const api = useApi();
  const { loadVices: ctxLoadVices } = useViceContext();
  const [vices, setVices] = useState([]);
  const [viceStats, setViceStats] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addForm, setAddForm] = useState({
    name: '', unit_label: '', default_price: '', emoji: '🔴', category: 'Other', monthly_budget: ''
  });
  const setAdd = (k, v) => setAddForm(f => ({ ...f, [k]: v }));

  const loadVices = useCallback(async () => {
    const data = await api('/api/vices');
    setVices(data);
    const statsMap = {};
    await Promise.all(data.map(async v => {
      try { statsMap[v.id] = await api(`/api/stats/${v.id}`); } catch (_) {}
    }));
    setViceStats(statsMap);
  }, []);

  useEffect(() => { loadVices().catch(console.error); }, []);

  const handleUpdate = async (id, fields) => {
    await api(`/api/vices/${id}`, { method: 'PUT', body: JSON.stringify(fields) });
    loadVices();
    ctxLoadVices();
  };

  const handleDeleteClick = (vice) => {
    const s = viceStats[vice.id];
    const entryCount = s ? (s.total_logged_days + s.clean_days) : '?';
    setDeleteTarget({ ...vice, entryCount });
  };

  const handleDeleteConfirm = async () => {
    await api(`/api/vices/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    loadVices();
    ctxLoadVices();
  };

  const handleAdd = async e => {
    e.preventDefault();
    await api('/api/vices', {
      method: 'POST',
      body: JSON.stringify({
        ...addForm,
        default_price: Number(addForm.default_price) || 0,
        monthly_budget: addForm.monthly_budget === '' ? null : Number(addForm.monthly_budget),
      }),
    });
    setAddForm({ name: '', unit_label: '', default_price: '', emoji: '🔴', category: 'Other', monthly_budget: '' });
    setShowAdd(false);
    loadVices();
    ctxLoadVices();
  };

  return (
    <main className="main">
      <div className="crumbs">
        <span>Vice Spending</span>
        <span className="sep">›</span>
        <span className="here">Vices</span>
      </div>
      <div className="page-header">
        <div className="page-title">Vice Manager</div>
        <button className="btn btn-primary" onClick={() => setShowAdd(s => !s)}>
          {showAdd ? 'Cancel' : '+ Add vice'}
        </button>
      </div>

      {showAdd && (
        <div className="card add-panel">
          <div className="card-header"><span className="card-title">New Vice</span></div>
          <form onSubmit={handleAdd}>
            <div className="emoji-picker">
              {EMOJI_CHOICES.map(e => (
                <button key={e} type="button" className={`emoji-btn ${addForm.emoji === e ? 'active' : ''}`}
                  onClick={() => setAdd('emoji', e)}>{e}</button>
              ))}
              <input className="emoji-custom" value={addForm.emoji} maxLength={2} placeholder="✏️"
                onChange={e => setAdd('emoji', e.target.value)} />
            </div>
            <div className="edit-grid">
              {[
                ['name', 'Name *', 'text', true],
                ['unit_label', 'Unit label (optional)', 'text', false],
                ['default_price', 'Default price ($)', 'number', false],
                ['category', 'Category', 'text', false],
                ['monthly_budget', 'Monthly budget ($)', 'number', false],
              ].map(([key, label, type, required]) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <input type={type} className="form-input" value={addForm[key]}
                    required={required}
                    placeholder={key === 'unit_label' && addForm.name ? getUnitLabel({ name: addForm.name }) : undefined}
                    min={type === 'number' ? 0 : undefined}
                    step={type === 'number' ? '0.01' : undefined}
                    onChange={e => setAdd(key, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="edit-actions">
              <button type="submit" className="btn btn-primary">Add vice</button>
            </div>
          </form>
        </div>
      )}

      {vices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔴</div>
          <h2>No vices tracked yet</h2>
          <p>Add your first vice to start tracking your spending habits.</p>
          {!showAdd && (
            <button className="btn btn-primary" style={{ marginTop: 8 }}
              onClick={() => setShowAdd(true)}>
              Add your first vice
            </button>
          )}
        </div>
      ) : (
        <div className="vice-list">
          {vices.map(v => (
            <ViceCard key={v.id} vice={v} stats={viceStats[v.id]}
              onUpdate={handleUpdate} onDelete={handleDeleteClick} />
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Delete {deleteTarget.emoji} {deleteTarget.name}?</div>
            <p className="modal-body">
              This will permanently delete this vice and all its entries.
              {deleteTarget.entryCount !== '?'
                ? ` ${deleteTarget.entryCount} logged entries will be lost.`
                : ' All logged entries will be lost.'}
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>Yes, delete</button>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
