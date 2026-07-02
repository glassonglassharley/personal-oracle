import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../lib/serverAuth.js'
import { scanPatterns, formatPatterns, MOOD_KEYWORDS } from '../lib/coach/scanPatterns.js'

export const config = { maxDuration: 30 }

// ── System prompt ──────────────────────────────────────────────────────────────

const COACH_BASE_PROMPT = `You are Sidekick, a direct, sharp personal training coach inside a fitness tracking app. You have the user's actual logged data: reps, exercise history, PRs, streaks, sleep, steps, water, nutrition, meditation, books. Always reference real numbers — never give generic advice when specific data exists.

Tone: warm, direct, motivating. Not preachy or clinical. You're a coach who spots patterns the user can't see. Celebrate concrete wins. Flag real risks. Be specific about what the user needs to do next.

Coach response structure for chat answers:
- Use bullet lists by default unless the user explicitly asks for a quick answer.
- Give enough depth to be useful: usually 4–8 bullets or short sections, not a one-sentence pep talk.
- Start with "What I see" and cite the relevant numbers from the context.
- Include "What you need to do" with a practical plan for today or the next session.
- Include "Why this works" so the user understands the training logic.
- Include "Watch-outs" when recovery, pain, sleep, volume spikes, hydration, or nutrition could change the plan.
- If data is missing, say what is missing and give the best plan from available data instead of being vague.
- Ask at most one follow-up question, and only after giving an actionable answer.`

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text))
}

function classifyCoachIntent(question = '') {
  const q = String(question).toLowerCase()

  if (hasAny(q, [
    /\b(meal|meals|breakfast|lunch|dinner|snack|recipe|recipes|food|foods|eat|eating|diet|grocery|groceries)\b/,
    /\b(what should i eat|best .* eat|meal ideas?|food ideas?)\b/,
  ])) return 'meal_ideas'

  if (hasAny(q, [
    /\b(nutrition|macro|macros|protein|calorie|calories|bulk|bulking|cut|cutting|fat loss|lose fat|low fat|lean muscle|swole|supplement|supplements|creatine|carbs?|fats?)\b/,
  ])) return 'nutrition'

  if (hasAny(q, [
    /\b(sore|soreness|sleep|rest day|rest days|rest|fatigue|tired|injury|injured|hurt|ache|pain|recover|recovery|deload)\b/,
  ])) return 'recovery'

  if (hasAny(q, [
    /\b(how am i doing|progress|trend|trends|stats|statistics|prs?|personal records?|records?|streak|streaks|weekly|monthly|this week|this month)\b/,
  ])) return 'progress_summary'

  if (hasAny(q, [
    /\b(workout|work out|train|training|exercise|lift|lifting|routine|program|sets?|reps?|what should i do|what do i do)\b/,
  ])) return 'training_advice'

  return 'general'
}

function buildIntentInstruction(intent) {
  switch (intent) {
    case 'nutrition':
      return `Detected intent: nutrition. Answer the user's food/nutrition question directly first. Give practical guidance about protein, calories, carbs, fats, bulking/cutting/lean muscle/supplements as relevant. Include specific food or meal examples, rough targets or ranges when possible, and explain what to do today. Do not deflect into generic dashboard motivation or "pick one small action" advice.`
    case 'meal_ideas':
      return `Detected intent: meal_ideas. Answer with concrete meals/snacks the user can eat. Give several options, mention protein/calories/fat when relevant, and include an easy grocery or prep angle. Do not turn this into generic training advice.`
    case 'training_advice':
      return `Detected intent: training_advice. Recommend what workout or training focus to do next using the user's logged data when it helps. Include exercises, volume/intensity guidance, progression target, and a clear stop/modify rule if recovery looks poor.`
    case 'recovery':
      return `Detected intent: recovery. Focus on soreness, sleep, rest days, fatigue, and injury-risk management. Be conservative with pain/injury, and suggest rest or lower intensity when appropriate.`
    case 'progress_summary':
      return `Detected intent: progress_summary. Summarize how the user is doing using their trends, stats, PRs, streaks, and weekly/monthly progress. Reference concrete numbers from context when available, then tell them exactly what to do next to keep momentum.`
    default:
      return `Detected intent: general. Answer the user's actual question directly, using dashboard data only when it is relevant.`
  }
}

