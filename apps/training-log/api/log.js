import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../lib/serverAuth.js'

function mergeDayData(existing, incoming) {
  const result = { ...existing }
  for (const [key, val] of Object.entries(incoming || {})) {
    if (val === null) delete result[key]
    else result[key] = val
  }
  return result
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS training_logs (
      user_id    TEXT NOT NULL,
      date       TEXT NOT NULL,
      data       JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, date)
    )
  `
}

async function ensureStepsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS daily_steps (
      id         uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id    text         NOT NULL,
      date       text         NOT NULL,
      steps      integer      DEFAULT 0,
      source     text         DEFAULT 'training_log',
      updated_at timestamptz  DEFAULT now(),
      UNIQUE (user_id, date)
    )
  `
}

async function ensurePushSubscriptionsTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint        text PRIMARY KEY,
      user_id         text        NOT NULL,
      subscription    jsonb       NOT NULL,
      user_agent      text,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
    ON push_subscriptions (user_id)
  `
}

function sanitizePushSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return null
  const endpoint = String(subscription.endpoint || '').trim()
  const p256dh = String(subscription.keys?.p256dh || '').trim()
  const auth = String(subscription.keys?.auth || '').trim()
  if (!endpoint || !endpoint.startsWith('https://') || !p256dh || !auth) return null
  return {
    endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { p256dh, auth },
  }
}

function numericSteps(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

function mergeStepsIntoDay(day, steps) {
  const current = numericSteps(day?.steps)
  const incoming = numericSteps(steps)
  return { ...(day || {}), steps: Math.max(current, incoming) }
}


function sanitizeExercisePatch(body = {}, { deleting = false } = {}) {
  const date = String(body.date || '').trim()
  const exerciseId = String(body.exerciseId || body.id || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date' }
  if (!/^[a-z][a-z0-9_]*$/.test(exerciseId) && !/^custom_[a-zA-Z0-9_-]+$/.test(exerciseId)) return { error: 'Invalid exercise id' }
  const patch = { [exerciseId]: deleting ? null : Math.max(0, Number(body.reps) || 0) }
  const weightKey = `${exerciseId}Weight`
  if (Object.prototype.hasOwnProperty.call(body, 'weight')) {
    const weight = Number(body.weight)
    patch[weightKey] = deleting || !Number.isFinite(weight) || weight <= 0 ? null : weight
  }
  return { date, exerciseId, patch }
}

async function updateExerciseEntry(sql, userId, body, { deleting = false } = {}) {
  const parsed = sanitizeExercisePatch(body, { deleting })
  if (parsed.error) return { error: parsed.error }
  const existing = await getRow(sql, userId, parsed.date) ?? {}
  const merged = mergeDayData(existing, parsed.patch)
  await upsertRow(sql, userId, parsed.date, merged)
  return { ok: true, date: parsed.date, exerciseId: parsed.exerciseId, data: merged }
}

const ACTIVITY_METADATA = new Set(['date', 'steps', 'curlsWeight', 'squatsWeight', 'sleepBedAt', 'sleepWakeAt', 'sleepLog', 'entries', 'rest'])

function hasLoggedActivity(day) {
  if (!day) return false
  return Object.entries(day).some(([key, value]) => {
    if (ACTIVITY_METADATA.has(key)) return false
    if (key === 'meals') return Array.isArray(value) ? value.length > 0 : Number(value) > 0
    if (key === 'water') return Number(value) > 0
    return (typeof value === 'number' && value > 0) || (value?.reps > 0)
  })
}

async function upsertSteps(sql, userId, date, steps, source = 'training_log') {
  await ensureStepsTable(sql)
  const safeSteps = numericSteps(steps)
  await sql`
    INSERT INTO daily_steps (user_id, date, steps, source, updated_at)
    VALUES (${userId}, ${date}, ${safeSteps}, ${source}, now())
    ON CONFLICT (user_id, date)
    DO UPDATE SET steps = GREATEST(daily_steps.steps, ${safeSteps}), source = ${source}, updated_at = now()
  `
}

async function getRow(sql, userId, date) {
  const rows = await sql`
    SELECT data FROM training_logs WHERE user_id = ${userId} AND date = ${date}
  `
  return rows[0]?.data ?? null
}

async function upsertRow(sql, userId, date, data) {
  const d = JSON.stringify(data)
  await sql`
    INSERT INTO training_logs (user_id, date, data, updated_at)
    VALUES (${userId}, ${date}, ${d}::jsonb, now())
    ON CONFLICT (user_id, date)
    DO UPDATE SET data = ${d}::jsonb, updated_at = now()
  `
}

function fallbackAdvice(summary = {}) {
  const today = summary.today || {}
  const goals = summary.goals || {}
  const stats = summary.dashboardStats || {}
  const waterGoal = Number(goals.waterCups || 8)
  const stepGoal = Number(goals.steps || 10000)
  const advice = []

  const water = Number(today.water || 0)
  if (water < waterGoal) advice.push(`Nice job checking in today. Water is at ${water}/${waterGoal} cups — next easy win is ${Math.max(0, waterGoal - water).toFixed(1).replace(/\.0$/, '')} more cups.`)
  else advice.push('Hydration win — you hit your water goal. Keep it steady and listen to your body.')

  const steps = Number(today.steps || 0)
  if (steps < stepGoal) advice.push(`You are at ${steps.toLocaleString()}/${stepGoal.toLocaleString()} steps. Life happens — a short walk is the cleanest next move.`)
  else advice.push('Steps are handled today. That is a solid box checked — recovery or strength can be the focus now.')

  const sleep = Number(today.sleepHours || 0)
  if (sleep > 0 && sleep < 7) advice.push(`Sleep was ${sleep}h, so go easy on yourself. Keep training moderate and protect bedtime tonight.`)
  else if (sleep >= 7) advice.push(`${sleep}h sleep is a strong recovery base. If energy feels good, you have room to push a little.`)
  else advice.push('No sleep logged yet. Add bedtime and wake time when you can so I can read the recovery picture better.')

  if (Number(stats.weekSessions || 0) >= 5) advice.push('You have been putting in work this week. Consider an easy mobility or rest day soon — progress needs recovery too.')
  else advice.push('Small win target: pick one simple thing today — a walk, one set, or one clean meal — and stack momentum from there.')

  if (Array.isArray(summary.records) && summary.records.length > 0) advice.push(`PR board has ${summary.records.length} records — love that. Next step: choose one lift or movement and chase a tiny improvement.`)

  return advice.slice(0, 4)
}

const SIDEKICK_SYSTEM_PROMPT = `You are Sidekick, a sharp, encouraging personal training coach inside a workout and health tracking app. You have access to the user's real logged data: reps, sets, weight lifted, PRs, streak, weekly volume, sleep, steps, and water. Use that data directly — reference specific numbers, call out real progress, name actual exercises. You are not a generic wellness bot; you are a knowledgeable coach who knows this user's actual training history.

