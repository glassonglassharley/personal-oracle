import { useState } from 'react'

export default function DebtRow({ debt, rank, isActive, onPay, onEdit, onUpdateMinPayment, onSetApr, onSetAutopay }) {
  const [editMin, setEditMin] = useState(false)
  const [minVal, setMinVal] = useState('')
  const [editAutopay, setEditAutopay] = useState(false)
  const [autopayVal, setAutopayVal] = useState('')

  const isPaid = debt.balance <= 0
  const isOverLimit = debt.balance > debt.limit
  const pctCleared = Math.max(0, Math.min(100,
    ((debt.originalBalance - debt.balance) / debt.originalBalance) * 100
  ))
  const pctUtil = debt.limit > 0 ? Math.min(9999, (debt.balance / debt.limit) * 100) : null
  const dailyInterest = debt.apr ? ((debt.apr / 100) / 365) * debt.balance : null

  const saveMin = () => {
    onUpdateMinPayment(minVal)
    setEditMin(false)
    setMinVal('')
  }

  const saveAutopay = () => {
    const amt = parseFloat(autopayVal)
    onSetAutopay?.(true, isNaN(amt) || amt <= 0 ? null : amt)
    setEditAutopay(false)
    setAutopayVal('')
  }

  const toggleAutopay = () => {
    if (debt.autopayEnabled) {
      onSetAutopay?.(false, null)
    } else {
      setAutopayVal(debt.autopayAmount || '')
      setEditAutopay(true)
    }
  }

  if (isPaid) {
    return (
      <div className="debt-row is-paid">
        <div className="debt-row-paid-inner">
          <span className="debt-paid-check">✓</span>
          <span className="debt-paid-name">{debt.lender}</span>
          <span className="debt-paid-badge">
            ${debt.originalBalance.toFixed(0)} PAID
            {debt.minPayment ? ` · $${debt.minPayment}/mo freed` : ''}
          </span>
        </div>
        <div className="debt-paid-bar">
          <div className="debt-paid-bar-fill" />
        </div>
      </div>
    )
  }

  return (
    <div className={`debt-row${isActive ? ' is-active' : ''}`}>
      {isOverLimit && <div className="overlimit-badge">OVER LIMIT</div>}

      <div className="debt-row-top">
        <span className="debt-rank">{rank}</span>
        <div className="debt-lender-block">
          <span className="debt-lender">{debt.lender}</span>
        </div>
        <div className="debt-balance-col">
          <span className={`debt-balance${isActive ? ' is-active-bal' : ''}`}>
            ${debt.balance.toFixed(2)}
          </span>
          {debt.apr != null && (
            <span className="debt-apr-badge">{debt.apr}% APR</span>
          )}
          {dailyInterest !== null && (
            <span className="debt-daily-badge">${dailyInterest.toFixed(2)}/day</span>
          )}
        </div>
      </div>

      <div className="debt-bar-outer">
        <div className="debt-bar-fill" style={{ width: `${pctCleared}%` }} />
      </div>

      <div className="debt-stats-row">
        {pctUtil !== null && (
          <div className="debt-stat">
            <span className="debt-stat-val">{pctUtil.toFixed(0)}%</span>
            <span className="debt-stat-lbl">util</span>
          </div>
        )}
        <div className="debt-stat">
          <span className="debt-stat-val">{pctCleared.toFixed(0)}%</span>
          <span className="debt-stat-lbl">cleared</span>
        </div>
        {debt.minPayment && !editMin && (
          <span className="debt-min-chip">${debt.minPayment}/mo min</span>
        )}
      </div>

      <div className="debt-actions">
        {isActive ? (
          <button className="btn-pay" onClick={onPay}>PAY</button>
        ) : (
          <button className="btn-pay-secondary" onClick={onPay}>PAY</button>
        )}

        <button className="btn-icon" onClick={onEdit} title="Edit balance">✎</button>

        {editMin ? (
          <div className="inline-edit-wrap">
            <input
              className="inline-input"
              type="number" min="0" placeholder="Min $"
              value={minVal}
              onChange={e => setMinVal(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveMin()}
            />
            <button className="btn-inline-save" onClick={saveMin}>✓</button>
          </div>
        ) : (
          <button className="btn-chip" onClick={() => { setMinVal(debt.minPayment || ''); setEditMin(true) }}>
            {debt.minPayment ? `Min $${debt.minPayment}` : '+ Min'}
          </button>
        )}

        <button className="btn-chip" onClick={() => onSetApr?.(debt)}>
          {debt.apr != null ? `${debt.apr}% APR` : '+ APR'}
        </button>

        {editAutopay ? (
          <div className="inline-edit-wrap">
            <input
              className="inline-input"
              type="number" min="0" placeholder="Auto $"
              value={autopayVal}
              onChange={e => setAutopayVal(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveAutopay()}
            />
            <button className="btn-inline-save" onClick={saveAutopay}>✓</button>
            <button className="btn-inline-save" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={() => setEditAutopay(false)}>✕</button>
          </div>
        ) : debt.autopayEnabled ? (
          <span
            className="debt-autopay-badge"
            onClick={() => { setAutopayVal(debt.autopayAmount || ''); setEditAutopay(true) }}
          >
            Auto ${debt.autopayAmount || 0}/mo ✎
          </span>
        ) : (
          <button className="btn-chip" onClick={toggleAutopay}>+ Autopay</button>
        )}
      </div>
    </div>
  )
}
