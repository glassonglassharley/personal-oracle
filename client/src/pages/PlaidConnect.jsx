import { useState, useEffect, useCallback, useRef } from 'react';
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

function bestMatchVice(userVices, categoryRaw) {
  if (!userVices.length) return null;
  if (!categoryRaw) return userVices[0];

  // Prefer explicit plaid_categories mapping set by the user
  const explicit = userVices.find(v => {
    try {
      const cats = Array.isArray(v.plaid_categories)
        ? v.plaid_categories
        : JSON.parse(v.plaid_categories || '[]');
      return cats.includes(categoryRaw);
    } catch { return false; }
  });
  if (explicit) return explicit;

  // Fallback: fuzzy match on vice name vs category label
  const label = categoryLabel(categoryRaw).toLowerCase();
  return (
    userVices.find(v =>
      label.includes(v.name.toLowerCase()) || v.name.toLowerCase().includes(label)
    ) || userVices[0]
  );
}

// Navy Federal Credit Union official Plaid institution ID
const NAVY_FEDERAL_INSTITUTION_ID = 'ins_133383';
const NAVY_FEDERAL_NAME = 'Navy Federal Credit Union';

export default function PlaidConnect({ vices }) {
  const api = useApi();
  const [userVices, setUserVices] = useState([]);
  const [status, setStatus] = useState(null);       // null | { connected: false } | { connected: true, banks: string[] }
  const [linking, setLinking] = useState(false);
  const oauthResumed = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(new Set());
  const [skipped, setSkipped] = useState(new Set());
  const [logged, setLogged] = useState(new Set());
  const [selectedVices, setSelectedVices] = useState({}); // { [transactionId]: viceId }
  // Pending exchange: set after Plaid Link succeeds, cleared after user confirms or cancels
  const [pendingExchange, setPendingExchange] = useState(null); // { public_token, institution_name } | null

  useEffect(() => {
    api('/api/plaid/status').then(setStatus).catch(() => setStatus({ connected: false }));
    api('/api/vices').then(setUserVices).catch(() => {});

    // Resume OAuth flow if returning from bank redirect
    const params = new URLSearchParams(window.location.search);
    if (params.has('oauth_state_id') && !oauthResumed.current) {
      oauthResumed.current = true;
      const storedToken = sessionStorage.getItem('plaid_link_token');
      if (storedToken) {
        resumeOAuthFlow(storedToken);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resumeOAuthFlow = useCallback(async (token) => {
    setLinking(true);
    setError('');
    try {
      await loadPlaidScript();
      const handler = window.Plaid.create({
        token,
        receivedRedirectUri: window.location.href,
        onSuccess: (public_token, metadata) => {
          const institution_name = metadata.institution?.name || '';
          setLinking(false);
          setPendingExchange({ public_token, institution_name });
          sessionStorage.removeItem('plaid_link_token');
          window.history.replaceState({}, '', window.location.pathname);
        },
        onExit: (err) => {
          if (err) setError(err.error_message || 'Plaid Link closed with an error.');
          setLinking(false);
          sessionStorage.removeItem('plaid_link_token');
        },
      });
      handler.open();
    } catch (err) {
      setError(err.message || 'Could not resume bank connection');
      setLinking(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When transactions or userVices arrive, seed selectedVices with the best-match vice per tx
  useEffect(() => {
    if (!transactions || !userVices.length) return;
    setSelectedVices(prev => {
      const next = { ...prev };
      transactions.forEach(tx => {
        if (!(tx.transaction_id in next)) {
          const match = bestMatchVice(userVices, tx.category);
          next[tx.transaction_id] = match?.id ?? userVices[0]?.id;
        }
      });
      return next;
    });
  }, [transactions, userVices]);

  const openPlaidLink = useCallback(async (institutionId = null) => {
    setLinking(true);
    setError('');
    setPendingExchange(null);
    try {
      await loadPlaidScript();
      const body = institutionId ? JSON.stringify({ institution_id: institutionId }) : undefined;
      const { link_token } = await api('/api/plaid/create-link-token', {
        method: 'POST',
        ...(body ? { body } : {}),
      });

      // Store for OAuth redirect resume
      sessionStorage.setItem('plaid_link_token', link_token);

      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: (public_token, metadata) => {
          const institution_name = metadata.institution?.name || '';
          sessionStorage.removeItem('plaid_link_token');
          setLinking(false);
          // Hold for user confirmation before exchanging the token
          setPendingExchange({ public_token, institution_name });
        },
        onExit: (err) => {
          if (err) setError(err.error_message || 'Plaid Link closed with an error. Please try again.');
          sessionStorage.removeItem('plaid_link_token');
          setLinking(false);
        },
      });
      handler.open();
    } catch (err) {
      setError(err.message || 'Could not connect bank');
      setLinking(false);
    }
  }, [api]);

  const confirmExchange = useCallback(async () => {
    if (!pendingExchange) return;
    setLinking(true);
    setError('');
    try {
      const { public_token, institution_name } = pendingExchange;
      await api('/api/plaid/exchange-token', {
        method: 'POST',
        body: JSON.stringify({ public_token, institution_name }),
      });
      setStatus(prev => ({
        connected: true,
        banks: [...(prev?.banks || []), institution_name || 'Bank'],
      }));
      setPendingExchange(null);
    } catch (err) {
      setError(err.message || 'Could not connect bank');
    } finally {
      setLinking(false);
    }
  }, [api, pendingExchange]);

  const cancelExchange = useCallback(() => {
    setPendingExchange(null);
    setError('');
  }, []);

  const syncTransactions = async () => {
    setSyncing(true);
    setError('');
    setTransactions(null);
    setConfirmed(new Set());
    setSkipped(new Set());
    setLogged(new Set());
    setSelectedVices({});
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
    if (logging) return;
    const toLog = transactions.filter(tx => confirmed.has(tx.transaction_id));
    if (!toLog.length || !userVices.length) return;

    setLogging(true);
    const completedIds = new Set();

    try {
      for (const tx of toLog) {
        const viceId = selectedVices[tx.transaction_id] ?? userVices[0].id;
        try {
          await api('/api/entries', {
            method: 'POST',
            body: JSON.stringify({
              vice_id: viceId,
              date: tx.date,
              quantity: 1,
              price_per_unit: tx.amount,
              note: `${tx.merchant} (imported from bank)`,
              import_source: 'plaid',
              external_transaction_id: tx.transaction_id,
            }),
          });
          completedIds.add(tx.transaction_id);
        } catch {
          // Keep failed entries selected so the user can retry.
        }
      }

      if (completedIds.size > 0) {
        setLogged(prev => new Set([...prev, ...completedIds]));
        setTransactions(prev => prev.filter(tx => !completedIds.has(tx.transaction_id)));
        setConfirmed(prev => new Set([...prev].filter(id => !completedIds.has(id))));
      }
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="panel plaid-panel">
      <div className="panel-head">
        <span className="panel-title">🏦 Bank import</span>
        {status?.connected && (status.banks || []).map((name, i) => (
          <span key={i} className="plaid-connected-badge" style={i > 0 ? { marginLeft: 4 } : {}}>
            ✓ {name || 'Bank connected'}
          </span>
        ))}
      </div>

      {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Institution confirmation — shown after Plaid Link succeeds, before token exchange */}
      {pendingExchange && (
        <div className="plaid-confirm" style={{ marginBottom: 16, padding: '12px 14px', border: '1px solid var(--border, #333)', borderRadius: 8, background: 'var(--surface2, #1a1a1a)' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Confirm your bank</p>
          <p style={{ margin: '0 0 12px', color: 'var(--fg2, #aaa)', fontSize: 14 }}>
            You selected: <strong style={{ color: 'var(--fg, #fff)' }}>{pendingExchange.institution_name || 'Unknown institution'}</strong>
            {pendingExchange.institution_name === NAVY_FEDERAL_NAME && (
              <span style={{ marginLeft: 6, color: 'var(--money, #5ec48a)', fontSize: 12 }}>✓ Verified Navy Federal</span>
            )}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={confirmExchange} disabled={linking} style={{ fontSize: 13 }}>
              {linking ? 'Connecting…' : 'Yes, connect this bank'}
            </button>
            <button className="btn ghost" onClick={cancelExchange} disabled={linking} style={{ fontSize: 13 }}>
              No, go back
            </button>
          </div>
        </div>
      )}

      {!pendingExchange && !status?.connected ? (
        <div className="plaid-cta">
          <p className="plaid-copy">
            Connect your bank to automatically find vice-related purchases — alcohol, bars,
            coffee, fast food, tobacco, gambling — and import them as log entries.
          </p>
          <button className="btn btn-primary" onClick={() => openPlaidLink()} disabled={linking}>
            {linking ? 'Connecting…' : '+ Connect Bank'}
          </button>
          <button
            className="btn ghost"
            onClick={() => openPlaidLink(NAVY_FEDERAL_INSTITUTION_ID)}
            disabled={linking}
            style={{ marginTop: 8, fontSize: 13 }}
            title="Opens Navy Federal Credit Union directly — bypasses search"
          >
            {linking ? 'Connecting…' : '⚓ Connect Navy Federal directly'}
          </button>
        </div>
      ) : !pendingExchange && status?.connected ? (
        <div className="plaid-actions">
          <button className="btn" onClick={syncTransactions} disabled={syncing}>
            {syncing ? 'Scanning…' : '⬇ Import Transactions'}
          </button>
          <button className="btn ghost" onClick={() => openPlaidLink()} disabled={linking} style={{ fontSize: 12 }}>
            {linking ? 'Connecting…' : 'Add bank'}
          </button>
        </div>
      ) : null}

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
                      {/* Top row: merchant + amount + buttons */}
                      <div className="plaid-tx-top">
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

                      {/* Vice selector row — always visible when not yet logged */}
                      {!isLogged && userVices.length > 0 && (
                        <div className="plaid-tx-vice-row">
                          <span className="plaid-tx-vice-label">Log to:</span>
                          <select
                            className="plaid-tx-vice-select"
                            value={selectedVices[tx.transaction_id] ?? ''}
                            onChange={e =>
                              setSelectedVices(prev => ({ ...prev, [tx.transaction_id]: Number(e.target.value) }))
                            }
                          >
                            {userVices.map(v => (
                              <option key={v.id} value={v.id}>{v.emoji} {v.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {confirmed.size > 0 && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 16 }}
                  onClick={logSelected}
                  disabled={logging}
                >
                  {logging ? 'Logging…' : `Log ${confirmed.size} selected entr${confirmed.size === 1 ? 'y' : 'ies'}`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
