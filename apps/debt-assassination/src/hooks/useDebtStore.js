import { useState, useMemo } from 'react'
import { ORIGINAL_DEBTS, VILLAIN_DATA } from '../constants'

const STORAGE_KEY = 'debt-assassination-v1'
const DEFAULT_CREDIT_SCORE = 742
const BASE_DEBT_COUNT = ORIGINAL_DEBTS.length
const DEFAULT_LAST_SYNCED = '2026-06-08'

const CLEARANCE_TIERS = [
  { name: 'INITIATE', min: 300 },
  { name: 'RUNNER', min: 640 },
  { name: 'OPERATOR', min: 700 },
  { name: 'SPECTER', min: 760 },
  { name: 'ARCHITECT', min: 800 },
]

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

function getDefaultVillainInfo(debt) {
  return VILLAIN_DATA[debt.id] ?? {
    name: debt.enemyName || debt.lender || 'UNKNOWN TARGET',
    villainClass: debt.villainClass || 'Rogue Program',
    flavor: debt.flavor || 'Unregistered hostile debt program. Rank assigned by amount owed.',
  }
}

function rankDebts(debts) {
  return [...debts].sort((a, b) => {
    if (a.balance <= 0 && b.balance > 0) return 1
    if (b.balance <= 0 && a.balance > 0) return -1
    return a.balance - b.balance || a.id - b.id
  })
}

function getPhaseForAmount(amount) {
  if (amount <= 250) return 1
  if (amount <= 750) return 2
  return 3
}

function withEnemyNames(debts) {
  return debts.map(d => {
    const info = getDefaultVillainInfo(d)
    return {
      ...d,
      limit: Number.isFinite(Number(d.limit)) && Number(d.limit) > 0 ? Number(d.limit) : Math.max(Number(d.balance) || 0, Number(d.originalBalance) || 0, 1),
      originalBalance: Number.isFinite(Number(d.originalBalance)) && Number(d.originalBalance) > 0 ? Number(d.originalBalance) : Number(d.balance) || 0,
      phase: d.phase || getPhaseForAmount(Number(d.balance) || Number(d.originalBalance) || 0),
      villainClass: d.villainClass || info.villainClass,
      flavor: d.flavor || info.flavor,
      enemyName: typeof d.enemyName === 'string' && d.enemyName.trim()
        ? d.enemyName
        : info.name,
    }
  })
}

function buildInitialDebts() {
  return ORIGINAL_DEBTS.map(d => ({
    ...d,
    balance: d.originalBalance,
    minPayment: null,
    apr: null,
    enemyName: VILLAIN_DATA[d.id]?.name ?? d.lender,
    autopayEnabled: false,
    autopayAmount: null,
    autopayDueDay: null,
  }))
}

function clampScore(score) {
  return Math.max(300, Math.min(850, Math.round(score)))
}

function getScoreMetrics(debts, creditScore) {
  const totalOriginalDebt = debts.reduce((s, d) => s + Math.max(0, d.originalBalance || d.balance || 0), 0)
  const totalRemaining = debts.reduce((s, d) => s + Math.max(0, d.balance), 0)
  const totalPaid = Math.max(0, totalOriginalDebt - totalRemaining)
  const cardsKilled = debts.filter(d => d.balance <= 0).length
  const highUtilizationCount = debts.filter(d => d.limit > 0 && d.balance > 0 && (d.balance / d.limit) > 0.7).length
  const highUtilizationPenalty = highUtilizationCount * 8
  const gridIntegrity = clampScore(creditScore + (totalPaid * 0.015) + (cardsKilled * 20) - highUtilizationPenalty)
  const projectedScore = clampScore(gridIntegrity + (totalRemaining * 0.008))
  const tierIndex = CLEARANCE_TIERS.reduce((best, tier, index) => gridIntegrity >= tier.min ? index : best, 0)
  const tier = CLEARANCE_TIERS[tierIndex]
  const nextTier = CLEARANCE_TIERS[tierIndex + 1] ?? null
  const tierFloor = tier.min
  const tierCeiling = nextTier?.min ?? 850
  const progressToNext = nextTier
    ? Math.max(0, Math.min(100, ((gridIntegrity - tierFloor) / (tierCeiling - tierFloor)) * 100))
    : 100

  return {
    creditScore,
    gridIntegrity,
    projectedScore,
    highUtilizationCount,
    highUtilizationPenalty,
    clearanceTier: tier.name,
    nextClearanceTier: nextTier?.name ?? 'MAX LEVEL',
    progressToNext,
  }
}

