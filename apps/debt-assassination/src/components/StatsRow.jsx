export default function StatsRow({ totalRemaining, totalPaid, cardsKilled, totalCards, freedUp, totalDailyInterest }) {
  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const hasBleeding = totalDailyInterest > 0

  return (
    <div className="stats-row stats-row-four">
      <div className="stat-card">
        <span className="stat-label">DEBT REMAINING</span>
        <div className="stat-value">${fmt(totalRemaining)}</div>
      </div>
      <div className="stat-card">
        <span className="stat-label">TOTAL PAID</span>
        <div className="stat-value gold">${fmt(totalPaid)}</div>
      </div>
      <div className="stat-card">
        <span className="stat-label">CARDS KILLED</span>
        <div className="stat-value gold">{cardsKilled}/{totalCards}</div>
      </div>
      <div className="stat-card bleeding-card">
        <span className="stat-label">BLEEDING/DAY</span>
        <div className={`stat-value ${hasBleeding ? 'bleeding-val' : 'bleeding-empty'}`}>
          {hasBleeding ? `$${fmt(totalDailyInterest)}` : '--'}
        </div>
      </div>
    </div>
  )
}
