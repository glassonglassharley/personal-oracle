// Recursive behavioral pattern scanner for coaching notes.
//
// Recursion mechanics:
//  Root call receives ALL completed note entries (those with nextDaySkipped !== null).
//  For each "signal" (mood keyword or metric threshold), it partitions the entry set
//  into matching/non-matching subsets, computes the skip-next-workout rate for matches,
//  and if the rate is strongly one-sided (≥60%), records a candidate pattern then
//  RECURSES into the matching subset to find a second signal that refines it further.
//  If sub-patterns have higher confidence than the parent, the parent emits only the
//  sub-patterns. Terminates when subset < 3 entries or maxDepth (3) is reached.

const MOOD_KEYWORDS = [
  'tired', 'exhausted', 'stressed', 'anxious', 'sick', 'sore',
  'great', 'motivated', 'lazy', 'struggling', 'busy', 'overwhelmed',
  'energized', 'rough', 'drained',
]

const METRIC_SIGNALS = [
  { id: 'sleep_low',  label: 'sleep < 5h',  test: e => e.sleep > 0 && e.sleep < 5 },
  { id: 'sleep_mid',  label: 'sleep 5–7h',  test: e => e.sleep >= 5 && e.sleep < 7 },
  { id: 'sleep_good', label: 'sleep ≥ 7h',  test: e => e.sleep >= 7 },
  { id: 'reps_zero',  label: 'rest day',    test: e => e.reps === 0 },
  { id: 'water_low',  label: 'water < 4',   test: e => e.water > 0 && e.water < 4 },
  { id: 'steps_low',  label: '< 3k steps',  test: e => e.steps > 0 && e.steps < 3000 },
]

function signalLabel(id) {
  const ms = METRIC_SIGNALS.find(s => s.id === id)
  return ms ? ms.label : id.replace(/_/g, ' ')
}

function getSignals(entry) {
  const signals = []
  const mood = (entry.mood || '').toLowerCase()
  for (const kw of MOOD_KEYWORDS) {
    if (mood.includes(kw)) signals.push(kw)
  }
  for (const ms of METRIC_SIGNALS) {
    if (ms.test(entry)) signals.push(ms.id)
  }
  return signals
}

function scanPatterns(entries, depth = 0, parentSignals = []) {
  if (entries.length < 3 || depth >= 3) return []

  const completed = entries.filter(e => e.nextDaySkipped !== null && e.nextDaySkipped !== undefined)
  if (completed.length < 3) return []

  const allSignals = new Set()
  for (const e of completed) {
    for (const s of getSignals(e)) {
      if (!parentSignals.includes(s)) allSignals.add(s)
    }
  }

  const results = []

  for (const signal of allSignals) {
    const matching = completed.filter(e => getSignals(e).includes(signal))
    if (matching.length < 3) continue

    const skipCount = matching.filter(e => e.nextDaySkipped).length
    const outcomeRate = skipCount / matching.length
    if (outcomeRate > 0.4 && outcomeRate < 0.6) continue  // ambiguous, skip

    const confidence = outcomeRate >= 0.5 ? outcomeRate : 1 - outcomeRate
    const pattern = {
      signals: [...parentSignals, signal],
      outcomeRate,
      sampleSize: matching.length,
      outcome: outcomeRate >= 0.5 ? 'tends_to_skip' : 'tends_to_complete',
      confidence,
    }

    const subPatterns = scanPatterns(matching, depth + 1, [...parentSignals, signal])
    const strongerSubs = subPatterns.filter(sp => sp.confidence > confidence)

    if (strongerSubs.length > 0) {
      results.push(...strongerSubs)
    } else {
      results.push(pattern)
      results.push(...subPatterns.filter(sp => sp.confidence >= confidence))
    }
  }

  const seen = new Set()
  return results
    .filter(p => {
      const key = [...p.signals].sort().join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) =>
      (b.confidence * Math.log(b.sampleSize + 1)) -
      (a.confidence * Math.log(a.sampleSize + 1))
    )
}

function formatPatterns(patterns, limit = 3) {
  return patterns.slice(0, limit).map(p => {
    const signalStr = p.signals.map(signalLabel).join(' + ')
    const pct = Math.round(p.confidence * 100)
    const note = `${p.sampleSize} sessions`
    if (p.outcome === 'tends_to_skip') {
      return `When user reports "${signalStr}", they skip their next workout ${pct}% of the time (${note}).`
    }
    return `When user reports "${signalStr}", they complete their next workout ${pct}% of the time (${note}).`
  })
}

export { scanPatterns, formatPatterns, MOOD_KEYWORDS }
