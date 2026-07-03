import { useState } from 'react'

function cleanNumber(value, fallback = 0) {
  const num = parseFloat(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

export default function AddDebtModal({ onAdd, onClose }) {
  const [lender, setLender] = useState('')
  const [enemyName, setEnemyName] = useState('')
  const [balance, setBalance] = useState('')
  const [limit, setLimit] = useState('')
  const [villainClass, setVillainClass] = useState('Rogue Program')
  const [minPayment, setMinPayment] = useState('')
  const [apr, setApr] = useState('')

  const balanceNumber = cleanNumber(balance)
  const limitNumber = cleanNumber(limit, balanceNumber)
  const canAdd = lender.trim() && enemyName.trim() && balanceNumber > 0

  const handleAdd = () => {
    if (!canAdd) return
    onAdd({
      lender,
      enemyName,
      villainClass,
      balance: balanceNumber,
      limit: limitNumber > 0 ? limitNumber : balanceNumber,
      minPayment: minPayment.trim() ? cleanNumber(minPayment, null) : null,
      apr: apr.trim() ? cleanNumber(apr, null) : null,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card add-debt-modal">
        <div className="modal-eyebrow">// NEW TARGET DOSSIER</div>
        <div className="modal-lender">ADD DEBT / VILLAIN</div>
        <div className="add-debt-note">
          New targets are inserted into the payoff order automatically by total amount owed.
        </div>

        <div className="add-debt-grid">
          <div className="modal-field">
            <label className="modal-field-label">LENDER / ACCOUNT</label>
            <input
              className="modal-input"
              value={lender}
              onChange={e => setLender(e.target.value)}
              placeholder="Example: New Bank"
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label className="modal-field-label">VILLAIN NAME</label>
            <input
              className="modal-input"
              value={enemyName}
              maxLength={32}
              onChange={e => setEnemyName(e.target.value.toUpperCase())}
              placeholder="Example: THE NEW THREAT"
            />
          </div>

          <div className="modal-field">
            <label className="modal-field-label">TOTAL OWED</label>
            <input
              className="modal-input"
              type="number"
              min="0"
              step="0.01"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="0.00"
            />
          </div>

          <div className="modal-field">
            <label className="modal-field-label">CREDIT LIMIT</label>
            <input
              className="modal-input"
              type="number"
              min="0"
              step="0.01"
              value={limit}
              onChange={e => setLimit(e.target.value)}
              placeholder="Defaults to amount owed"
            />
          </div>

          <div className="modal-field">
            <label className="modal-field-label">CLASS</label>
            <input
              className="modal-input"
              value={villainClass}
              maxLength={28}
              onChange={e => setVillainClass(e.target.value)}
              placeholder="Rogue Program"
            />
          </div>

          <div className="modal-field split-fields">
            <div>
              <label className="modal-field-label">MIN $</label>
              <input
                className="modal-input"
                type="number"
                min="0"
                step="0.01"
                value={minPayment}
                onChange={e => setMinPayment(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="modal-field-label">APR %</label>
              <input
                className="modal-input"
                type="number"
                min="0"
                step="0.01"
                value={apr}
                onChange={e => setApr(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        <div className="modal-confirm add-rank-preview">
          {balanceNumber > 0 ? (
            <>TARGET WILL BE RANKED BY <span className="hl">${balanceNumber.toFixed(2)}</span> OWED</>
          ) : (
            <>&nbsp;</>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-abort" onClick={onClose}>ABORT</button>
          <button className="btn-modal-execute" onClick={handleAdd} disabled={!canAdd}>ADD TARGET</button>
        </div>
      </div>
    </div>
  )
}
