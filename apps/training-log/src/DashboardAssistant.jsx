import { useMemo, useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''

function fmtNum(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n.toLocaleString() : '0'
}

function compactDay(day, customExercises = []) {
  const out = {
    date: day?.date,
    steps: Number(day?.steps || 0),
    water: Number(day?.water || 0),
    sleepHours: Number(day?.sleepHours || 0),
    meals: Array.isArray(day?.meals) ? day.meals.length : 0,
    pushups: Number(day?.pushups || 0),
    squats: Number(day?.squats || 0),
    situps: Number(day?.situps || 0),
    pullups: Number(day?.pullups || 0),
    curls: Number(day?.curls || 0),
    bench: day?.bench && typeof day.bench === 'object' ? Number(day.bench.reps || 0) : Number(day?.bench || 0),
  }
  for (const ex of customExercises) {
    const v = day?.[ex.id]
    if (['reps', 'bench', 'weighted_reps'].includes(ex.type)) {
      const reps = v && typeof v === 'object' ? Number(v.reps || 0) : Number(v || 0)
      if (reps > 0) out[ex.name] = reps
    }
  }
  return out
}

function makeVisibleSummary({ dayData, history, customExercises, goals, nutritionGoals, records, recap }) {
  const today = compactDay(dayData, customExercises)
  const recent = [...(history || [])].slice(0, 10).map(day => compactDay(day, customExercises))
  const recordList = Object.values(records || {}).map(r => ({
    exercise: r.exercise, display: r.display, date: r.date, type: r.type,
  }))
  const repVal = id => {
    const v = dayData?.[id]
    return v && typeof v === 'object' ? Number(v.reps || 0) : Number(v || 0)
  }
  const workoutToday = ['pushups', 'squats', 'situps', 'pullups', 'curls', 'bench']
    .reduce((sum, id) => sum + repVal(id), 0)
    + (customExercises || []).reduce((sum, ex) => {
        if (['reps', 'weighted_reps', 'bench'].includes(ex.type)) return sum + repVal(ex.id)
        return sum
      }, 0)

  return {
    today,
    goals: { workouts: goals || {}, waterCups: nutritionGoals?.water || 8, steps: goals?.steps || 10000 },
    recentDays: recent,
    records: recordList,
    dashboardStats: {
      workoutRepsOrSetsToday: workoutToday,
      weeklyReps: recap?.weeklyVol?.thisWeek || 0,
      lastWeekReps: recap?.weeklyVol?.lastWeek || 0,
      weeklyVolumeChangePercent: recap?.weeklyVol?.changePercent ?? null,
      streak: recap?.streak || 0,
      weekSessions: recap?.weekSessions || 0,
      prCountToday: recap?.prs?.length || 0,
    },
  }
}

function fallbackAdvice(summary) {
  const items = []
  const today = summary.today || {}
  const stats = summary.dashboardStats || {}
  const waterGoal = summary.goals?.waterCups || 8
  const stepGoal = summary.goals?.steps || 10000

  if ((today.water || 0) < waterGoal) items.push(`Water is at ${today.water || 0}/${waterGoal} cups — ${Math.max(0, waterGoal - (today.water || 0)).toFixed(1).replace(/\.0$/, '')} more cups is your next easy win.`)
  else items.push('Hydration win — you hit your water goal. Keep it steady.')

  if ((today.steps || 0) < stepGoal) items.push(`You are at ${fmtNum(today.steps)}/${fmtNum(stepGoal)} steps. A short walk closes the gap.`)
  else items.push('Steps are handled. Recovery or strength can be the focus now.')

  if ((today.sleepHours || 0) > 0 && today.sleepHours < 7) items.push(`Sleep was ${today.sleepHours}h — keep training moderate and protect bedtime tonight.`)
  else if ((today.sleepHours || 0) >= 7) items.push(`${today.sleepHours}h sleep is a strong recovery base. Good energy to push today.`)
  else items.push('No sleep logged yet — add bedtime and wake time so I can read recovery better.')

  if (stats.weekSessions >= 5) items.push('Solid week. Consider an easy mobility or rest day — progress needs recovery.')
  else if (stats.weekSessions <= 1) items.push('Pick one simple thing today — a walk, one set, or one clean meal — and stack from there.')
  else items.push('Weekly rhythm looks balanced. Pick one quality progression instead of maxing everything.')

  if (summary.records?.length) items.push(`PR board has ${summary.records.length} records. Choose one movement and chase a small improvement.`)

  return items.slice(0, 4)
}

export default function DashboardAssistant({ dayData, history, customExercises, goals, nutritionGoals, records, recap, authHeaders }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [advice, setAdvice] = useState(null)
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastFetchedRepsRef = useRef(null)
  const historyLoadedRef = useRef(false)

  const summary = useMemo(() => makeVisibleSummary({ dayData, history, customExercises, goals, nutritionGoals, records, recap }), [dayData, history, customExercises, goals, nutritionGoals, records, recap])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, advice])

  function handleOpen() {
    setOpen(true)
    const currentReps = summary.dashboardStats.workoutRepsOrSetsToday
    const stale = !hasLoaded || lastFetchedRepsRef.current !== currentReps
    if (stale) {
      setHasLoaded(true)
      lastFetchedRepsRef.current = currentReps
      setAdvice(null)
      getAdvice()
    }
    // Load stored conversation history once per session
    if (!historyLoadedRef.current) {
      historyLoadedRef.current = true
      loadStoredHistory()
    }
    setTimeout(() => inputRef.current?.focus(), 120)
  }

  async function loadStoredHistory() {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/coach?action=load`, { headers })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages)
      }
    } catch {
      // Stored history is best-effort — silently skip on failure
    }
  }

  function handleClose() {
    setOpen(false)
  }

  async function getAdvice() {
    setLoading(true)
    setError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/coach`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advice', summary }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
      setAdvice(Array.isArray(data.recommendations) ? data.recommendations : fallbackAdvice(summary))
      setSource(data.source || 'rules')
    } catch (err) {
      setAdvice(fallbackAdvice(summary))
      setSource('on-device')
      setError(err?.message || '')
    } finally {
      setLoading(false)
    }
  }

  async function sendQuestion(e) {
    e?.preventDefault?.()
    const text = question.trim()
    if (!text || chatLoading) return
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setQuestion('')
    setChatLoading(true)
    setError('')
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/coach`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', question: text, summary }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
      const answer = data.answer || fallbackAdvice(summary)[0]
      setMessages([...nextMessages, { role: 'assistant', content: answer }])
      setSource(data.source || 'model')
      // Fire-and-forget: update coach notes with this exchange
      fetch(`${API}/api/coach`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_notes', userMsg: text, assistantReply: answer, summary }),
      }).catch(() => {})
    } catch (err) {
      setMessages([...nextMessages, { role: 'assistant', content: fallbackAdvice(summary)[0] }])
      setSource('on-device')
      setError(err?.message || '')
    } finally {
      setChatLoading(false)
    }
  }

  const preview = advice || fallbackAdvice(summary).slice(0, 3)

  return (
    <>
      <style>{`
        @keyframes fabChatIn {
          from { opacity: 0; transform: scale(0.88) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes fabPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.22); }
          50%       { box-shadow: 0 4px 28px rgba(0,0,0,0.38); }
        }
      `}</style>

      {/* FAB */}
      <button
        onClick={handleOpen}
        aria-label="Open training coach"
        style={{
          position: 'fixed',
          bottom: 'calc(28px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
          right: 20,
          zIndex: 850,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          fontSize: 22,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fabPulse 3s ease-in-out infinite',
          transition: 'transform 0.15s',
        }}
      >
        💬
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 851,
            background: 'rgba(0,0,0,0.18)',
          }}
        />
      )}

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(92px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)))',
          right: 16,
          width: 'min(370px, calc(100vw - 32px))',
          maxHeight: 'min(540px, calc(100dvh - 130px))',
          zIndex: 852,
          borderRadius: 20,
          background: 'var(--bg)',
          border: '1.5px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fabChatIn 0.22s cubic-bezier(0.32,0.72,0,1)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 14px 11px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontWeight: 850, fontSize: 15, color: 'var(--text)', lineHeight: 1.2 }}>Training Coach</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                {summary.dashboardStats.workoutRepsOrSetsToday > 0
                  ? `${summary.dashboardStats.workoutRepsOrSetsToday.toLocaleString()} reps logged today`
                  : source || 'no reps logged yet'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={getAdvice}
                disabled={loading}
                title="Refresh recommendations"
                style={{
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface)', color: 'var(--text)',
                  fontSize: 14, cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.55 : 1, padding: '4px 8px',
                  lineHeight: 1,
                }}
              >
                {loading ? '…' : '↺'}
              </button>
              <button
                onClick={handleClose}
                style={{
                  border: 'none', borderRadius: 8,
                  background: 'transparent', color: 'var(--muted)',
                  fontSize: 18, cursor: 'pointer', padding: '2px 6px', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Recommendations */}
            {loading ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Loading recommendations…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: messages.length ? 10 : 0 }}>
                {preview.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 900, fontSize: 13, lineHeight: 1.5, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Chat messages */}
            {messages.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {messages.map((m, i) => {
                  const mine = m.role === 'user'
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '88%',
                        borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        padding: '8px 11px', fontSize: 13, lineHeight: 1.45,
                        background: mine ? 'var(--accent)' : 'var(--surface)',
                        color: mine ? '#fff' : 'var(--text)',
                        border: mine ? 'none' : '1px solid var(--border)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {m.content}
                      </div>
                    </div>
                  )
                })}
                {chatLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      borderRadius: '14px 14px 14px 4px', padding: '8px 14px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      color: 'var(--muted)', fontSize: 20, letterSpacing: 2,
                    }}>···</div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendQuestion}
            style={{
              padding: '10px 12px 13px',
              borderTop: '1px solid var(--border)',
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask about your training…"
              style={{
                minWidth: 0, background: 'var(--surface)', border: '1.5px solid var(--border)',
                borderRadius: 12, color: 'var(--text)', fontSize: 13,
                fontFamily: 'inherit', padding: '10px 12px', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!question.trim() || chatLoading}
              style={{
                border: 'none', borderRadius: 12, padding: '0 14px',
                background: 'var(--accent)', color: '#fff',
                fontSize: 13, fontWeight: 850,
                cursor: (!question.trim() || chatLoading) ? 'default' : 'pointer',
                opacity: (!question.trim() || chatLoading) ? 0.5 : 1,
              }}
            >
              ↑
            </button>
          </form>
        </div>
      )}
    </>
  )
}