function getInitialState() {
  const saved = loadState()
  if (Array.isArray(saved?.debts) && saved.debts.length >= BASE_DEBT_COUNT) {
    return {
      ...saved,
      debts: withEnemyNames(saved.debts.map(d => ({
        autopayEnabled: false,
        autopayAmount: null,
        autopayDueDay: null,
        ...d,
      }))),
      creditScore: Number.isFinite(saved.creditScore) ? saved.creditScore : DEFAULT_CREDIT_SCORE,
      lastSynced: saved.lastSynced || DEFAULT_LAST_SYNCED,
      scoreHistory: Array.isArray(saved.scoreHistory) ? saved.scoreHistory : [],
      robinhoodStatus: saved.robinhoodStatus || 'pending',
      harleyDefiSplit: saved.harleyDefiSplit || { debt: 50, tax: 30, reinvest: 20 },
      autopayThreshold: saved.autopayThreshold ?? null,
    }
  }
  return {
    debts: buildInitialDebts(),
    paymentHistory: [],
    scoreHistory: [],
    milestonesShown: [],
    playerHealth: 100,
    viewMode: 'dashboard',
    installDate: Date.now(),
    creditScore: DEFAULT_CREDIT_SCORE,
    gridIntegrity: DEFAULT_CREDIT_SCORE,
    projectedScore: 765,
    lastSynced: DEFAULT_LAST_SYNCED,
    robinhoodStatus: 'pending',
    harleyDefiSplit: { debt: 50, tax: 30, reinvest: 20 },
    autopayThreshold: null,
  }
}

