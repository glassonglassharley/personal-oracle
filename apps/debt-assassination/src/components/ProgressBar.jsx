export default function ProgressBar({ percent, totalPaid, totalOriginalDebt }) {
  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="progress-section">
      <div className="progress-meta">
        <div className="progress-meta-start">
          <span className="progress-meta-label">START</span>
          <span className="progress-meta-val">${totalOriginalDebt.toLocaleString()}</span>
        </div>
        <div className="progress-meta-paid">${fmt(totalPaid)} PAID</div>
        <div className="progress-meta-target" style={{ textAlign: 'right' }}>
          <span className="progress-meta-label">TARGET</span>
          <span className="progress-meta-val">$0</span>
        </div>
      </div>
      <div className="progress-bar-outer">
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
        <div className="progress-bar-pct">{percent.toFixed(1)}%</div>
      </div>
    </div>
  )
}
