import { useState } from 'react'

export default function EditBalanceModal({ debt, onSave, onClose }) {
  const [value, setValue] = useState(debt.balance.toFixed(2))
  const numericValue = parseFloat(value)
  const isValid = Number.isFinite(numericValue) && numericValue >= 0
  const delta = isValid ? numericValue - debt.balance : 0

  const handleSave = () => {
    if (!isValid) return
    onSave(debt.id, numericValue)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-eyebrow">// EDIT DEBT AMOUNT</div>
        <div className="modal-lender">{debt.lender}</div>
        <div className="modal-balance" style={{ marginBottom: '20px' }}>${debt.balance.toFixed(2)}</div>

        <div className="modal-field">
          <label className="modal-field-label">NEW CURRENT BALANCE</label>
          <input
            className="modal-input"
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className={`modal-confirm balance-delta-preview ${delta > 0 ? 'is-increase' : delta < 0 ? 'is-decrease' : ''}`}>
          {!isValid ? (
            <>ENTER A VALID BALANCE</>
          ) : Math.abs(delta) < 0.01 ? (
            <>NO BALANCE CHANGE</>
          ) : delta > 0 ? (
            <>BALANCE WILL INCREASE BY <span className="hl">${delta.toFixed(2)}</span></>
          ) : (
            <>BALANCE WILL DECREASE BY <span className="hl">${Math.abs(delta).toFixed(2)}</span></>
          )}
        </div>
        <p className="modal-help-text">
          Use this for interest, fees, corrected statements, or any balance increase. If the new amount is higher than the original tracked amount, the payoff baseline updates too.
        </p>

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button className="btn-abort" onClick={onClose}>ABORT</button>
          <button className="btn-modal-execute" onClick={handleSave} disabled={!isValid}>SAVE BALANCE</button>
        </div>
      </div>
    </div>
  )
}