export function useDebtStore() {
  const [state, setState] = useState(getInitialState)

  function persist(next) {
    setState(next)
    saveState(next)
  }

  const derived = useMemo(() => {
    const rankedDebts = rankDebts(state.debts)
    const totalOriginalDebt = state.debts.reduce((s, d) => s + Math.max(0, d.originalBalance || d.balance || 0), 0)
    const totalRemaining = state.debts.reduce((s, d) => s + Math.max(0, d.balance), 0)
    const totalPaid = Math.max(0, totalOriginalDebt - totalRemaining)
    const cardsKilled = state.debts.filter(d => d.balance <= 0).length
    const percentComplete = totalOriginalDebt > 0 ? Math.min(100, (totalPaid / totalOriginalDebt) * 100) : 0
    const activeTarget = rankedDebts.find(d => d.balance > 0) ?? null
    const freedUpMinimums = state.debts
      .filter(d => d.balance <= 0 && d.minPayment)
      .reduce((s, d) => s + (d.minPayment || 0), 0)
    const totalDailyInterest = state.debts.reduce((sum, d) => {
      if (!d.apr || d.balance <= 0) return sum
      return sum + ((d.apr / 100) / 365) * d.balance
    }, 0)
    const totalAutopayCommitted = state.debts
      .filter(d => d.autopayEnabled && d.autopayAmount && d.balance > 0)
      .reduce((s, d) => s + (d.autopayAmount || 0), 0)
    const scoreMetrics = getScoreMetrics(state.debts, state.creditScore)
    return { totalOriginalDebt, totalRemaining, totalPaid, cardsKilled, percentComplete, activeTarget, rankedDebts, freedUpMinimums, totalDailyInterest, totalDailyDamage: totalDailyInterest, totalAutopayCommitted, ...scoreMetrics }
  }, [state.debts, state.creditScore])

  function makePayment(debtId, amount) {
    const debt = state.debts.find(d => d.id === debtId)
    if (!debt || debt.balance <= 0) return null

    const actual = Math.min(amount, debt.balance)
    const newBalance = Math.max(0, debt.balance - actual)
    const cardKilled = newBalance === 0

    const historyEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-US'),
      lender: debt.lender,
      amount: actual,
      balanceAfter: newBalance,
    }

    const newDebts = state.debts.map(d =>
      d.id === debtId ? { ...d, balance: newBalance } : d
    )
    const newHistory = [historyEntry, ...state.paymentHistory].slice(0, 10)
    const beforeScore = getScoreMetrics(state.debts, state.creditScore).gridIntegrity
    const afterMetrics = getScoreMetrics(newDebts, state.creditScore)
    const gridGain = Math.max(0, afterMetrics.gridIntegrity - beforeScore)
    const scoreEntry = {
      id: Date.now() + 1,
      date: new Date().toLocaleDateString('en-US'),
      label: cardKilled ? `${debt.lender} neutralized` : `${debt.lender} payment`,
      gridIntegrity: afterMetrics.gridIntegrity,
      delta: gridGain,
    }
    const newScoreHistory = gridGain > 0
      ? [scoreEntry, ...(state.scoreHistory || [])].slice(0, 12)
      : state.scoreHistory || []
    let newHealth = state.playerHealth
    if (cardKilled) newHealth = Math.min(100, newHealth + 15)

    persist({
      ...state,
      debts: newDebts,
      paymentHistory: newHistory,
      scoreHistory: newScoreHistory,
      playerHealth: newHealth,
      gridIntegrity: afterMetrics.gridIntegrity,
      projectedScore: afterMetrics.projectedScore,
    })
    return { cardKilled, lender: debt.lender, gridGain, gridIntegrity: afterMetrics.gridIntegrity }
  }

  function editBalance(debtId, newBalance) {
    const debt = state.debts.find(d => d.id === debtId)
    if (!debt) return null
    const clamped = Math.max(0, parseFloat(newBalance) || 0)
    const previousBalance = Number(debt.balance) || 0
    const delta = clamped - previousBalance
    const newDebts = state.debts.map(d =>
      d.id === debtId ? { ...d, balance: clamped, originalBalance: Math.max(Number(d.originalBalance) || 0, clamped) } : d
    )
    const adjustmentEntry = Math.abs(delta) >= 0.01 ? {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-US'),
      lender: `BALANCE ${delta > 0 ? 'INCREASE' : 'CORRECTION'} — ${debt.lender}`,
      amount: Math.abs(delta),
      balanceAfter: clamped,
    } : null
    persist({
      ...state,
      debts: newDebts,
      paymentHistory: adjustmentEntry
        ? [adjustmentEntry, ...(state.paymentHistory || [])].slice(0, 10)
        : state.paymentHistory,
    })
    return { previousBalance, newBalance: clamped, delta }
  }

  function updateMinPayment(debtId, amount) {
    const num = parseFloat(amount)
    const newDebts = state.debts.map(d =>
      d.id === debtId ? { ...d, minPayment: isNaN(num) || num <= 0 ? null : num } : d
    )
    persist({ ...state, debts: newDebts })
  }

  function updateAPR(debtId, apr) {
    const num = parseFloat(apr)
    const newDebts = state.debts.map(d =>
      d.id === debtId ? { ...d, apr: isNaN(num) || num <= 0 ? null : num } : d
    )
    persist({ ...state, debts: newDebts })
  }

  function updateEnemyName(debtId, name) {
    const currentDebt = state.debts.find(d => d.id === debtId)
    const fallback = VILLAIN_DATA[debtId]?.name ?? currentDebt?.lender ?? 'UNKNOWN TARGET'
    const cleaned = String(name || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 32)
    const newDebts = state.debts.map(d =>
      d.id === debtId ? { ...d, enemyName: cleaned || fallback } : d
    )
    persist({ ...state, debts: newDebts })
  }

  function addDebt(input) {
    const balance = Math.max(0, parseFloat(input.balance) || 0)
    if (balance <= 0) return null
    const nextId = Math.max(0, ...state.debts.map(d => Number(d.id) || 0)) + 1
    const lender = String(input.lender || 'New Debt').trim().replace(/\s+/g, ' ').slice(0, 48)
    const enemyName = String(input.enemyName || lender).trim().replace(/\s+/g, ' ').slice(0, 32).toUpperCase()
    const villainClass = String(input.villainClass || 'Rogue Program').trim().replace(/\s+/g, ' ').slice(0, 28)
    const limit = Math.max(1, parseFloat(input.limit) || balance)
    const minPayment = input.minPayment === null || input.minPayment === undefined ? null : Math.max(0, parseFloat(input.minPayment) || 0) || null
    const apr = input.apr === null || input.apr === undefined ? null : Math.max(0, parseFloat(input.apr) || 0) || null
    const newDebt = {
      id: nextId,
      lender,
      originalBalance: balance,
      balance,
      limit,
      phase: getPhaseForAmount(balance),
      minPayment,
      apr,
      enemyName,
      villainClass,
      flavor: 'User-added hostile debt program. Rank assigned by amount owed.',
      custom: true,
    }
    persist({ ...state, debts: rankDebts([...state.debts, newDebt]) })
    return newDebt
  }

  function syncCreditScore(score) {
    const syncedScore = clampScore(parseFloat(score) || DEFAULT_CREDIT_SCORE)
    const metrics = getScoreMetrics(state.debts, syncedScore)
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-US'),
      label: 'Credit Karma sync',
      gridIntegrity: metrics.gridIntegrity,
      delta: metrics.gridIntegrity - derived.gridIntegrity,
    }
    persist({
      ...state,
      creditScore: syncedScore,
      gridIntegrity: metrics.gridIntegrity,
      projectedScore: metrics.projectedScore,
      lastSynced: new Date().toISOString().slice(0, 10),
      scoreHistory: [entry, ...(state.scoreHistory || [])].slice(0, 12),
    })
  }

  function markMilestoneShown(milestone) {
    const allBelow = [25, 50, 75, 100].filter(m => m <= milestone)
    const newShown = [...new Set([...state.milestonesShown, ...allBelow])]
    persist({ ...state, milestonesShown: newShown })
  }

  function setViewMode(mode) {
    persist({ ...state, viewMode: mode })
  }

  function logCounterattack(debtId, feeAmount, feeLabel) {
    const debt = state.debts.find(d => d.id === debtId)
    if (!debt) return
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-US'),
      lender: `ENEMY ATTACK — ${debt.lender}`,
      amount: feeAmount,
      balanceAfter: debt.balance + feeAmount,
    }
    const newDebts = state.debts.map(d =>
      d.id === debtId ? { ...d, balance: d.balance + feeAmount } : d
    )
    const newHealth = Math.max(0, state.playerHealth - 5)
    const newHistory = [entry, ...state.paymentHistory].slice(0, 10)
    persist({ ...state, debts: newDebts, paymentHistory: newHistory, playerHealth: newHealth })
  }

  function importState(rawJson) {
    try {
      const parsed = JSON.parse(rawJson)
      if (!Array.isArray(parsed.debts)) return false
      const normalized = {
        ...parsed,
        debts: withEnemyNames(parsed.debts),
        creditScore: Number.isFinite(Number(parsed.creditScore)) ? Number(parsed.creditScore) : DEFAULT_CREDIT_SCORE,
        lastSynced: parsed.lastSynced || DEFAULT_LAST_SYNCED,
        scoreHistory: Array.isArray(parsed.scoreHistory) ? parsed.scoreHistory : [],
        paymentHistory: Array.isArray(parsed.paymentHistory) ? parsed.paymentHistory : [],
        milestonesShown: Array.isArray(parsed.milestonesShown) ? parsed.milestonesShown : [],
        playerHealth: Number.isFinite(Number(parsed.playerHealth)) ? Number(parsed.playerHealth) : 100,
        viewMode: parsed.viewMode || 'dashboard',
        installDate: parsed.installDate ?? Date.now(),
      }
      persist(normalized)
      return true
    } catch {
      return false
    }
  }

  function batchUpdateFromPlaid(updates) {
    // updates: [{ debtId, balance?, apr?, minPayment? }]
    const changed = []
    const newDebts = state.debts.map(d => {
      const u = updates.find(x => x.debtId === d.id)
      if (!u) return d
      const prev = { balance: d.balance, apr: d.apr, minPayment: d.minPayment }
      const next = {
        ...d,
        balance: u.balance !== undefined ? Math.max(0, parseFloat(u.balance) || 0) : d.balance,
        apr: u.apr !== undefined ? (parseFloat(u.apr) || null) : d.apr,
        minPayment: u.minPayment !== undefined ? (parseFloat(u.minPayment) || null) : d.minPayment,
      }
      if (prev.balance !== next.balance || prev.apr !== next.apr || prev.minPayment !== next.minPayment) {
        changed.push({ debt: next, prev })
      }
      return next
    })
    if (changed.length > 0) persist({ ...state, debts: newDebts })
    return changed
  }

  function setAutopay(debtId, enabled, amount) {
    const newDebts = state.debts.map(d =>
      d.id === debtId ? { ...d, autopayEnabled: enabled, autopayAmount: enabled ? (parseFloat(amount) || null) : null } : d
    )
    persist({ ...state, debts: newDebts })
  }

  function setAutopayDueDay(debtId, dueDay) {
    const newDebts = state.debts.map(d =>
      d.id === debtId ? { ...d, autopayDueDay: dueDay } : d
    )
    persist({ ...state, debts: newDebts })
  }

  function setRobinhoodStatus(status) {
    persist({ ...state, robinhoodStatus: status })
  }

  function setHarleyDefiSplit(split) {
    persist({ ...state, harleyDefiSplit: split })
  }

  function setAutopayThreshold(threshold) {
    persist({ ...state, autopayThreshold: threshold })
  }

  function logHarvestPlan(ticker, amount, targetDebt) {
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-US'),
      lender: `ROBINHOOD HARVEST PLANNED — $${amount.toFixed(2)} from ${ticker} → ${targetDebt?.lender || 'UNROUTED'}`,
      amount,
      balanceAfter: targetDebt ? targetDebt.balance : null,
    }
    const newHistory = [entry, ...state.paymentHistory].slice(0, 10)
    persist({ ...state, paymentHistory: newHistory })
  }

  function reset() {
    persist({
      debts: buildInitialDebts(),
      paymentHistory: [],
      milestonesShown: [],
      scoreHistory: [],
      playerHealth: 100,
      viewMode: state.viewMode,
      installDate: state.installDate ?? Date.now(),
      creditScore: DEFAULT_CREDIT_SCORE,
      gridIntegrity: DEFAULT_CREDIT_SCORE,
      projectedScore: 765,
      lastSynced: DEFAULT_LAST_SYNCED,
    })
  }

  return {
    debts: derived.rankedDebts,
    paymentHistory: state.paymentHistory,
    scoreHistory: state.scoreHistory || [],
    milestonesShown: state.milestonesShown,
    playerHealth: state.playerHealth,
    viewMode: state.viewMode,
    installDate: state.installDate,
    lastSynced: state.lastSynced || DEFAULT_LAST_SYNCED,
    robinhoodStatus: state.robinhoodStatus || 'pending',
    harleyDefiSplit: state.harleyDefiSplit || { debt: 50, tax: 30, reinvest: 20 },
    autopayThreshold: state.autopayThreshold ?? null,
    ...derived,
    importState,
    makePayment,
    editBalance,
    updateMinPayment,
    updateAPR,
    updateEnemyName,
    addDebt,
    syncCreditScore,
    markMilestoneShown,
    setViewMode,
    logCounterattack,
    batchUpdateFromPlaid,
    setAutopay,
    setAutopayDueDay,
    setRobinhoodStatus,
    setHarleyDefiSplit,
    setAutopayThreshold,
    logHarvestPlan,
    reset,
  }
}
