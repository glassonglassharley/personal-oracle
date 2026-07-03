const Anthropic = require('@anthropic-ai/sdk')

const anthropicApiKey = process.env.ANTHROPIC_API_KEY_DEBT || process.env.ANTHROPIC_API_KEY
const client = new Anthropic({ apiKey: anthropicApiKey })

function money(value) {
  const num = Number(value) || 0
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(value) {
  if (!Number.isFinite(value)) return 'n/a'
  return `${value.toFixed(1)}%`
}

function buildDebtContext(store) {
  const debts = store.debts || []
  const active = debts.filter(d => Number(d.balance) > 0)
  const paid = debts.filter(d => Number(d.balance) <= 0)

  const totalBalance = active.reduce((s, d) => s + (Number(d.balance) || 0), 0)
  const totalLimit = active.reduce((s, d) => s + Math.max(0, Number(d.limit) || 0), 0)
  const aggUtil = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : null
  const dailyInterest = active.reduce((s, d) => {
    const apr = Number(d.apr)
    const bal = Number(d.balance) || 0
    if (!Number.isFinite(apr) || apr <= 0 || bal <= 0) return s
    return s + ((apr / 100) / 365) * bal
  }, 0)

  const snowball = [...active].sort((a, b) => (Number(a.balance) || 0) - (Number(b.balance) || 0))
  const avalanche = [...active].filter(d => d.apr != null).sort((a, b) => (Number(b.apr) || 0) - (Number(a.apr) || 0))

  const debtLines = active.map(d => {
    const bal = Number(d.balance) || 0
    const limit = Number(d.limit) || 0
    const apr = Number(d.apr)
    const min = Number(d.minPayment) || 0
    const util = limit > 0 ? pct((bal / limit) * 100) : 'limit unknown'
    const interest = Number.isFinite(apr) && apr > 0
      ? `${money(((apr / 100) / 365) * bal * 30)}/month interest`
      : 'APR unknown'
    const overLimit = limit > 0 && bal > limit ? ` ⚠️ OVER LIMIT by ${money(bal - limit)}` : ''
    return `  - ${d.lender}: balance ${money(bal)}, limit ${money(limit)}, util ${util}, APR ${Number.isFinite(apr) ? apr + '%' : 'unknown'}, min payment ${min > 0 ? money(min) : 'unknown'}, ${interest}${overLimit}`
  }).join('\n')

  const paidLines = paid.length
    ? `\nPaid-off accounts (${paid.length}): ${paid.map(d => d.lender).join(', ')}`
    : ''

  return `DEBT PORTFOLIO SNAPSHOT
Total active debt: ${money(totalBalance)}
Total credit limit: ${totalLimit > 0 ? money(totalLimit) : 'incomplete'}
Aggregate utilization: ${aggUtil != null ? pct(aggUtil) : 'incomplete — missing limits'}
Daily interest bleed: ${money(dailyInterest)}/day (${money(dailyInterest * 30)}/month)
Credit score (Grid Integrity): ${store.gridIntegrity ?? 'unknown'} — Clearance Tier: ${store.clearanceTier ?? 'unknown'}
Projected score after full payoff: ${store.projectedScore ?? 'unknown'}
Freed-up minimums from paid accounts: ${money(store.freedUpMinimums || 0)}/month

ACTIVE DEBTS (snowball order — smallest balance first):
${snowball.map((d, i) => {
  const bal = Number(d.balance) || 0
  const limit = Number(d.limit) || 0
  const util = limit > 0 ? pct((bal / limit) * 100) : 'util unknown'
  const apr = Number(d.apr)
  return `  ${i + 1}. ${d.lender} — ${money(bal)} remaining (${util} util, APR ${Number.isFinite(apr) ? apr + '%' : 'unknown'})`
}).join('\n')}

DEBT DETAILS:
${debtLines}${paidLines}

AVALANCHE ORDER (highest APR first):
${avalanche.length ? avalanche.map((d, i) => `  ${i + 1}. ${d.lender} — ${d.apr}% APR, ${money(d.balance)} remaining`).join('\n') : '  APRs incomplete — cannot determine avalanche order'}`
}

const SYSTEM_PROMPT = `You are a no-nonsense senior credit repair strategist embedded in a cyberpunk debt-elimination app called Debt Assassination. The user is actively paying off debt using the debt snowball method.

Your job: give direct, specific, actionable advice based ONLY on the debt data provided. Be blunt. Be precise. Use exact dollar amounts and percentages from the data. Never give generic financial advice — always tie every recommendation to the user's specific numbers.

Style rules:
- Lead with the direct answer. Don't warm up, don't hedge.
- Use exact numbers from the data (balances, APRs, utilization percentages, freed monthly minimums).
- When asked "what if I paid off [card]" — give a concrete before/after: utilization change, interest saved per month, minimum freed up, where it falls in snowball order, and a clear YES/NO verdict.
- Keep responses under 250 words unless the question genuinely requires more.
- Snowball order = smallest balance first. Avalanche = highest APR first.
- Never say "consult a financial advisor." You are the advisor.
- No disclaimers at the end.`

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { question, store } = req.body || {}
  if (!question || !store) {
    return res.status(400).json({ error: 'Missing question or store data' })
  }

  if (!anthropicApiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY_DEBT not configured' })
  }

  try {
    const debtContext = buildDebtContext(store)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is my current debt data:\n\n${debtContext}\n\nMy question: ${question}`,
        },
      ],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('Claude API error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI request failed', detail: err.message })
    } else {
      res.write('data: [ERROR]\n\n')
      res.end()
    }
  }
}