function buildSystemPrompt(notes, patterns = []) {
  let prompt = COACH_BASE_PROMPT
  if (patterns && patterns.length > 0) {
    const formatted = formatPatterns(patterns)
    prompt += `\n\nDiscovered behavioral patterns for this user:\n${formatted.map(p => `• ${p}`).join('\n')}\nUse these naturally — mention when contextually relevant, not as a lecture.`
  } else if (notes && notes.trim()) {
    prompt += `\n\nCoach's running notes on this user:\n${notes.trim()}`
  }
  return prompt
}

function buildChatSystemPrompt(notes, patterns = [], intent = 'general') {
  return `${buildSystemPrompt(notes, patterns)}\n\n${buildIntentInstruction(intent)}`
}

// ── DB helpers ─────────────────────────────────────────────────────────────────

async function ensureCoachTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS coach_conversations (
      seq        BIGSERIAL PRIMARY KEY,
      user_id    text NOT NULL,
      role       text NOT NULL,
      content    text NOT NULL,
      created_at timestamptz DEFAULT now()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS coach_conv_user_seq
    ON coach_conversations (user_id, seq DESC)
  `
  await sql`
    CREATE TABLE IF NOT EXISTS coach_data (
      user_id        text PRIMARY KEY,
      notes          text NOT NULL DEFAULT '',
      cache_date     text,
      cached_summary jsonb,
      updated_at     timestamptz DEFAULT now()
    )
  `
  await sql`ALTER TABLE coach_data ADD COLUMN IF NOT EXISTS notes_entries  jsonb NOT NULL DEFAULT '[]'`
  await sql`ALTER TABLE coach_data ADD COLUMN IF NOT EXISTS patterns_cache jsonb DEFAULT NULL`
  await sql`ALTER TABLE coach_data ADD COLUMN IF NOT EXISTS patterns_date  text`
}

async function loadCoachData(sql, userId) {
  const rows = await sql`
    SELECT notes, cache_date, cached_summary, notes_entries, patterns_cache, patterns_date
    FROM coach_data WHERE user_id = ${userId}
  `
  return rows[0] || { notes: '', cache_date: null, cached_summary: null, notes_entries: [], patterns_cache: null, patterns_date: null }
}

async function saveCoachData(sql, userId, { notes, cacheDate, cachedSummary, notesEntries, patternsCache, patternsDate }) {
  const summaryJson  = cachedSummary  != null ? JSON.stringify(cachedSummary)  : null
  const entriesJson  = Array.isArray(notesEntries) ? JSON.stringify(notesEntries) : '[]'
  const patternJson  = Array.isArray(patternsCache) ? JSON.stringify(patternsCache) : null
  await sql`
    INSERT INTO coach_data (user_id, notes, cache_date, cached_summary, notes_entries, patterns_cache, patterns_date, updated_at)
    VALUES (${userId}, ${notes ?? ''}, ${cacheDate ?? null}, ${summaryJson}::jsonb, ${entriesJson}::jsonb, ${patternJson}::jsonb, ${patternsDate ?? null}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      notes          = EXCLUDED.notes,
      cache_date     = EXCLUDED.cache_date,
      cached_summary = EXCLUDED.cached_summary,
      notes_entries  = EXCLUDED.notes_entries,
      patterns_cache = EXCLUDED.patterns_cache,
      patterns_date  = EXCLUDED.patterns_date,
      updated_at     = now()
  `
}

async function loadRecentMessages(sql, userId, limit = 10) {
  const rows = await sql`
    SELECT role, content FROM (
      SELECT role, content, seq
      FROM coach_conversations
      WHERE user_id = ${userId}
      ORDER BY seq DESC
      LIMIT ${limit}
    ) sub ORDER BY seq ASC
  `
  return rows.map(r => ({ role: r.role, content: r.content }))
}

async function saveMessages(sql, userId, userContent, assistantContent) {
  await sql`
    INSERT INTO coach_conversations (user_id, role, content)
    VALUES (${userId}, 'user', ${String(userContent).slice(0, 4000)})
  `
  await sql`
    INSERT INTO coach_conversations (user_id, role, content)
    VALUES (${userId}, 'assistant', ${String(assistantContent).slice(0, 4000)})
  `
}

// ── Trend context builder ──────────────────────────────────────────────────────

function repVal(day, id) {
  const v = day?.[id]
  if (v && typeof v === 'object') return Number(v.reps || 0)
  return Number(v || 0)
}

const CORE_EX = ['pushups', 'squats', 'situps', 'pullups', 'curls', 'bench']

function dayReps(day, customExercises = []) {
  let r = CORE_EX.reduce((s, id) => s + repVal(day, id), 0)
  for (const ex of customExercises) {
    if (['reps', 'bench', 'weighted_reps'].includes(ex.type)) r += repVal(day, ex.id)
  }
  return r
}

function numAvg(arr) {
  const valid = arr.filter(v => Number.isFinite(v) && v > 0)
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0
}

function pctDelta(curr, prev) {
  if (!prev) return null
  const p = Math.round(((curr - prev) / prev) * 100)
  return p > 0 ? `+${p}%` : `${p}%`
}

function buildTrendSummary(history, todayData, customExercises = [], today) {
  // history: sorted newest-first, excludes today
  const last7 = history.slice(0, 7)
  const prev7 = history.slice(7, 14)

  const todayMeals = typeof todayData?.meals === 'number'
    ? todayData.meals
    : (Array.isArray(todayData?.meals) ? todayData.meals.length : 0)

  const currSteps  = numAvg(last7.map(d => Number(d.steps || 0)))
  const currWater  = numAvg(last7.map(d => Number(d.water || 0)))
  const currSleep  = numAvg(last7.map(d => Number(d.sleepHours || 0)))
  const currReps   = numAvg(last7.map(d => dayReps(d, customExercises)))
  const prevSteps  = numAvg(prev7.map(d => Number(d.steps || 0)))
  const prevWater  = numAvg(prev7.map(d => Number(d.water || 0)))
  const prevSleep  = numAvg(prev7.map(d => Number(d.sleepHours || 0)))
  const prevReps   = numAvg(prev7.map(d => dayReps(d, customExercises)))

  // Streak calculation
  const byDate = {}
  for (const d of history) byDate[d.date] = d
  byDate[today] = todayData
  let streak = 0
  const cur = new Date()
  for (let i = 0; i < 90; i++) {
    const key = cur.toISOString().slice(0, 10)
    const d = byDate[key]
    if (dayReps(d || {}, customExercises) > 0 || d?.rest === true) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else if (i === 0) {
      cur.setDate(cur.getDate() - 1)
    } else {
      break
    }
  }

  const recentDays7 = last7.map(d => ({
    date: d.date,
    reps: dayReps(d, customExercises),
    steps: Number(d.steps || 0),
    water: Number(d.water || 0),
    sleep: Number(d.sleepHours || 0),
    meditation: Number(d.meditation || 0),
    books: Number(d.books || 0),
  }))

  return {
    date: today,
    today: {
      reps: dayReps(todayData, customExercises),
      steps: Number(todayData?.steps || 0),
      water: Number(todayData?.water || 0),
      sleep: Number(todayData?.sleepHours || 0),
      meals: todayMeals,
    },
    weeklyAvgs: { reps: currReps, steps: currSteps, water: currWater, sleep: currSleep },
    weekDeltas: {
      reps:  pctDelta(currReps, prevReps),
      steps: pctDelta(currSteps, prevSteps),
      water: pctDelta(currWater, prevWater),
      sleep: pctDelta(currSleep, prevSleep),
    },
    streak,
    recentDays7,
  }
}

// ── AI calls ────────────────────────────────────────────────────────────────────

const CLAUDE_MODEL = process.env.ANTHROPIC_COACH_MODEL || 'claude-haiku-4-5-20251001'
const QWEN_MODEL   = process.env.QWEN_MODEL            || 'qwen/qwen3.6-plus'

async function callQwen(systemPrompt, messages, { maxTokens = 1024 } = {}) {
  const key = (process.env.OPENROUTER_API_KEY || '').replace(/^\uFEFF/, '')
  if (!key) throw new Error('OPENROUTER_API_KEY not set')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://training-log-flax.vercel.app',
      'X-Title': 'Growth Mirror Coach',
    },
    body: JSON.stringify({
      model: QWEN_MODEL,
      max_tokens: maxTokens,
      temperature: 0.35,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty OpenRouter response')
  return text
}

async function callClaude(systemPrompt, messages, { maxTokens = 1024 } = {}) {
  const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  const res = await fetch(
    process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature: 0.35,
        system: systemPrompt,
        messages,
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data?.content?.[0]?.text || ''
}

// Tries Qwen via OpenRouter first; falls back to Claude. Returns { text, source }.
async function callAi(systemPrompt, messages, opts = {}) {
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const text = await callQwen(systemPrompt, messages, opts)
      return { text, source: QWEN_MODEL }
    } catch (err) {
      console.warn('[coach] OpenRouter failed, falling back to Claude:', err?.message)
    }
  }
  const text = await callClaude(systemPrompt, messages, opts)
  return { text, source: CLAUDE_MODEL }
}

// ── Fallback advice ────────────────────────────────────────────────────────────

function fallbackAdvice(trendSummary) {
  const today = trendSummary?.today || {}
  const avgs  = trendSummary?.weeklyAvgs || {}
  const items = []
  if ((today.water || 0) < 8) {
    items.push(`Water at ${today.water || 0}/8 cups — knock out ${8 - (today.water || 0)} more today.`)
  } else {
    items.push('Hydration on track today. Keep it going.')
  }
  if ((today.steps || 0) > 0 && today.steps < 10000) {
    items.push(`${(today.steps || 0).toLocaleString()} steps so far — a short walk closes the gap.`)
  }
  if ((avgs.sleep || 0) > 0 && avgs.sleep < 7) {
    items.push(`Weekly sleep avg is ${avgs.sleep}h — protect that bedtime tonight.`)
  }
  if ((trendSummary?.streak || 0) >= 3) {
    items.push(`${trendSummary.streak}-day streak — protect it today.`)
  }
  return items.length ? items.slice(0, 4) : ['Stay consistent — small daily actions compound.']
}

function fallbackChatAnswer(intent, question, trendSummary) {
  const lower = String(question || '').toLowerCase()
  const today = trendSummary?.today || {}
  const avgs = trendSummary?.weeklyAvgs || {}
  const streak = Number(trendSummary?.streak || 0)
  const base = `Answer in a coaching-report format:\n\nWhat I see:\n- Today: ${today.reps || 0} reps, ${(today.steps || 0).toLocaleString()} steps, ${today.water || 0} cups water, ${today.sleep || 0}h sleep.\n- Weekly averages: ${avgs.reps || 0} reps, ${(avgs.steps || 0).toLocaleString()} steps, ${avgs.sleep || 0}h sleep.\n- Streak: ${streak} days.\n\nWhat you need to do:`

  if (intent === 'nutrition' || intent === 'meal_ideas') {
    if (/low fat|lean|lose fat|fat loss|swole|bulk|bulking|muscle/.test(lower)) {
      return `${base}\n- Go high-protein, moderate-carb, lower-fat for the next meal.\n- Pick one: chicken breast + rice + vegetables, turkey chili, egg whites + oats, Greek yogurt + berries, tuna rice bowl, lean beef + potatoes, or a protein shake + banana.\n- Put protein in every meal and measure oils/sauces so fat does not sneak up.\n\nWhy this works:\n- Protein supports muscle repair; carbs fuel training; controlled fat keeps calories easier to manage.`
    }
    return `${base}\n- Build the next meal around protein first: chicken, turkey, tuna, eggs/egg whites, Greek yogurt, lean beef, tofu, or a protein shake.\n- Add one carb: rice, oats, potatoes, fruit, or wraps.\n- Add vegetables or fruit for fiber.\n\nWatch-outs:\n- Oils, creamy sauces, fried foods, and snacks are the easiest way calories outrun the plan.`
  }

  if (intent === 'recovery') {
    const sleep = trendSummary?.today?.sleep || trendSummary?.weeklyAvgs?.sleep || 0
    return sleep && sleep < 7
      ? `${base}\n- Recovery first today: with sleep around ${sleep}h, keep intensity moderate.\n- Do walking, mobility, hydration, and submaximal sets only.\n- Avoid max-effort sets if anything feels sharp, unstable, or joint-based.\n\nWhy this works:\n- Lower intensity keeps the habit alive without digging a deeper recovery hole.`
      : `${base}\n- If you are sore or run down, take an easy day: light movement, mobility, water, protein, and sleep.\n- If pain is sharp or joint-based, back off rather than push through.\n\nWhy this works:\n- Recovery days protect the next hard session instead of stealing from it.`
  }

  if (intent === 'progress_summary') {
    return `${base}\n- Improve the weakest number by a small amount today.\n- If reps are low, do one easy set. If steps are low, take a 10-minute walk. If water is low, drink 1–2 cups now.\n\nWhy this works:\n- Small daily improvements protect consistency without needing a perfect day.`
  }

  return `${base}\n- Do one useful action now: one set, one short walk, one meal with protein, or one water refill.\n\nWhy this works:\n- The fastest way to rebuild momentum is a logged action you can complete today.\n\nWatch-outs:\n- If sleep is low or pain is present, choose the walk/mobility option instead of pushing intensity.`
}

// ── Advice generation ──────────────────────────────────────────────────────────

async function generateAdvice(trendSummary, goals, notes, patterns) {
  try {
    const contextStr = JSON.stringify({ trendSummary, goals }).slice(0, 8000)
    const { text, source } = await callAi(
      `${buildSystemPrompt(notes, patterns || [])} Return only valid JSON: {"recommendations":["..."]} with 3–4 concise strings grounded in the user's real numbers.`,
      [{ role: 'user', content: contextStr }],
      { maxTokens: 512 }
    )
    if (!text) throw new Error('empty response')
    const parsed = JSON.parse(text)
    const recs = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(v => String(v).trim()).filter(Boolean).slice(0, 4)
      : []
    if (!recs.length) throw new Error('no recommendations')
    return { source, recommendations: recs }
  } catch {
    return { source: 'rules', recommendations: fallbackAdvice(trendSummary) }
  }
}