Tone: warm, direct, and motivating. Not preachy. Not clinical. The user is the athlete; you are the coach who sees what they cannot see in themselves.

Rules:
- Always ground your response in the actual data provided. Never give generic advice when you have real numbers to work with.
- Celebrate specific wins: a PR, a volume increase, a streak, hitting step or water goals.
- Flag real risks: volume spikes, poor sleep combined with heavy training, long gaps.
- Give one clear, specific next step — not "work out more," but "add 5 reps to your squat next session" or "hit 8 cups of water before your next workout."
- Keep responses to 3–4 short paragraphs max unless the user asks for detail.
- For JSON requests, return only valid JSON with no extra text.
- Never claim medical certainty. Use only the dashboard summary and conversation provided.`

function fallbackChatAnswer(question, summary = {}) {
  const q = String(question || '').trim()
  const base = fallbackAdvice(summary).slice(0, 2).join(' ')
  if (!q) return `${base} Ask me anything about today's training, food, water, sleep, or next steps.`
  return `${base} For “${q},” the simple next step is to pick the smallest action you can do today and log it when it is done.`
}

async function callAi(messages, { json = false } = {}) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
  if (anthropicKey) {
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')
    const payload = {
      model: process.env.ANTHROPIC_COACH_MODEL || process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: json ? Number(process.env.AI_RECOMMENDATION_MAX_TOKENS || 512) : 1024,
      temperature: 0.35,
      messages: chatMessages,
    }
    if (systemMsg) payload.system = systemMsg.content
    const response = await fetch(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`Anthropic coach request failed: ${response.status} ${errBody.slice(0, 300)}`)
    }
    const data = await response.json()
    return data?.content?.[0]?.text || ''
  }

  const openaiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY
  if (!openaiKey) return null
  const payload = {
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    temperature: 0.35,
    messages,
  }
  if (json) {
    payload.max_tokens = Number(process.env.AI_RECOMMENDATION_MAX_TOKENS || 512)
    payload.response_format = { type: 'json_object' }
  }
  const response = await fetch(process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`AI request failed: ${response.status}`)
  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}

