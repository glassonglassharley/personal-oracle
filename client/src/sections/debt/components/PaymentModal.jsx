import { useState } from 'react'

export default function PaymentModal({ debt, onPay, onClose }) {
  const [selected, setSelected] = useState(null)
  const [custom, setCustom] = useState('')

  const resolvedAmount = (() => {
    if (selected === 'full') return debt.balance
    if (selected !== null && selected !== 'custom') return selected
    if (selected === 'custom') return parseFloat(custom) || 0
    return 0
  })()

  const remaining = Math.max(0, debt.balance - resolvedAmount)

  const handleExecute = () => {
    if (resolvedAmount <= 0) return
    onPay(debt.id, resolvedAmount)
  }

  const selectQuick = (amt) => {
    setSelected(amt)
    setCustom('')
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-eyebrow">// PAYMENT PROTOCOL</div>
        <div className="modal-lender">{debt.lender}</div>
        <div className="modal-balance">${debt.balance.toFixed(2)}</div>

        <div className="quick-grid">
          {[25, 50, 100].map(a => (
            <button
              key={a}
              className={`quick-btn ${selected === a ? 'selected' : ''}`}
              onClick={() => selectQuick(a)}
            >
              ${a}
            </button>
          ))}
          <button
            className={`quick-btn ${selected === 'full' ? 'selected' : ''}`}
            onClick={() => selectQuick('full')}
          >
            FULL
          </button>
        </div>

        <div className="modal-field">
          <label className="modal-field-label">CUSTOM AMOUNT</label>
          <input
            className="modal-input"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={custom}
            onChange={e => { setCustom(e.target.value); setSelected('custom') }}
          />
        </div>

        <div className="modal-confirm">
          {resolvedAmount > 0 ? (
            <>Paying <span className="hl">${resolvedAmount.toFixed(2)}</span> · <span className="hl">${remaining.toFixed(2)}</span> will remain</>
          ) : (
            <>&nbsp;</>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-abort" onClick={onClose}>ABORT</button>
          <button
            className="btn-modal-execute"
            onClick={handleExecute}
            disabled={resolvedAmount <= 0}
          >
            EXECUTE
          </button>
        </div>
      </div>
    </div>
  )
}
