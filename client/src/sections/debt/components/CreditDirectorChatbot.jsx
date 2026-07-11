import { useEffect, useMemo, useRef, useState } from 'react'

const QUICK_PROMPTS = [
  'What should I pay first?',
  'How do I raise my score fastest?',
  'What risks need attention this week?',
  'Build me a 30-day action plan',
]

function money(value) {
  const num = Number(value) || 0
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(value) {
  if (!Number.isFinite(value)) return '0.0%'
  return `${value.toFixed(1)}%`
}

function getUtilization(debt) {
  const limit = Number(debt.limit) || 0
  if (limit <= 0) return null
  return ((Number(debt.balance) || 0) / limit) * 100
}

function getDailyInterest(debt) {
  const apr = Number(debt.apr)
  const balance = Number(debt.balance) || 0
  if (!Number.isFinite(apr) || apr <= 0 || balance <= 0) return 0
  return ((apr / 100) / 365) * balance
}

function sentenceList(items, fallback) {
  const usable = items.filter(Boolean)
  return usable.length ? usable.join('\n') : fallback
}

function analyzePortfolio(store) {
  const activeDebts = store.debts.filter(d => d.balance > 0)
  const paidDebts = store.debts.filter(d => d.balance <= 0)
  const totalLimit = activeDebts.reduce((sum, d) => sum + Math.max(0, Number(d.limit) || 0), 0)
  const totalBalance = activeDebts.reduce((sum, d) => sum + Math.max(0, Number(d.balance) || 0), 0)
  const aggregateUtilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : null
  const overLimit = activeDebts
    .map(d => ({ ...d, utilization: getUtilization(d), overBy: Math.max(0, (Number(d.balance) || 0) - (Number(d.limit) || 0)) }))
    .filter(d => d.overBy > 0)
    .sort((a, b) => b.overBy - a.overBy)
  const highUtilization = activeDebts
    .map(d => ({ ...d, utilization: getUtilization(d) }))
    .filter(d => Number.isFinite(d.utilization) && d.utilization >= 70 && !overLimit.some(o => o.id === d.id))
    .sort((a, b) => b.utilization - a.utilization)
  const missingMinimums = activeDebts.filter(d => !d.minPayment)
  const missingAprs = activeDebts.filter(d => d.apr == null)
  const autopayGaps = activeDebts.filter(d => !d.autopayEnabled)
  const snowballOrder = [...activeDebts].sort((a, b) => a.balance - b.balance)
  const avalancheOrder = [...activeDebts]
    .filter(d => d.apr != null)
    .sort((a, b) => (Number(b.apr) || 0) - (Number(a.apr) || 0))
  const dailyInterest = activeDebts.reduce((sum, d) => sum + getDailyInterest(d), 0)
  const monthlyMinimums = activeDebts.reduce((sum, d) => sum + (Number(d.minPayment) || 0), 0)
  const autopayCommitted = activeDebts.reduce((sum, d) => sum + (d.autopayEnabled ? Number(d.autopayAmount) || 0 : 0), 0)
  const nextTarget = snowballOrder[0] ?? null
  const highestApr = avalancheOrder[0] ?? null
  const smallestOverLimit = overLimit.length
    ? [...overLimit].sort((a, b) => a.overBy - b.overBy)[0]
    : null

  return {
    activeDebts,
    paidDebts,
    totalBalance,
    totalLimit,
    aggregateUtilization,
    overLimit,
    highUtilization,
    missingMinimums,
    missingAprs,
    autopayGaps,
    snowballOrder,
    avalancheOrder,
    dailyInterest,
    monthlyMinimums,
    autopayCommitted,
    nextTarget,
    highestApr,
    smallestOverLimit,
  }
}

function buildExecutiveBrief(store, analysis) {
  const scoreLine = `Grid Integrity is ${store.gridIntegrity} (${store.clearanceTier}) with a projected ceiling of ${store.projectedScore} after payoff.`
  const utilLine = analysis.aggregateUtilization == null
    ? 'Aggregate utilization cannot be calculated until all limits are entered.'
    : `Aggregate utilization is ${pct(analysis.aggregateUtilization)} across ${money(analysis.totalLimit)} in listed limits.`
  const targetLine = analysis.nextTarget
    ? `The current snowball target is ${analysis.nextTarget.lender} at ${money(analysis.nextTarget.balance)}.`
    : 'All active debts are neutralized.'

  return `${scoreLine}\n${utilLine}\n${targetLine}\nTotal listed active debt is ${money(analysis.totalBalance)}. Estimated interest bleed from entered APRs is ${money(analysis.dailyInterest)}/day.`
}

function buildPriorityStack(store, analysis) {
  const priorities = []

  if (analysis.overLimit.length) {
    priorities.push(`1) Emergency utilization triage: bring over-limit cards back under their limits first. ${analysis.overLimit.map(d => `${d.lender} is over by ${money(d.overBy)} (${pct(d.utilization)} util)`).join('; ')}. Over-limit balances are likely hurting score more than ordinary balances.`)
  } else if (analysis.highUtilization.length) {
    priorities.push(`1) Utilization triage: no cards are currently over limit, but ${analysis.highUtilization.length} card${analysis.highUtilization.length === 1 ? '' : 's'} sit above 70% utilization. First pressure point: ${analysis.highUtilization[0].lender} at ${pct(analysis.highUtilization[0].utilization)}.`)
  } else {
    priorities.push('1) Keep every account current. No over-limit emergency is visible from the data entered, so payment consistency and momentum are the top priorities.')
  }

  if (analysis.nextTarget) {
    priorities.push(`2) Snowball execution: attack ${analysis.nextTarget.lender} next because it is the smallest live balance at ${money(analysis.nextTarget.balance)}. Keep minimums current everywhere else and send every surplus dollar here until it is zero.`)
  }

  if (analysis.highestApr) {
    priorities.push(`3) Interest defense: your highest entered APR is ${analysis.highestApr.lender} at ${analysis.highestApr.apr}%. If two targets are close in balance, favor this one because it is the most expensive debt per dollar.`)
  } else {
    priorities.push('3) Interest defense: APRs are missing, so the app cannot identify the true most expensive account. Enter APRs before making a final avalanche-vs-snowball decision.')
  }

  if (analysis.freedUpMinimums > 0 || store.freedUpMinimums > 0) {
    priorities.push(`4) Snowball redeployment: ${money(store.freedUpMinimums)} per month has been freed. Do not let that disappear into lifestyle spend; route it to the active target.`)
  }

  return priorities.join('\n')
}

function buildThirtyDayPlan(store, analysis) {
  const firstOverLimit = analysis.smallestOverLimit
  const nextTarget = analysis.nextTarget
  const missing = []
  if (analysis.missingMinimums.length) missing.push(`minimum payments for ${analysis.missingMinimums.slice(0, 4).map(d => d.lender).join(', ')}`)
  if (analysis.missingAprs.length) missing.push(`APRs for ${analysis.missingAprs.slice(0, 4).map(d => d.lender).join(', ')}`)
  if (analysis.autopayGaps.length) missing.push(`autopay/due-day coverage for ${analysis.autopayGaps.slice(0, 4).map(d => d.lender).join(', ')}`)

  return [
    'Days 1–2: Data cleanup. Confirm every balance, credit limit, APR, minimum payment, due date, and autopay amount. Good credit repair starts with clean source data.',
    firstOverLimit
      ? `Days 3–10: Pay ${money(firstOverLimit.overBy + 5)} toward ${firstOverLimit.lender} if possible to get it under limit with a small cushion. That can remove an obvious utilization red flag.`
      : nextTarget
        ? `Days 3–10: Make the first extra strike against ${nextTarget.lender}. Even a small payment matters because this is the account most likely to be eliminated next.`
        : 'Days 3–10: Preserve the clean state. Keep accounts at $0 and avoid new balances reporting.',
    nextTarget
      ? `Days 11–21: Continue the snowball on ${nextTarget.lender}. Your target number is ${money(nextTarget.balance)} remaining; set a weekly micro-goal so the card visibly moves.`
      : 'Days 11–21: Build a cash buffer so future bills do not create new revolving balances.',
    analysis.highestApr
      ? `Days 22–30: Review whether the highest-APR account (${analysis.highestApr.lender}, ${analysis.highestApr.apr}%) should become the next priority after the current snowball kill.`
      : 'Days 22–30: Add APRs, then compare snowball momentum against avalanche interest savings.',
    missing.length
      ? `Before the next statement cycle: fill in ${missing.join('; ')}.`
      : 'Before the next statement cycle: verify all autopays are scheduled and no due date lands before cash arrives.',
  ].join('\n')
}

function buildScoreAdvice(store, analysis) {
  const utilAdvice = analysis.aggregateUtilization == null
    ? 'Enter credit limits for every revolving account so utilization recommendations become precise.'
    : analysis.aggregateUtilization > 89
      ? 'Your aggregate utilization is extremely high. The fastest score lift usually comes from getting individual cards below 100%, then below 89%, then 69%, then 49%, then 29% utilization as cash allows.'
      : analysis.aggregateUtilization > 49
        ? 'Your aggregate utilization is still elevated. Push the biggest individual utilization offenders below 49% and then 29% to improve the profile lenders see.'
        : analysis.aggregateUtilization > 29
          ? 'You are approaching healthier utilization. The next score-oriented target is under 29% aggregate and under 29% on as many individual cards as possible.'
          : 'Utilization is in a healthier range based on entered data. Keep statements reporting low and protect payment history.'

  return `${utilAdvice}\nPayment history remains the director-level non-negotiable: minimums on time, every time. Do not close old accounts just because they hit zero unless there is a fee or strategic reason; available credit and age can help the profile. Avoid new hard inquiries while this payoff sprint is active unless a refinance or balance-transfer offer clearly saves more than it costs.`
}

function buildRiskReview(analysis) {
  const risks = []
  if (analysis.overLimit.length) risks.push(`Over-limit exposure: ${analysis.overLimit.map(d => `${d.lender} (${money(d.overBy)} over)`).join(', ')}.`)
  if (analysis.highUtilization.length) risks.push(`High utilization exposure: ${analysis.highUtilization.slice(0, 5).map(d => `${d.lender} at ${pct(d.utilization)}`).join(', ')}.`)
  if (analysis.missingMinimums.length) risks.push(`Missing minimum payment data: ${analysis.missingMinimums.length} account${analysis.missingMinimums.length === 1 ? '' : 's'}. Without this, snowball cash-flow projections are incomplete.`)
  if (analysis.missingAprs.length) risks.push(`Missing APR data: ${analysis.missingAprs.length} account${analysis.missingAprs.length === 1 ? '' : 's'}. Without this, the app cannot quantify interest bleed accurately.`)
  if (analysis.autopayGaps.length) risks.push(`Autopay/due-date gap: ${analysis.autopayGaps.length} active account${analysis.autopayGaps.length === 1 ? '' : 's'} not marked autopay-enabled.`)
  return sentenceList(risks, 'No urgent structural risks are visible from the entered data. Keep balances current, verify statement dates, and avoid new revolving charges while executing the plan.')
}

function buildAnswer(question, store, analysis) {
  const q = question.toLowerCase()
  const sections = []

  const isFullBrief = q === 'full recommendation' || q.length < 10
  if (isFullBrief) {
    sections.push('Director readout:')
    sections.push(buildExecutiveBrief(store, analysis))
  }

  if (q.includes('score') || q.includes('credit') || q.includes('raise')) {
    sections.push('Score repair strategy:')
    sections.push(buildScoreAdvice(store, analysis))
  } else if (q.includes('risk') || q.includes('week') || q.includes('urgent')) {
    sections.push('Risk review:')
    sections.push(buildRiskReview(analysis))
  } else if (q.includes('30') || q.includes('plan') || q.includes('month')) {
    sections.push('30-day operating plan:')
    sections.push(buildThirtyDayPlan(store, analysis))
  } else if (q.includes('pay') || q.includes('first') || q.includes('target') || q.includes('next')) {
    sections.push('Payment priority stack:')
    sections.push(buildPriorityStack(store, analysis))
  } else {
    if (!isFullBrief) {
      sections.push('Director readout:')
      sections.push(buildExecutiveBrief(store, analysis))
    }
    sections.push('Recommended strategy:')
    sections.push(buildPriorityStack(store, analysis))
    sections.push('30-day operating plan:')
    sections.push(buildThirtyDayPlan(store, analysis))
    sections.push('Score repair strategy:')
    sections.push(buildScoreAdvice(store, analysis))
  }

  return sections.join('\n\n')
}

export default function CreditDirectorChatbot({ store }) {
  const analysis = useMemo(() => analyzePortfolio(store), [store])
  const [open, setOpen] = useState(true)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState(() => ([
    {
      role: 'advisor',
      text: buildAnswer('full recommendation', store, analyzePortfolio(store)),
    },
  ]))
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function ask(question) {
    const cleaned = question.trim()
    if (!cleaned || loading) return
    setInput('')
    setLoading(true)

    setMessages(prev => [
      ...prev,
      { role: 'user', text: cleaned },
      { role: 'advisor', text: '', streaming: true },
    ].slice(-10))

    try {
      const res = await fetch('/api/debt/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleaned, store }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]' || payload === '[ERROR]') continue
          try {
            const { text } = JSON.parse(payload)
            if (text) {
              setMessages(prev => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last?.streaming) next[next.length - 1] = { ...last, text: last.text + text }
                return next
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.streaming) next[next.length - 1] = { role: 'advisor', text: `Director offline: ${err.message}. Verify ANTHROPIC_API_KEY is set in Vercel env vars.` }
        return next
      })
    } finally {
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.streaming) next[next.length - 1] = { ...last, streaming: false }
        return next
      })
      setLoading(false)
    }
  }

  const summary = analysis.nextTarget
    ? `${analysis.nextTarget.lender} · ${money(analysis.nextTarget.balance)} active target`
    : 'All debts neutralized'

  return (
    <section className={`director-chatbot ${open ? 'is-open' : 'is-collapsed'}`}>
      <div className="director-header">
        <div>
          <div className="director-eyebrow">// SENIOR CREDIT REPAIR DIRECTOR</div>
          <h2 className="director-title">STRATEGY CHATBOT</h2>
          <p className="director-summary">{summary}</p>
        </div>
        <button className="director-toggle" onClick={() => setOpen(v => !v)}>
          {open ? 'MINIMIZE' : 'OPEN'}
        </button>
      </div>

      {open && (
        <>
          <div className="director-kpis">
            <span>{money(analysis.totalBalance)} active debt</span>
            <span>{analysis.aggregateUtilization == null ? 'Util n/a' : `${pct(analysis.aggregateUtilization)} util`}</span>
            <span>{money(analysis.dailyInterest)}/day bleed</span>
            <span>{analysis.overLimit.length} over-limit</span>
          </div>

          <div className="director-quick-prompts">
            {QUICK_PROMPTS.map(prompt => (
              <button key={prompt} disabled={loading} onClick={() => ask(prompt)}>{prompt}</button>
            ))}
          </div>

          <div className="director-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`director-message ${message.role}${message.streaming ? ' is-streaming' : ''}`}>
                <div className="director-message-label">{message.role === 'advisor' ? 'DIRECTOR' : 'YOU'}</div>
                <div className="director-message-text">
                  {message.streaming && message.text === ''
                    ? <p className="director-thinking">Analyzing...</p>
                    : message.text.split('\n').map((line, lineIndex) => (
                        <p key={lineIndex}>{line || ' '}</p>
                      ))
                  }
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="director-input-row" onSubmit={e => { e.preventDefault(); ask(input) }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              placeholder={loading ? 'Director is thinking...' : 'Ask anything — "what if I paid off Avant?" "what should I hit next?"'}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? '...' : 'ASK'}
            </button>
          </form>
        </>
      )}
    </section>
  )
}