function supplementPrompt(name) {
  return `List the 3 most important evidence-based benefits of "${name}". Return exactly 3 bullet points. Plain text only — no headers, no dosage, no warnings, no filler. Be specific.
Example format (for zinc):
• immune support
• wound healing
• testosterone regulation
Format:
• [benefit 1]
• [benefit 2]
• [benefit 3]`
}

const SUPPLEMENT_REFERENCE_INFO = [
  {
    names: ['b12', 'b 12', 'b-12', 'vitamin b12', 'vitamin b 12', 'vitamin b-12', 'cobalamin', 'methylcobalamin', 'cyanocobalamin'],
    info: `• energy metabolism from carbohydrates, fats, and proteins
• nerve function and myelin sheath maintenance
• red blood cell production and healthy DNA synthesis`,
  },
  {
    names: ['vitamin d', 'vitamin d3', 'd3', 'cholecalciferol'],
    info: `• calcium absorption and bone mineral support
• immune system signaling
• muscle function and healthy inflammatory response`,
  },
  {
    names: ['magnesium', 'magnesium glycinate', 'magnesium citrate', 'magnesium threonate'],
    info: `• muscle relaxation and normal nerve signaling
• energy production through ATP metabolism
• sleep quality support and healthy blood pressure regulation`,
  },
  {
    names: ['creatine', 'creatine monohydrate'],
    info: `• rapid ATP regeneration for high-intensity effort
• strength and power output support
• lean mass and training-volume support over time`,
  },
  {
    names: ['omega 3', 'omega-3', 'fish oil', 'epa', 'dha'],
    info: `• heart and triglyceride metabolism support
• brain and eye cell membrane support through DHA
• healthy inflammatory response from EPA and DHA`,
  },
  {
    names: ['zinc', 'zinc picolinate', 'zinc gluconate'],
    info: `• immune cell function
• wound healing and skin integrity
• testosterone and reproductive hormone support when zinc status is low`,
  },
]

function normalizeSupplementName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function fallbackSupplementInfo(name = '') {
  const normalized = normalizeSupplementName(name)
  const specific = SUPPLEMENT_REFERENCE_INFO.find(item => item.names.some(alias => normalizeSupplementName(alias) === normalized))
  if (specific) return specific.info
  return `• Supports general nutrition and wellness when taken consistently
• May enhance results when combined with good sleep, hydration, and training
• Works best as part of a balanced daily routine`
}

function normalizeSupplementInfo(text) {
  const clean = String(text || '').trim()
  if (!clean) return null
  const bullets = clean
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^(BENEFITS|TIMING|DOSAGE|USAGE)/i.test(l))
    .map(l => l.startsWith('•') ? l : `• ${l.replace(/^[-*\d+.]\s*/, '')}`)
    .filter(l => l.length > 3)
    .slice(0, 5)
  if (!bullets.length) return null
  return bullets.join('\n').slice(0, 500)
}

