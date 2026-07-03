export default function PlayerHUD({ health, cardsKilled, totalPaid, gridIntegrity, clearanceTier, projectedScore, scoreGain, totalDailyDamage, lastSyncLabel, syncOverdue, syncFlash }) {
  const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const healthPct = Math.max(0, Math.min(100, health))
  const shieldPct = Math.min(100, 35 + cardsKilled * 5)

  return (
    <div className="player-hud hud-panel">
      <div className="hud-corner tl" />
      <div className="hud-corner br" />
      <div className="hud-content">

        {/* Row 1: name/status + stats */}
        <div className="hud-top">
          <div className="hud-identity">
            <div className="hud-player-name">▶ THE ASSASSIN</div>
            <div className="hud-online">OPERATIVE ONLINE</div>
          </div>
          <div className="hud-stats-row">
            <div className="hud-stat-block">
              <span className="hud-stat-val">{cardsKilled}</span>
              <span className="hud-stat-lbl">KILLS</span>
            </div>
            <div className="hud-stat-block">
              <span className="hud-stat-val">${fmt(totalPaid)}</span>
              <span className="hud-stat-lbl">DAMAGE</span>
            </div>
            <div className="hud-stat-block">
              <span className="hud-stat-val hud-grid-val">{gridIntegrity}</span>
              <span className="hud-stat-lbl">GRID</span>
            </div>
          </div>
        </div>

        {/* Row 2: clearance + daily damage + score gain */}
        <div className="hud-meta-row">
          <div className="hud-meta-pill">
            <span className="hud-meta-lbl">CLEARANCE</span>
            <strong className="hud-meta-val">{clearanceTier}</strong>
          </div>
          <div className="hud-meta-pill">
            <span className="hud-meta-lbl">PROJECTED</span>
            <strong className="hud-meta-val">{projectedScore}</strong>
          </div>
          {totalDailyDamage > 0 && (
            <div className="hud-daily-dmg">⚡ ${totalDailyDamage.toFixed(2)}/DAY</div>
          )}
          {scoreGain > 0 && (
            <div className="hud-score-gain" key={scoreGain}>+{scoreGain} GRID</div>
          )}
          {syncFlash && (
            <div className="hud-intel-flash">⬡ INTEL UPDATED</div>
          )}
          {lastSyncLabel && !syncFlash && (
            <div className={`hud-sync-ts ${syncOverdue ? 'hud-sync-overdue' : ''}`}>
              {syncOverdue ? '⚠ SYNC OVERDUE' : `SYNC ${lastSyncLabel}`}
            </div>
          )}
        </div>

        {/* Row 3: HP + Shield bars */}
        <div className="hud-bars">
          <div className="hud-bar-row">
            <span className="hud-bar-lbl hud-sh-lbl">SH</span>
            <div className="hud-bar-outer hud-sh-outer">
              <div className="hud-bar-fill hud-sh-fill" style={{ width: `${shieldPct}%` }} />
            </div>
            <span className="hud-bar-val hud-sh-val">{shieldPct}%</span>
          </div>
          <div className="hud-bar-row">
            <span className="hud-bar-lbl">HP</span>
            <div className="hud-bar-outer">
              <div className={`hud-bar-fill hud-hp-fill ${healthPct < 20 ? 'hud-critical' : ''}`} style={{ width: `${healthPct}%` }} />
            </div>
            <span className="hud-bar-val">{healthPct}/100</span>
          </div>
        </div>

      </div>
    </div>
  )
}
