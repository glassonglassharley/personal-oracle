import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';

const PAGE_SIZE = 50;

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = s => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function History() {
  const api = useApi();
  const { vices } = useViceContext();

  const [entries, setEntries]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [spendTotal, setSpendTotal] = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const [filterVice, setFilterVice]   = useState('');
  const [filterFrom, setFilterFrom]   = useState('');
  const [filterTo, setFilterTo]       = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimer = useRef(null);

  const [deleting, setDeleting] = useState(new Set());
  const [deleted,  setDeleted]  = useState(new Set());

  const load = useCallback(async (pg = 0, viceId = filterVice, from = filterFrom, to = filterTo, search = filterSearch) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: pg * PAGE_SIZE });
      if (viceId) params.set('vice_id', viceId);
      if (from)   params.set('from', from);
      if (to)     params.set('to', to);
      if (search) params.set('search', search);
      const data = await api(`/api/entries/all?${params}`);
      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setSpendTotal(data.spend_total || 0);
      setPage(pg);
    } catch (err) {
      setError(err.message || 'Could not load entries.');
    } finally {
      setLoading(false);
    }
  }, [api, filterVice, filterFrom, filterTo, filterSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(0, filterVice, filterFrom, filterTo, filterSearch); },
    [filterVice, filterFrom, filterTo, filterSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search input → filterSearch
  const handleSearchChange = e => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setFilterSearch(val.trim()), 400);
  };

  const handleDelete = async (id) => {
    setDeleting(prev => new Set([...prev, id]));
    try {
      await api(`/api/entries/${id}`, { method: 'DELETE' });
      setDeleted(prev => new Set([...prev, id]));
      setTotal(t => t - 1);
    } catch {
      setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const totalPages  = Math.ceil(total / PAGE_SIZE);
  const visibleEntries = entries.filter(e => !deleted.has(e.id));

  return (
    <main className="main hist-page">
      <div className="crumbs">
        <span>Vice Tracker</span>
        <span className="sep">›</span>
        <span className="here">Transaction Log</span>
      </div>

      {/* Filters */}
      <div className="hist-filters">
        <select
          className="hist-filter-select"
          value={filterVice}
          onChange={e => { setFilterVice(e.target.value); }}
        >
          <option value="">All vices</option>
          {vices.map(v => (
            <option key={v.id} value={v.id}>{v.emoji} {v.name}</option>
          ))}
        </select>

        <input
          type="date"
          className="hist-filter-date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          title="From date"
        />
        <span className="hist-date-sep">—</span>
        <input
          type="date"
          className="hist-filter-date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          title="To date"
        />

        <input
          type="search"
          className="hist-filter-search"
          placeholder="Search notes or vice…"
          value={searchInput}
          onChange={handleSearchChange}
        />

        {(filterVice || filterFrom || filterTo || filterSearch) && (
          <button className="btn ghost hist-clear-btn" onClick={() => {
            setFilterVice(''); setFilterFrom(''); setFilterTo('');
            setFilterSearch(''); setSearchInput('');
          }}>
            Clear
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="hist-summary">
        <span className="hist-summary-item">
          <span className="hist-summary-label">Showing</span>
          <strong>{total.toLocaleString()} entries</strong>
        </span>
        <span className="hist-summary-item">
          <span className="hist-summary-label">Total spent</span>
          <strong style={{ color: 'var(--warn)' }}>{fmt$(spendTotal)}</strong>
        </span>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Entry list */}
      {loading ? (
        <div className="hist-loading">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8, marginBottom: 6 }} />
          ))}
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h2>No entries found</h2>
          <p>{filterVice || filterFrom || filterTo || filterSearch ? 'Try adjusting your filters.' : 'Start logging to see your history here.'}</p>
        </div>
      ) : (
        <div className="hist-list">
          {visibleEntries.map(entry => {
            const amount = entry.quantity * entry.price_per_unit;
            const isDel  = deleting.has(entry.id);
            return (
              <div key={entry.id} className="hist-row">
                <div className="hist-row-date">{fmtDate(entry.date)}</div>
                <div className="hist-row-vice">
                  <span className="hist-row-emoji">{entry.vice_emoji}</span>
                  <span className="hist-row-vice-name">{entry.vice_name}</span>
                </div>
                <div className="hist-row-amount spent">{fmt$(amount)}</div>
                <div className="hist-row-detail">
                  {entry.quantity} × {fmt$(entry.price_per_unit)}
                </div>
                {entry.note && (
                  <div className="hist-row-note" title={entry.note}>{entry.note}</div>
                )}
                <button
                  className="hist-delete-btn"
                  title="Delete entry"
                  onClick={() => handleDelete(entry.id)}
                  disabled={isDel}
                >
                  {isDel ? '…' : '×'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="hist-pagination">
          <button
            className="btn ghost"
            disabled={page === 0 || loading}
            onClick={() => load(page - 1)}
          >
            ← Prev
          </button>
          <span className="hist-page-info">
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="btn ghost"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => load(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </main>
  );
}