async function callAnthropicSupplementInfo(name) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY / CLAUDE_API_KEY not configured in environment')
  const response = await fetch(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      temperature: 0.25,
      messages: [{ role: 'user', content: supplementPrompt(name) }],
    }),
  })
  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Anthropic supplement request failed: ${response.status} ${errBody.slice(0, 300)}`)
  }
  const data = await response.json()
  return data?.content?.[0]?.text || ''
}

async function generateSupplementInfo(name) {
  const cleanName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (cleanName.length < 2) throw new Error('Missing supplement name')

  let lastError = null

  try {
    const anthropicText = await callAnthropicSupplementInfo(cleanName)
    const info = normalizeSupplementInfo(anthropicText)
    if (info) return { source: process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'anthropic', info }
  } catch (err) {
    lastError = err?.message || String(err)
    console.error('[supplement] Anthropic failed:', lastError)
  }

  try {
    const openAiText = await callAi([
      { role: 'system', content: 'You generate concise, evidence-based supplement benefit lists. Return plain text only.' },
      { role: 'user', content: supplementPrompt(cleanName) },
    ])
    if (!openAiText) throw new Error('OPENAI_API_KEY / AI_API_KEY not configured in environment')
    const info = normalizeSupplementInfo(openAiText)
    if (info) return { source: process.env.AI_MODEL || 'openai', info }
  } catch (err) {
    lastError = err?.message || String(err)
    console.error('[supplement] OpenAI failed:', lastError)
  }

  const fallbackInfo = fallbackSupplementInfo(cleanName)
  return {
    source: fallbackInfo === fallbackSupplementInfo() ? 'fallback' : 'reference',
    info: fallbackInfo,
    debug: lastError,
  }
}

async function generateAiAdvice(summary) {
  try {
    const text = await callAi([
      {
        role: 'system',
        content: `${SIDEKICK_SYSTEM_PROMPT} Return only JSON: {"recommendations":["..."]} with 3 to 4 short strings.`,
      },
      {
        role: 'user',
        content: JSON.stringify(summary).slice(0, 12000),
      },
    ], { json: true })
    if (!text) throw new Error('AI not configured')
    const parsed = JSON.parse(text)
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(v => String(v).trim()).filter(Boolean).slice(0, 4)
      : []
    if (!recommendations.length) throw new Error('AI returned no recommendations')
    const modelLabel = (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY)
      ? (process.env.ANTHROPIC_COACH_MODEL || process.env.ANTHROPIC_MODEL || 'claude')
      : (process.env.AI_MODEL || 'gpt-4o-mini')
    return { source: modelLabel, recommendations }
  } catch {
    return { source: 'rules', recommendations: fallbackAdvice(summary) }
  }
}

async function generateAiChat({ summary, question, messages }) {
  try {
    const cleanMessages = Array.isArray(messages)
      ? messages
          .filter(m => ['user', 'assistant'].includes(m?.role) && String(m?.content || '').trim())
          .slice(-12)
          .map(m => ({ role: m.role, content: String(m.content).slice(0, 6000) }))
      : []
    const text = await callAi([
      { role: 'system', content: SIDEKICK_SYSTEM_PROMPT },
      { role: 'user', content: `Dashboard summary JSON:\n${JSON.stringify(summary || {}).slice(0, 16000)}` },
      ...cleanMessages,
      { role: 'user', content: String(question || '').slice(0, 8000) },
    ])
    if (!text) throw new Error('AI not configured')
    const modelLabel = (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY)
      ? (process.env.ANTHROPIC_COACH_MODEL || process.env.ANTHROPIC_MODEL || 'claude')
      : (process.env.AI_MODEL || 'gpt-4o-mini')
    return { source: modelLabel, answer: text.trim() }
  } catch {
    return { source: 'rules', answer: fallbackChatAnswer(question, summary) }
  }
}


function roundMacro(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 10) / 10
}

function compactFoodName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

function nutrientFromUsda(food, names = []) {
  const label = food?.labelNutrients || {}
  const labelMap = {
    calories: label.calories?.value,
    protein: label.protein?.value,
    carbs: label.carbohydrates?.value,
    fat: label.fat?.value,
    fiber: label.fiber?.value,
  }
  for (const name of names) {
    if (labelMap[name] != null) return roundMacro(labelMap[name])
  }
  const wanted = names.map(n => n.toLowerCase())
  const item = (food?.foodNutrients || []).find(n => {
    const nutrientName = String(n.nutrientName || n.name || '').toLowerCase()
    return wanted.some(w => {
      if (w === 'calories') return /energy/.test(nutrientName)
      if (w === 'protein') return /protein/.test(nutrientName)
      if (w === 'carbs') return /carbohydrate/.test(nutrientName)
      if (w === 'fat') return /total lipid|\bfat\b/.test(nutrientName)
      if (w === 'fiber') return /fiber/.test(nutrientName)
      return false
    })
  })
  return roundMacro(item?.value || item?.amount || 0)
}

function foodResultFromUsda(food) {
  const calories = nutrientFromUsda(food, ['calories'])
  const protein = nutrientFromUsda(food, ['protein'])
  const carbs = nutrientFromUsda(food, ['carbs'])
  const fat = nutrientFromUsda(food, ['fat'])
  const fiber = nutrientFromUsda(food, ['fiber'])
  const serving = food.servingSize ? `${food.servingSize}${food.servingSizeUnit ? ` ${food.servingSizeUnit}` : ''}` : '100 g estimate'
  return {
    id: `usda-${food.fdcId}`,
    source: 'USDA',
    sourceId: String(food.fdcId || ''),
    name: compactFoodName(food.description || food.lowercaseDescription || 'USDA food'),
    brand: compactFoodName(food.brandOwner || food.brandName || food.dataType || ''),
    servingSize: serving,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    netCarbs: roundMacro(Math.max(0, carbs - fiber)),
  }
}

function foodResultFromOpenFoodFacts(product) {
  const n = product?.nutriments || {}
  const calories = roundMacro(n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0)
  const protein = roundMacro(n.proteins_serving ?? n.proteins_100g ?? n.proteins ?? 0)
  const carbs = roundMacro(n.carbohydrates_serving ?? n.carbohydrates_100g ?? n.carbohydrates ?? 0)
  const fat = roundMacro(n.fat_serving ?? n.fat_100g ?? n.fat ?? 0)
  const fiber = roundMacro(n.fiber_serving ?? n.fiber_100g ?? n.fiber ?? 0)
  return {
    id: `off-${product.code || crypto.randomUUID()}`,
    source: 'Open Food Facts',
    sourceId: String(product.code || ''),
    name: compactFoodName(product.product_name || product.generic_name || `Product ${product.code || ''}`),
    brand: compactFoodName(product.brands || ''),
    servingSize: product.serving_size || 'serving / 100 g',
    image: product.image_front_small_url || '',
    calories,
    protein,
    carbs,
    fat,
    fiber,
    netCarbs: roundMacro(Math.max(0, carbs - fiber)),
  }
}

async function searchNutritionDatabases(query) {
  const q = String(query || '').trim().slice(0, 100)
  if (q.length < 2) return []
  const results = []
  const seen = new Set()

  try {
    const key = process.env.USDA_API_KEY || 'DEMO_KEY'
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&pageSize=8&api_key=${encodeURIComponent(key)}`
    const response = await fetch(url)
    if (response.ok) {
      const data = await response.json()
      for (const food of data.foods || []) {
        const item = foodResultFromUsda(food)
        const sig = `${item.source}:${item.sourceId || item.name}`
        if (item.name && !seen.has(sig)) { seen.add(sig); results.push(item) }
      }
    }
  } catch {}

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,generic_name,brands,code,nutriments,serving_size,image_front_small_url`
    const response = await fetch(url, { headers: { 'User-Agent': 'TrainingLog/1.0' } })
    if (response.ok) {
      const data = await response.json()
      for (const product of data.products || []) {
        const item = foodResultFromOpenFoodFacts(product)
        const sig = `${item.source}:${item.sourceId || item.name}`
        if (item.name && !seen.has(sig)) { seen.add(sig); results.push(item) }
      }
    }
  } catch {}

  return results
    .filter(item => item.calories || item.protein || item.carbs || item.fat)
    .slice(0, 12)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!process.env.DATABASE_URL)     return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  await ensureTable(sql)

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const today = req.query?.date || new Date().toISOString().slice(0, 10)

    await ensureStepsTable(sql)

    const [todayRows, configRows, historyRows, stepRows] = await Promise.all([
      sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = ${today}`,
      sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = 'config'`,
      sql`SELECT date, data FROM training_logs WHERE user_id = ${userId} AND date != 'config' AND date != ${today} ORDER BY date DESC`,
      sql`SELECT date, steps FROM daily_steps WHERE user_id = ${userId}`,
    ])

    const stepsByDate = new Map(stepRows.map(r => [r.date, r.steps]))
    const todayData = mergeStepsIntoDay(todayRows[0]?.data ?? {}, stepsByDate.get(today))
    const history = historyRows
      .map(r => {
        const merged = mergeStepsIntoDay(r.data, stepsByDate.get(r.date))
        return { date: r.date, ...merged }
      })
      .filter(hasLoggedActivity)

    // Sync username to user_profiles so this user appears in partner search
    const cfg = configRows[0]?.data
    const configUsername = String(cfg?.partnerUsername || '').trim()
    // Username-auth users: their username is in the header even without an explicit config value
    const headerUsername = String(req.headers['x-username-auth'] || '').trim().toLowerCase()
    const username = configUsername || headerUsername
    if (username.length >= 3) {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS user_profiles (
            user_id     TEXT PRIMARY KEY,
            username    TEXT NOT NULL,
            share_token TEXT,
            updated_at  TIMESTAMPTZ DEFAULT now()
          )
        `
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_idx
          ON user_profiles (LOWER(username))
        `
        await sql`
          INSERT INTO user_profiles (user_id, username, share_token, updated_at)
          VALUES (${userId}, ${username}, ${cfg?.shareToken || null}, now())
          ON CONFLICT (user_id)
          DO UPDATE SET username = ${username}, share_token = ${cfg?.shareToken || null}, updated_at = now()
        `
      } catch {}
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.json({
      today:   todayData,
      config:  configRows[0]?.data ?? { customExercises: [], goals: {} },
      history,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    })
  }

  // ── PUT/DELETE: edit historical exercise totals without adding Vercel functions ─
  if (req.method === 'PUT' || req.method === 'DELETE') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
    }
    // Auth scope is enforced by getAuthenticatedUserId() above and by every
    // read/write in updateExerciseEntry using (user_id = userId, date). The
    // client never supplies a user id, so a guessed date/exercise id can only
    // mutate the authenticated user's own training_logs row.
    const result = await updateExerciseEntry(sql, userId, body, { deleting: req.method === 'DELETE' })
    if (result.error) return res.status(400).json({ error: result.error })
    return res.json(result)
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { return res.status(400).json({ error: 'Invalid JSON' }) }
    }

    const { action } = body || {}

    if (action === 'nutrition_search') {
      const query = String(body?.query || '').trim()
      if (query.length < 2) return res.status(400).json({ error: 'Missing search query' })
      const foods = await searchNutritionDatabases(query)
      return res.json({ ok: true, foods })
    }

    if (action === 'ai_advice') {
      const summary = body?.summary
      if (!summary || typeof summary !== 'object') return res.status(400).json({ error: 'Missing dashboard summary' })
      const result = await generateAiAdvice(summary)
      return res.json({ ok: true, ...result })
    }

    if (action === 'ai_chat') {
      const summary = body?.summary
      const question = String(body?.question || '').trim()
      if (!summary || typeof summary !== 'object') return res.status(400).json({ error: 'Missing dashboard summary' })
      if (!question) return res.status(400).json({ error: 'Missing question' })
      const result = await generateAiChat({ summary, question, messages: body?.messages })
      return res.json({ ok: true, ...result })
    }

    if (action === 'generate_supplement_info') {
      const name = String(body?.name || '').trim()
      if (name.length < 2) return res.status(400).json({ error: 'Missing supplement name' })
      const result = await generateSupplementInfo(name)
      return res.json({ ok: true, ...result })
    }

    if (action === 'save_day') {
      const { date, data } = body
      if (!date || !data) return res.status(400).json({ error: 'Missing date or data' })
      const existing = await getRow(sql, userId, date) ?? {}
      const merged   = mergeDayData(existing, data)
      await upsertRow(sql, userId, date, merged)
      if (data.steps != null) await upsertSteps(sql, userId, date, data.steps)
      return res.json({ ok: true, data: merged })
    }

    if (action === 'save_push_subscription') {
      const subscription = sanitizePushSubscription(body?.subscription)
      if (!subscription) return res.status(400).json({ error: 'Invalid push subscription' })
      await ensurePushSubscriptionsTable(sql)
      const subJson = JSON.stringify(subscription)
      const userAgent = String(req.headers['user-agent'] || '').slice(0, 500)
      await sql`
        INSERT INTO push_subscriptions (endpoint, user_id, subscription, user_agent, created_at, updated_at)
        VALUES (${subscription.endpoint}, ${userId}, ${subJson}::jsonb, ${userAgent}, now(), now())
        ON CONFLICT (endpoint)
        DO UPDATE SET user_id = ${userId}, subscription = ${subJson}::jsonb, user_agent = ${userAgent}, updated_at = now()
      `
      return res.json({ ok: true })
    }

    if (action === 'merge_exercise_data') {
      const fromIds = Array.isArray(body?.fromIds) ? body.fromIds.map(id => String(id || '').trim()).filter(Boolean) : []
      const toId = String(body?.toId || '').trim()
      if (!toId || fromIds.length === 0) return res.status(400).json({ error: 'Missing exercise ids' })
      if (!/^[a-z][a-z0-9_]*$/.test(toId) || fromIds.some(id => !/^custom_[a-zA-Z0-9_-]+$/.test(id))) {
        return res.status(400).json({ error: 'Invalid exercise ids' })
      }

      const rows = await sql`SELECT date, data FROM training_logs WHERE user_id = ${userId} AND date != 'config'`
      let migrated = 0
      for (const row of rows) {
        const existing = row.data || {}
        let changed = false
        let total = Number(existing[toId]?.reps ?? existing[toId] ?? 0)
        if (!Number.isFinite(total)) total = 0
        const next = { ...existing }
        for (const fromId of fromIds) {
          if (next[fromId] == null) continue
          const val = Number(next[fromId]?.reps ?? next[fromId] ?? 0)
          if (Number.isFinite(val)) total += val
          delete next[fromId]
          changed = true
        }
        if (changed) {
          next[toId] = total
          await upsertRow(sql, userId, row.date, next)
          migrated += 1
        }
      }
      return res.json({ ok: true, migrated })
    }

    if (action === 'save_config') {
      const { config } = body
      if (!config) return res.status(400).json({ error: 'Missing config' })
      await upsertRow(sql, userId, 'config', config)

      // Keep user_profiles in sync so they appear in search
      const username = String(config.partnerUsername || '').trim()
      if (username.length >= 3) {
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS user_profiles (
              user_id     TEXT PRIMARY KEY,
              username    TEXT NOT NULL,
              share_token TEXT,
              updated_at  TIMESTAMPTZ DEFAULT now()
            )
          `
          await sql`
            CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_idx
            ON user_profiles (LOWER(username))
          `
          await sql`
            INSERT INTO user_profiles (user_id, username, share_token, updated_at)
            VALUES (${userId}, ${username}, ${config.shareToken || null}, now())
            ON CONFLICT (user_id)
            DO UPDATE SET username = ${username}, share_token = ${config.shareToken || null}, updated_at = now()
          `
        } catch {
          // username collision — ignore, config still saved
        }
      }

      return res.json({ ok: true })
    }

    if (action === 'save_voice_token') {
      const existing = await getRow(sql, userId, 'config') ?? {}
      const newToken = crypto.randomUUID()
      await upsertRow(sql, userId, 'config', { ...existing, voiceToken: newToken })
      return res.json({ ok: true, voiceToken: newToken })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
