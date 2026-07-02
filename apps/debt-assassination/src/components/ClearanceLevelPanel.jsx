export default function ClearanceLevelPanel({
  gridIntegrity,
  projectedScore,
  clearanceTier,
  nextClearanceTier,
  progressToNext,
  lastSynced,
  highUtilizationCount,
  onSync,
}) {
  return (
    <section className="clearance-panel" aria-label="Credit score grid integrity">
      <div className="clearance-main">
        <span className="clearance-eyebrow">CLEARANCE LEVEL</span>
        <div className="clearance-score">{gridIntegrity}</div>
        <div className="clearance-tier">{clearanceTier}</div>
      </div>

      <div className="clearance-detail">
        <div className="clearance-row">
          <span>PROJECTED</span>
          <strong>{projectedScore}</strong>
        </div>
        <div className="clearance-row">
          <span>NEXT TIER</span>
          <strong>{nextClearanceTier}</strong>
        </div>
        <div className="clearance-progress">
          <div className="clearance-progress-meta">
            <span>{Math.round(progressToNext)}% TO NEXT</span>
            <span>{highUtilizationCount} HIGH UTIL</span>
          </div>
          <div className="clearance-progress-outer">
            <div className="clearance-progress-fill" style={{ width: `${progressToNext}%` }} />
          </div>
        </div>
        <div className="clearance-sync-row">
          <span>LAST SYNC {lastSynced}</span>
          <button type="button" className="btn-sync-score" onClick={onSync}>SYNC SCORE</button>
        </div>
      </div>
    </section>
  )
}