// ── Structured note appender (called fire-and-forget from frontend) ───────────

function extractMood(userMsg) {
  const lower = (userMsg || '').toLowerCase()
  const found = MOOD_KEYWORDS.filter(k => lower.includes(k))
  return found.length ? found.join(', ') : null
}

async function appendNoteEntry(sql, userId, coachRow, today, todayMetrics, userMsg) {
  try {
    const entries = Array.isArray(coachRow.notes_entries) ? [...coachRow.notes_entries] : []
    const mood = extractMood(userMsg)

    // Retroactively fill in yesterday's workout outcome now that today's data is known
    const d = new Date(today + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    const yesterdayKey = d.toISOString().slice(0, 10)

    let changed = false
    const updated = entries.map(e => {
      if (e.date === yesterdayKey && e.nextDaySkipped === null) {
        changed = true
        return { ...e, nextDayReps: todayMetrics.reps, nextDaySkipped: todayMetrics.reps < 10 }
      }
      return e
    })

    // Append today's entry if it contains a mood signal and doesn't exist yet
    const todayIdx = updated.findIndex(e => e.date === today)
    if (todayIdx === -1 && mood !== null) {
      updated.push({
        date: today,
        mood,
        sleep: todayMetrics.sleep,
        reps: todayMetrics.reps,
        steps: todayMetrics.steps,
        water: todayMetrics.water,
        nextDayReps: null,
        nextDaySkipped: null,
      })
      changed = true
    } else if (todayIdx >= 0 && mood !== null && !updated[todayIdx].mood) {
      updated[todayIdx] = { ...updated[todayIdx], mood }
      changed = true
    }

    if (!changed) return

    const capped = updated.slice(-60)

    // Run pattern scan once per day (pure JS — no AI call)
    let patternsCache = coachRow.patterns_cache
    let patternsDate  = coachRow.patterns_date
    if (patternsDate !== today) {
      patternsCache = scanPatterns(capped)
      patternsDate  = today
    }

    await saveCoachData(sql, userId, {
      notes: coachRow.notes,
      cacheDate: coachRow.cache_date,
      cachedSummary: coachRow.cached_summary,
      notesEntries: capped,
      patternsCache,
      patternsDate,
    })
  } catch {
    // Best-effort; never surface errors to user
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  await ensureCoachTables(sql)

  // ── GET: hydrate stored conversation ────────────────────────────────────────
  if (req.method === 'GET') {
    if (req.query?.action === 'load') {
      const messages = await loadRecentMessages(sql, userId, 10)
      return res.json({ ok: true, messages })
    }
    return res.status(400).json({ error: 'Unknown GET action' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
  }

  const { action } = body || {}

  // ── advice: daily recommendations with cached trend context ─────────────────
  if (action === 'advice') {
    const summary = body?.summary
    if (!summary || typeof summary !== 'object') return res.status(400).json({ error: 'Missing summary' })

    const today = new Date().toISOString().slice(0, 10)
    const coachRow = await loadCoachData(sql, userId)

    let trendSummary = coachRow.cached_summary
    if (!trendSummary || coachRow.cache_date !== today) {
      const [configRows, historyRows] = await Promise.all([
        sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = 'config'`,
        sql`SELECT date, data FROM training_logs
            WHERE user_id = ${userId} AND date NOT IN ('config', ${today})
            ORDER BY date DESC LIMIT 60`,
      ])
      const customExercises = configRows[0]?.data?.customExercises || []
      const history = historyRows.map(r => ({ date: r.date, ...r.data }))
      trendSummary = buildTrendSummary(history, summary.today || {}, customExercises, today)
      await saveCoachData(sql, userId, {
        notes: coachRow.notes,
        cacheDate: today,
        cachedSummary: trendSummary,
        notesEntries: coachRow.notes_entries,
        patternsCache: coachRow.patterns_cache,
        patternsDate: coachRow.patterns_date,
      })
    }

    // Always inject live today values — intra-day changes (water, steps, etc.) must never be served from cache
    trendSummary = {
      ...trendSummary,
      today: {
        ...trendSummary.today,
        water: Number(summary.today?.water || 0),
        steps: Number(summary.today?.steps || 0),
        sleep: Number(summary.today?.sleepHours || 0),
        meals: typeof summary.today?.meals === 'number' ? summary.today.meals : (Array.isArray(summary.today?.meals) ? summary.today.meals.length : 0),
        reps:  Number(summary.dashboardStats?.workoutRepsOrSetsToday || trendSummary.today?.reps || 0),
      },
    }

    const result = await generateAdvice(trendSummary, summary.goals, coachRow.notes, coachRow.patterns_cache)
    return res.json({ ok: true, ...result })
  }

  // ── chat: full coaching exchange with conversation memory ────────────────────
  if (action === 'chat') {
    const question = String(body?.question || '').trim()
    const summary  = body?.summary
    if (!question) return res.status(400).json({ error: 'Missing question' })
    if (!summary || typeof summary !== 'object') return res.status(400).json({ error: 'Missing summary' })

    const today = new Date().toISOString().slice(0, 10)

    const [coachRow, storedMessages] = await Promise.all([
      loadCoachData(sql, userId),
      loadRecentMessages(sql, userId, 8),
    ])

    // Get or compute trend summary (once per day)
    let trendSummary = coachRow.cached_summary
    if (!trendSummary || coachRow.cache_date !== today) {
      const [configRows, historyRows] = await Promise.all([
        sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = 'config'`,
        sql`SELECT date, data FROM training_logs
            WHERE user_id = ${userId} AND date NOT IN ('config', ${today})
            ORDER BY date DESC LIMIT 60`,
      ])
      const customExercises = configRows[0]?.data?.customExercises || []
      const history = historyRows.map(r => ({ date: r.date, ...r.data }))
      trendSummary = buildTrendSummary(history, summary.today || {}, customExercises, today)
      await saveCoachData(sql, userId, {
        notes: coachRow.notes,
        cacheDate: today,
        cachedSummary: trendSummary,
        notesEntries: coachRow.notes_entries,
        patternsCache: coachRow.patterns_cache,
        patternsDate: coachRow.patterns_date,
      })
    }

    // Always inject live today values — intra-day changes (water, steps, etc.) must never be served from cache
    trendSummary = {
      ...trendSummary,
      today: {
        ...trendSummary.today,
        water: Number(summary.today?.water || 0),
        steps: Number(summary.today?.steps || 0),
        sleep: Number(summary.today?.sleepHours || 0),
        meals: typeof summary.today?.meals === 'number' ? summary.today.meals : (Array.isArray(summary.today?.meals) ? summary.today.meals.length : 0),
        reps:  Number(summary.dashboardStats?.workoutRepsOrSetsToday || trendSummary.today?.reps || 0),
      },
    }

    const intent = classifyCoachIntent(question)

    // Build message list: trend context anchor + stored history + new question
    const trendCtx = JSON.stringify(trendSummary).slice(0, 4000)
    const allMessages = [
      { role: 'user',      content: `Current training context:\n${trendCtx}` },
      { role: 'assistant', content: "Got it — I have your full training picture. What's on your mind?" },
      ...storedMessages,
      { role: 'user', content: `Intent: ${intent}\nQuestion: ${question}` },
    ]

    let answer = ''
    let answerSource = CLAUDE_MODEL
    try {
      const result = await callAi(buildChatSystemPrompt(coachRow.notes, coachRow.patterns_cache || [], intent), allMessages, { maxTokens: 1800 })
      answer = result.text
      answerSource = result.source
      if (!answer) throw new Error('empty')
    } catch (err) {
      console.error('[coach/chat] AI error:', err?.message)
      return res.json({
        ok: true,
        answer: fallbackChatAnswer(intent, question, trendSummary),
        source: 'fallback',
      })
    }

    // Save both turns (no await blocking — these are fast inserts)
    await saveMessages(sql, userId, question, answer.trim())

    return res.json({ ok: true, answer: answer.trim(), source: answerSource })
  }

  // ── update_notes: fire-and-forget call from frontend after each exchange ─────
  if (action === 'update_notes') {
    const userMsg        = String(body?.userMsg        || '').trim()
    const assistantReply = String(body?.assistantReply || '').trim()
    const summary        = body?.summary
    if (!userMsg || !assistantReply) return res.json({ ok: true, skipped: true })

    const today = new Date().toISOString().slice(0, 10)
    const todayMetrics = {
      reps:  Number(summary?.dashboardStats?.workoutRepsOrSetsToday || 0),
      sleep: Number(summary?.today?.sleepHours || 0),
      steps: Number(summary?.today?.steps      || 0),
      water: Number(summary?.today?.water       || 0),
    }

    const coachRow = await loadCoachData(sql, userId)
    await appendNoteEntry(sql, userId, coachRow, today, todayMetrics, userMsg)
    return res.json({ ok: true })
  }

  return res.status(400).json({ error: 'Unknown action' })
}
