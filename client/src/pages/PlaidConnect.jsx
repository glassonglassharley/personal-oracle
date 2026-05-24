import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../useApi';

function loadPlaidScript() {
  return new Promise((resolve, reject) => {
    if (window.Plaid) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Plaid Link script'));
    document.head.appendChild(script);
  });
}

const CATEGORY_LABELS = {
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: 'Alcohol',
  FOOD_AND_DRINK_BAR: 'Bar',
  FOOD_AND_DRINK_FAST_FOOD: 'Fast Food',
  FOOD_AND_DRINK_COFFEE: 'Coffee',
  FOOD_AND_DRINK_RESTAURANTS: 'Restaurant',
  GAMBLING: 'Gambling',
  ENTERTAINMENT_CASINOS_AND_GAMBLING: 'Casino / Gambling',
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPING: 'Tobacco / Vaping',
  PERSONAL_CARE_TOBACCO_AND_SMOKING: 'Tobacco / Smoking',
};

function categoryLabel(raw) {
  if (!raw) return 'Vice';
  return CATEGORY_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\w\S*/g, w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}

export default function PlaidConnect({ vices }) {
  const api = useApi();
  const [status, setStatus] = useState(null);       // null | { connected, institution_name }
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(new Set());
  const [skipped, setSkipped] = useState(new Set());
  const [logged, setLogged] = useState(new Set());

  useEffect(() => {
    api('/api/plaid/status').then(setStatus).catch(() => setStatus({ connected: false }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openPlaidLink = useCallback(async () => {
    setLinking(true);
    setError('');
    try {
      await loadPlaidScript();
      const { link_token } = await api('/api/plaid/create-link-token', { method: 'POST' });

      await new Promise((resolve, reject) => {
        const handler = window.Plaid.create({
          token: link_token,
          onSuccess: async (public_token, metadata) => {
            try {
              const institution_name = metadata.institution?.name || '';
              await api('/api/plaid/exchange-token', {
                method: 'POST',
                body: JSON.stringify({ public_token, institution_name }),
              });
              setStatus({ connected: true, institution_name });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          onExit: (err) => {
            if (err) reject(new Error(err.error_message || 'Plaid Link closed'));
            else resolve();
          },
        });
        handler.open();
      });
    } catch (err) {
      setError(err.message || 'Could not connect bank');
    } finally {
      setLinking(false);
    }
  }, [api]);

  const syncTransactions = async () => {
    setSyncing(true);
    setError('');
    setTransactions(null);
    setConfirmed(new Set());
    setSkipped(new Set());
    setLogged(new Set());
    try {
      const data = await api('/api/plaid/sync', { method: 'POST' });
      setTransactions(data.transactions);
    } catch (err) {
      setError(err.message || 'Could not fetch transactions');
    } finally {
      setSyncing(false);
    }
  };

  const toggleConfirm = (id) => {
    setConfirmed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSkipped(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleSkip = (id) => {
    setSkipped(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setConfirmed(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const logSelected = async () => {
    const toLog = transactions.filter(tx => confirmed.has(tx.transaction_id));
    if (!toLog.length || !vices.length) return;

    const defaultVice = vices[0];
    let loggedCount = 0;

    for (const tx of toLog) {
      try {
        await api('/api/entries', {
          method: 'POST',
          body: JSON.stringify({
            vice_id: defaultVice.id,
            date: tx.date,
            quantity: 1,
            price_per_unit: tx.amount,
            note: `${tx.merchant} (imported from bank)`,
          }),
        });
        setLogged(prev => new Set([...prev, tx.transaction_id]));
        loggedCount++;
      } catch {
        // skip duplicates silently
      }
    }

    setConfirmed(new Set());
    if (loggedCount > 0) {
      setTransactions(prev => prev.filter(tx => !logged.has(tx.transaction_id)));
    }
  };

  if (!status) return null;

  return (
    <div className="panel plaid-panel">
      <div className="panel-head">
        <span className="panel-title">🏦 Bank import</span>
        {status.connected && (
          <span className="plaid-connected-badge">
            ✓ {status.institution_name || 'Bank connected'}
          </span>
        )}
      </div>

      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

      {!status.connected ? (
        <div className="plaid-cta">
          <p className="plaid-copy">
            Connect your bank to automatically find vice-related purchases — alcohol, bars,
            coffee, fast food, tobacco, gambling — and import them as log entries.
          </p>
          <button className="btn btn-primary" onClick={openPlaidLink} disabled={linking}>
            {linking ? 'Connecting…' : '+ Connect Bank'}
          </button>
        </div>
      ) : (
        <div className="plaid-actions">
          <button className="btn" onClick={syncTransactions} disabled={syncing}>
            {syncing ? 'Scanning…' : '⬇ Import Transactions'}
          </button>
          <button className="btn ghost" onClick={openPlaidLink} disabled={linking} style={{ fontSize: 12 }}>
            {linking ? 'Connecting…' : 'Switch bank'}
          </button>
        </div>
      )}

      {transactions !== null && (
        <div className="plaid-results">
          {transactions.length === 0 ? (
            <p className="text-muted" style={{ marginTop: 16 }}>
              No vice-related transactions found in the last 90 days.
            </p>
          ) : (
            <>
              <div className="plaid-results-head">
                <span>{transactions.length} vice-related transactions found</span>
                {vices.length > 0 && (
                  <span className="plaid-vice-note">
                    Will log to: {vices[0].emoji} {vices[0].name}
                  </span>
                )}
              </div>
              <div className="plaid-tx-list">
                {transactions.map(tx => {
                  const isLogged = logged.has(tx.transaction_id);
                  const isConfirmed = confirmed.has(tx.transaction_id);
                  const isSkipped = skipped.has(tx.transaction_id);
                  return (
                    <div
                      key={tx.transaction_id}
                      className={`plaid-tx${isLogged ? ' plaid-tx-logged' : isConfirmed ? ' plaid-tx-confirmed' : isSkipped ? ' plaid-tx-skipped' : ''}`}
                    >
                      <div className="plaid-tx-info">
                        <span className="plaid-tx-merchant">{tx.merchant}</span>
                        <span className="plaid-tx-cat">{categoryLabel(tx.category)}</span>
                        <span className="plaid-tx-date">{tx.date}</span>
                      </div>
                      <span className="plaid-tx-amount">${Number(tx.amount).toFixed(2)}</span>
                      <div className="plaid-tx-actions">
                        {isLogged ? (
                          <span className="plaid-tx-done">✓ Logged</span>
                        ) : (
                          <>
                            <button
                              className={`plaid-tx-btn${isConfirmed ? ' on' : ''}`}
                              onClick={() => toggleConfirm(tx.transaction_id)}
                            >
                              {isConfirmed ? '✓ Log' : 'Log'}
                            </button>
                            <button
                              className={`plaid-tx-btn skip${isSkipped ? ' on' : ''}`}
                              onClick={() => toggleSkip(tx.transaction_id)}
                            >
                              Skip
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {confirmed.size > 0 && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 16 }}
                  onClick={logSelected}
                >
                  Log {confirmed.size} selected entr{confirmed.size === 1 ? 'y' : 'ies'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
