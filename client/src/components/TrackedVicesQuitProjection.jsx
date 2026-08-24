import { useEffect, useRef, useState } from 'react';
import { useApi } from '../useApi';
import { useViceContext } from '../ViceContext';

const MILESTONES = [
  { days: 365, label: '1 Year' },
  { days: 1825, label: '5 Years' },
  { days: 3650, label: '10 Years' },
  { days: 7300, label: '20 Years' },
  { days: 10950, label: '30 Years' },
];

const fmt$2 = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TrackedVicesQuitProjection() {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;
  const { vices } = useViceContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [horizon, setHorizon] = useState(365);
  const [actualSavingsBalance, setActualSavingsBalance] = useState(0);

  useEffect(() => {
    if (vices.length === 0) {
      setData(null);
      return;
    }

    setLoading(true);
    Promise.all(vices.map(async vice => {
      const savings = await apiRef.current(`/api/savings/${vice.id}?days=1825`);
      return { vice, savings };
    }))
      .then(results => {
        const perDay = results.reduce((sum, { savings }) => sum + Number(savings.per_day || 0), 0);
        setData({
          per_day: perDay,
          per_week: perDay * 7,
          per_month: perDay * 30.44,
          byVice: results,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [vices]);

  useEffect(() => {
    apiRef.current('/api/savings/combined-accounts?refresh=0')
      .then(payload => {
        if (payload.accounts?.length) {
          setActualSavingsBalance(Number(payload.combinedBalance || 0));
          return;
        }
        return apiRef.current('/api/savings/balance').then(balance => setActualSavingsBalance(Number(balance.balance || 0)));
      })
      .catch(() => {
        apiRef.current('/api/savings/balance')
          .then(balance => setActualSavingsBalance(Number(balance.balance || 0)))
          .catch(() => {});
      });
  }, []);

  const perDay = data?.per_day || 0;
  const projected = perDay * horizon;
  const projectedVsActual = actualSavingsBalance > 0 ? projected / actualSavingsBalance : 0;

  if (!loading && perDay <= 0 && !data?.byVice?.length) return null;

  return (
    <div className="sv-hero vice-quit-projection">
      <div className="sv-hero-eyebrow">
        If you quit <em>all tracked vices</em> for
      </div>
      <div className="sv-horizon-row">
        {MILESTONES.map(m => (
          <button
            key={m.days}
            className={`sv-horizon-btn${horizon === m.days ? ' on' : ''}`}
            onClick={() => setHorizon(m.days)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ padding: '12px 0' }}>
          <div className="skeleton" style={{ height: 90, width: 300, borderRadius: 8, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 999 }} />
            <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 999 }} />
            <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 999 }} />
          </div>
        </div>
      ) : (
        <>
          <div className="sv-amount-row">
            <span className="sv-dollar">$</span>
            <span className="sv-big-num">
              {Number(projected).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="sv-chips">
            <span className="sv-chip">
              <span className="sv-chip-lbl">per day</span>{fmt$2(perDay)}
            </span>
            <span className="sv-chip">
              <span className="sv-chip-lbl">per week</span>{fmt$2(perDay * 7)}
            </span>
            <span className="sv-chip">
              <span className="sv-chip-lbl">per month</span>{fmt$2(perDay * 30.44)}
            </span>
            {actualSavingsBalance > 0 && (
              <span className="sv-chip sv-chip-positive">
                <span className="sv-chip-lbl">vs saved now</span>{projectedVsActual.toFixed(1)}× current balance
              </span>
            )}
          </div>
          {data?.byVice?.length > 0 && (
            <div className="sv-chips" style={{ marginTop: 12 }}>
              {data.byVice.map(({ vice, savings }) => (
                <span key={vice.id} className="sv-chip">
                  <span className="sv-chip-lbl">{vice.emoji} {vice.name}</span>{fmt$2(savings.per_day)}/day
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
