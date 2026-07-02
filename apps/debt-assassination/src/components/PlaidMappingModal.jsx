import { useState } from 'react'

export default function PlaidMappingModal({ accounts, debts, onSave, onClose }) {
  const [map, setMap] = useState({})

  const activeDebts = debts.filter(d => d.balance > 0)

  function handleChange(accountId, debtId) {
    setMap(prev => ({ ...prev, [accountId]: debtId || null }))
  }

  function handleSave() {
    const mappings = {}
    for (const [accountId, debtId] of Object.entries(map)) {
      if (debtId) mappings[accountId] = debtId
    }
    onSave(mappings)
  }

  return (
    <div className="mapping-overlay" onClick={onClose}>
      <div className="mapping-card" onClick={e => e.stopPropagation()}>
        <div className="mapping-corner tl" />
        <div className="mapping-corner br" />

        <div className="mapping-eyebrow">// PLAID LINK</div>
        <h2 className="mapping-title">MAP YOUR ACCOUNTS</h2>
        <p className="mapping-desc">
          These bank accounts couldn't be matched automatically. Select the debt card each one corresponds to.
        </p>

        <div className="mapping-list">
          {accounts.map(acct => (
            <div key={acct.account_id} className="mapping-row">
              <div className="mapping-acct">
                <div className="mapping-acct-name">{acct.name}</div>
                {acct.official_name && acct.official_name !== acct.name && (
                  <div className="mapping-acct-official">{acct.official_name}</div>
                )}
                {acct.balances.current != null && (
                  <div className="mapping-acct-bal">${acct.balances.current.toFixed(2)}</div>
                )}
              </div>
              <div className="mapping-arrow">→</div>
              <select
                className="mapping-select"
                value={map[acct.account_id] || ''}
                onChange={e => handleChange(acct.account_id, e.target.value)}
              >
                <option value="">-- SELECT DEBT --</option>
                {activeDebts.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.lender} (${d.balance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="mapping-actions">
          <button className="mapping-btn-skip" onClick={onClose}>SKIP</button>
          <button
            className="mapping-btn-save"
            onClick={handleSave}
            disabled={Object.values(map).every(v => !v)}
          >
            SAVE MAPPINGS
          </button>
        </div>
      </div>
    </div>
  )
}
