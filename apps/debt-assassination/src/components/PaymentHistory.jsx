export default function PaymentHistory({ history, open, onToggle }) {
  return (
    <div className="history-section">
      <button className="history-toggle" onClick={onToggle}>
        <span>// PAYMENT LOG — {history.length} TRANSACTIONS</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="history-body">
          {history.length === 0 ? (
            <div className="history-empty">NO TRANSACTIONS LOGGED</div>
          ) : (
            history.map(e => (
              <div key={e.id} className="history-entry">
                <span className="h-date">{e.date}</span>
                <span className="h-lender">{e.lender}</span>
                <span className="h-amount">-${e.amount.toFixed(2)}</span>
                <span className="h-after">${e.balanceAfter.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
