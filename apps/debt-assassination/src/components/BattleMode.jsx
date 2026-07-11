import { useState, useCallback, useRef } from 'react'
import PlayerHUD from './PlayerHUD'
import EnemyCard from './EnemyCard'
import PaymentModal from './PaymentModal'
import VictoryScreen from './VictoryScreen'
import Confetti from './Confetti'
import BattleArenaFloor from './BattleArenaFloor'
import LootDrop from './LootDrop'
import { VILLAIN_DATA } from '../constants'

function getAttackTier(amount) {
  if (amount >= 500) return 'execution'
  if (amount >= 150) return 'explosive'
  if (amount >= 50)  return 'shotgun'
  return 'pistol'
}

export default function BattleMode({ store, addToast, lastSyncLabel, syncOverdue, syncFlash }) {
  const [attackingDebt, setAttackingDebt] = useState(null)
  const [flashClass, setFlashClass] = useState('')
  const [cardAnimMap, setCardAnimMap] = useState({})
  const [showConfetti, setShowConfetti] = useState(false)
  const [showVictory, setShowVictory] = useState(false)
  const [killFeed, setKillFeed] = useState([])
  const [lootDrops, setLootDrops] = useState([])
  const [scoreGain, setScoreGain] = useState(0)
  const arenaRef = useRef(null)

  const allDead = store.debts.every(d => d.balance <= 0)

  const triggerFlash = useCallback((cls) => {
    setFlashClass(cls)
    setTimeout(() => setFlashClass(''), 1200)
  }, [])

  const triggerCardAnim = useCallback((debtId, amount) => {
    const tier = getAttackTier(amount)
    const cls = `attack-${tier}`
    setCardAnimMap(prev => ({ ...prev, [debtId]: cls }))
    setTimeout(() => setCardAnimMap(prev => {
      const next = { ...prev }
      delete next[debtId]
      return next
    }), 1200)
    triggerFlash(`sf-${tier}`)
    arenaRef.current?.pulse(tier === 'execution' ? 'gold' : tier === 'explosive' ? 'red' : 'cyan')
  }, [triggerFlash])

  const addKillFeed = useCallback((debt, amount, eliminated) => {
    const villainName = debt.enemyName || VILLAIN_DATA[debt.id]?.name || debt.lender || 'UNKNOWN TARGET'
    const id = Date.now() + Math.random()
    const msg = `YOU DEALT $${amount.toFixed(2)} TO ${villainName}${eliminated ? ' · ELIMINATED' : ''}`
    setKillFeed(prev => [{ id, msg, eliminated }, ...prev].slice(0, 5))
    setTimeout(() => setKillFeed(prev => prev.filter(item => item.id !== id)), 4000)
  }, [])

  const handleAttack = useCallback((debt) => {
    setAttackingDebt(debt)
  }, [])

  const handleRename = useCallback((debtId, name) => {
    store.updateEnemyName(debtId, name)
    addToast('TARGET NAME UPDATED', 'gold')
  }, [store, addToast])

  const handlePayment = useCallback((debtId, amount) => {
    const debt = store.debts.find(d => d.id === debtId)
    if (!debt) return

    triggerCardAnim(debtId, amount)
    const result = store.makePayment(debtId, amount)
    setAttackingDebt(null)
    addKillFeed(debt, Math.min(amount, debt.balance), Boolean(result?.cardKilled))
    addToast(`HIT: -$${amount.toFixed(2)}`, 'red')
    if (result?.gridGain > 0) {
      setScoreGain(result.gridGain)
      addToast(`+${result.gridGain} GRID INTEGRITY`, 'gold')
      setTimeout(() => setScoreGain(0), 2200)
    }

    if (result?.cardKilled) {
      setShowConfetti(true)
      addToast('ENEMY ELIMINATED', 'gold')
      setLootDrops(prev => [{
        id: Date.now() + Math.random(),
        label: `${debt.enemyName || VILLAIN_DATA[debt.id]?.name || debt.lender} LOOT DROP`,
        amount: debt.minPayment || 0,
      }, ...prev].slice(0, 5))
      setTimeout(() => setShowConfetti(false), 3500)
      if (store.debts.filter(d => d.balance > 0).length === 1) {
        setTimeout(() => setShowVictory(true), 1500)
      }
    }
  }, [store, addToast, triggerCardAnim, addKillFeed])

  const activeTarget = store.activeTarget

  const sortedDebts = [...store.debts].sort((a, b) => {
    if (a.balance <= 0 && b.balance > 0) return 1
    if (b.balance <= 0 && a.balance > 0) return -1
    if (a.id === 12) return 1
    if (b.id === 12) return -1
    return a.phase - b.phase || a.id - b.id
  })

  const featuredDebt = activeTarget
  const remainingDebts = sortedDebts.filter(d => !featuredDebt || d.id !== featuredDebt.id)
  const activeThreats = store.debts.filter(d => d.balance > 0)
  const overLimitCount = activeThreats.filter(d => d.balance > d.limit).length
  const nextMinimum = activeThreats[0]?.minPayment || 0
  const phaseWaves = [1, 2, 3].map(phase => {
    const debts = remainingDebts.filter(d => d.phase === phase)
    const total = store.debts.filter(d => d.phase === phase).length
    const cleared = store.debts.filter(d => d.phase === phase && d.balance <= 0).length
    const bossWave = phase === 3
    return { phase, debts, total, cleared, bossWave }
  }).filter(wave => wave.debts.length > 0)

  const daysSinceInstall = Math.floor((Date.now() - (store.installDate || Date.now())) / (1000 * 60 * 60 * 24))
  const daysToNextCycle = 30 - (daysSinceInstall % 30)
  const showCaWarning = daysToNextCycle <= 3 && store.debts.some(d => d.balance > d.limit)

  if (allDead && showVictory) {
    return <VictoryScreen totalPaid={store.totalPaid} onClose={() => setShowVictory(false)} />
  }

  return (
    <div className="battle-main battle-view">
      <BattleArenaFloor ref={arenaRef} />
      {showConfetti && <Confetti />}
      <div className={`screen-flash ${flashClass}`} />
      <LootDrop drops={lootDrops} onRemove={(id) => setLootDrops(prev => prev.filter(d => d.id !== id))} />

      <div className="kill-feed" aria-live="polite">
        {killFeed.map(item => (
          <div key={item.id} className={`kill-feed-item ${item.eliminated ? 'kf-kill' : ''}`}>{item.msg}</div>
        ))}
      </div>

      {store.playerHealth < 20 && (
        <div className="critical-overlay critical-ring">
          <div className="critical-text">⚠ CRITICAL CONDITION ⚠<br/>KEEP FIGHTING</div>
        </div>
      )}

      {attackingDebt && (
        <PaymentModal
          debt={attackingDebt}
          onPay={handlePayment}
          onClose={() => setAttackingDebt(null)}
        />
      )}

      <PlayerHUD
        health={store.playerHealth}
        cardsKilled={store.cardsKilled}
        totalPaid={store.totalPaid}
        gridIntegrity={store.gridIntegrity}
        clearanceTier={store.clearanceTier}
        projectedScore={store.projectedScore}
        scoreGain={scoreGain}
        totalDailyDamage={store.totalDailyDamage}
        lastSyncLabel={lastSyncLabel}
        syncOverdue={syncOverdue}
        syncFlash={syncFlash}
      />

      <section className="battle-command-strip" aria-label="Battle command metrics">
        <div className="bc-cell">
          <span className="bc-label">ACTIVE HOSTILES</span>
          <strong>{activeThreats.length}</strong>
        </div>
        <div className="bc-cell">
          <span className="bc-label">BREACHES</span>
          <strong className={overLimitCount > 0 ? 'bc-alert' : ''}>{overLimitCount}</strong>
        </div>
        <div className="bc-cell">
          <span className="bc-label">NEXT SNOWBALL</span>
          <strong>${nextMinimum.toFixed(2)}/mo</strong>
        </div>
      </section>

      {showCaWarning && (
        <div className="ca-banner ca-banner-tron">
          <span className="ca-icon">⚡</span>
          <div className="ca-banner-text ca-text">
            COUNTERATTACK WARNING — Billing cycle in {daysToNextCycle} day{daysToNextCycle !== 1 ? 's' : ''}.
            Over-limit enemies will strike.
          </div>
        </div>
      )}

      {featuredDebt && (
        <div className="enemy-featured battle-enemy-featured">
          <EnemyCard
            key={featuredDebt.id}
            debt={featuredDebt}
            isTarget={true}
            featured={true}
            onAttack={handleAttack}
            onRename={handleRename}
            extraClass={cardAnimMap[featuredDebt.id] || ''}
          />
        </div>
      )}

      <div className="battle-wave-stack">
        {phaseWaves.map(wave => (
          <section key={wave.phase} className={`battle-wave wave-${wave.phase}`}>
            <div className="battle-wave-header">
              <div>
                <span className="wave-kicker">{wave.bossWave ? 'FINAL WAVE' : `WAVE 0${wave.phase}`}</span>
                <h2>{wave.phase === 1 ? 'Street-Level Targets' : wave.phase === 2 ? 'Pressure Accounts' : 'Heavy Systems'}</h2>
              </div>
              <span className="wave-progress">{wave.cleared}/{wave.total} CLEARED</span>
            </div>
            <div className="enemy-grid battle-enemy-grid">
              {wave.debts.map(debt => (
                <EnemyCard
                  key={debt.id}
                  debt={debt}
                  isTarget={false}
                  featured={false}
                  onAttack={handleAttack}
                  onRename={handleRename}
                  extraClass={cardAnimMap[debt.id] || ''}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
