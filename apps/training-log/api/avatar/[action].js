import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../../lib/serverAuth.js'

export const config = { maxDuration: 60 }

// ── shared helpers ────────────────────────────────────────────────────────────

function currentWeek() {
  const d = new Date()
  const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7)
  return `${temp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function dayReps(data) {
  if (!data) return 0
  let total = 0
  total += data.pushups || 0
  total += data.squats  || 0
  total += data.situps  || 0
  total += data.pullups || 0
  total += data.curls   || 0
  total += data.bench?.reps || 0
  const known = new Set(['pushups','squats','situps','pullups','curls','bench','steps','meals','date','water'])
  for (const [k, v] of Object.entries(data)) {
    if (!known.has(k)) {
      if (typeof v === 'number') total += v
      else if (v?.reps) total += v.reps
    }
  }
  return total
}

function computeStats(rows) {
  let totalVolume = 0
  const byDate = {}
  for (const r of rows) {
    const reps = dayReps(r.data)
    byDate[r.date] = reps
    totalVolume += reps
  }
  let streak = 0
  const cur = new Date()
  for (let i = 0; i < 365; i++) {
    const key = cur.toISOString().slice(0, 10)
    if ((byDate[key] || 0) > 0) { streak++; cur.setDate(cur.getDate() - 1) }
    else if (i > 0) break
    else cur.setDate(cur.getDate() - 1)
  }
  const tier =
    totalVolume < 1000  ? 'beginner'  :
    totalVolume < 5000  ? 'active'    :
    totalVolume < 20000 ? 'dedicated' :
    totalVolume < 75000 ? 'advanced'  : 'elite'
  return { totalVolume, streak, tier }
}

function buildPrompt(profile, stats) {
  const {
    gender = 'person',
    height_ft = 5, height_in = 10,
    weight = 170,
    body_fat,
    fitness_goal = 'build_muscle',
  } = profile
  const heightStr = `${height_ft}ft ${height_in > 0 ? height_in + 'in' : ''}`
  const goalMap = {
    build_muscle: 'goal of building muscle and adding size',
    lose_fat:     'goal of losing body fat and getting lean',
    maintain:     'goal of maintaining fitness and staying active',
  }
  const goalStr = goalMap[fitness_goal] || 'active fitness goal'
  const bfStr   = body_fat ? `, ${body_fat}% body fat` : ''
  const physique = {
    beginner:  'natural lean build, just beginning their fitness journey, limited muscle development',
    active:    'regularly active build, some visible muscle tone, building strength',
    dedicated: 'athletic build with visible muscle definition, dedicated consistent training evident',
    advanced:  'well-developed muscular physique, strong and conditioned, serious athlete',
    elite:     'exceptional physique, peak muscle development and conditioning, elite athlete level',
  }[stats.tier]
  const conditioned =
    stats.streak >= 30 ? ', peak conditioning from sustained unbroken training discipline' :
    stats.streak >= 14 ? ', strong conditioning from consistent daily training' :
    stats.streak >= 7  ? ', showing regular consistent training habits' : ''
  return `Realistic fitness portrait of a ${gender}, ${heightStr}, ${weight}lbs${bfStr}, ${physique}${conditioned}, ${goalStr}, neutral standing pose, plain dark background, professional studio lighting, high detail, photorealistic`
}

// ── route handlers ────────────────────────────────────────────────────────────

// POST /api/avatar/generate
async function handleGenerate(req, res, sql, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.HIGGSFIELD_API_KEY) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' })

  const [cfgRows, historyRows, weightRows] = await Promise.all([
    sql`SELECT data FROM training_logs WHERE user_id = ${userId} AND date = 'config'`,
    sql`SELECT date, data FROM training_logs WHERE user_id = ${userId} AND date != 'config' ORDER BY date DESC LIMIT 365`,
    sql`SELECT weight_lbs FROM body_weight WHERE user_id = ${userId} ORDER BY date DESC LIMIT 1`.catch(() => []),
  ])

  const profile = cfgRows[0]?.data?.profile || {}
  const { weight, height_ft, gender, fitness_goal } = profile
  if (!weight || !height_ft || !gender || !fitness_goal) {
    return res.status(400).json({ error: 'incomplete_profile' })
  }

  const trackedWeight   = weightRows[0]?.weight_lbs ? parseFloat(weightRows[0].weight_lbs) : null
  const effectiveProfile = trackedWeight ? { ...profile, weight: trackedWeight } : profile
  const stats  = computeStats(historyRows)
  const prompt = buildPrompt(effectiveProfile, stats)
  const week   = currentWeek()

  const higgsfieldRes = await fetch('https://api.higgsfield.ai/v1/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.HIGGSFIELD_API_KEY}` },
    body: JSON.stringify({ model: 'nano_banana_pro', prompt, aspect_ratio: '3:4' }),
  })

  if (!higgsfieldRes.ok) {
    const errText = await higgsfieldRes.text()
    if (higgsfieldRes.status === 402) return res.status(402).json({ error: 'credits_exhausted', detail: errText })
    return res.status(502).json({ error: `Higgsfield error ${higgsfieldRes.status}`, detail: errText })
  }

  const { image_url: imageUrl } = await higgsfieldRes.json()
  if (!imageUrl) return res.status(502).json({ error: 'Generation failed', detail: 'No image_url in response' })

  const savedStats = {
    weight: profile.weight, height_ft: profile.height_ft, height_in: profile.height_in,
    gender: profile.gender, fitness_goal: profile.fitness_goal, body_fat: profile.body_fat || null,
    totalVolume: stats.totalVolume, streak: stats.streak, tier: stats.tier,
  }

  await sql`
    INSERT INTO avatars (user_id, week, image_url, stats)
    VALUES (${userId}, ${week}, ${imageUrl}, ${JSON.stringify(savedStats)})
    ON CONFLICT (user_id, week)
    DO UPDATE SET image_url = ${imageUrl}, stats = ${JSON.stringify(savedStats)}, generated_at = now()
  `

  return res.json({ image_url: imageUrl, week, stats: savedStats })
}

// GET /api/avatar/history
async function handleHistory(req, res, sql, userId) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const rows = await sql`
    SELECT week, image_url, stats, generated_at
    FROM avatars WHERE user_id = ${userId} ORDER BY week ASC
  `
  return res.json(rows)
}

// ── main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql    = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const action = req.query.action

  try {
    if (action === 'generate') return await handleGenerate(req, res, sql, userId)
    if (action === 'history')  return await handleHistory(req, res, sql, userId)
    return res.status(404).json({ error: 'Not found' })
  } catch (err) {
    console.error(`[avatar/${action}] unhandled error:`, err?.message || err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
