import { put } from '@vercel/blob'
import { neon } from '@neondatabase/serverless'
import { getAuthenticatedUserId } from '../serverAuth.js'

const VALID_FLAGS = new Set(['low', 'normal', 'high', 'critical'])
const MAX_BASE64_CHARS = 6_000_000 // ~4.5MB decoded, stays under the platform request body limit

// ── Schema ─────────────────────────────────────────────────────────────────

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS lab_panels (
      id              BIGSERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL,
      uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      source_file_url TEXT,
      panel_date      TEXT NOT NULL,
      raw_ai_response JSONB
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS lab_markers (
      id                    BIGSERIAL PRIMARY KEY,
      panel_id              BIGINT NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
      marker_name           TEXT NOT NULL,
      value                 NUMERIC,
      unit                  TEXT,
      reference_range_low   NUMERIC,
      reference_range_high  NUMERIC,
      flag                  TEXT CHECK (flag IN ('low', 'normal', 'high', 'critical')),
      ai_note               TEXT
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS lab_panels_user_idx ON lab_panels (user_id, panel_date DESC)`
  await sql`CREATE INDEX IF NOT EXISTS lab_markers_panel_idx ON lab_markers (panel_id)`
  await sql`CREATE INDEX IF NOT EXISTS lab_markers_name_idx ON lab_markers (marker_name)`
}

// ── Claude extraction ──────────────────────────────────────────────────────

function labExtractionPrompt() {
  return `You are analyzing a lab results document (blood panel, urinalysis, etc). Extract every test/marker you can find.

For each marker, determine:
1. marker_name — the test name exactly as printed (e.g. "LDL Cholesterol")
2. value — the numeric result (number only, no units). If the result is qualitative (e.g. "Negative"), set value to null and put the result in ai_note instead.
3. unit — the unit of measurement (e.g. "mg/dL"), or null if not applicable
4. reference_range_low / reference_range_high — the numeric low/high bounds of the printed reference range, or null if not numeric or not present
5. flag — one of "low", "normal", "high", "critical" based on where the value falls relative to the reference range. Use "critical" only for values that are dangerously/severely outside range, not just slightly outside it.
6. ai_note — one short plain-language sentence explaining what this marker measures in general. Not medical advice, not specific to this result.

Return ONLY a JSON array of marker objects — no preamble, no markdown code fences, no explanation. Example:
[{"marker_name":"LDL Cholesterol","value":142,"unit":"mg/dL","reference_range_low":0,"reference_range_high":99,"flag":"high","ai_note":"LDL cholesterol is the 'bad' cholesterol that can build up in artery walls."}]`
}

async function callAnthropicLabExtraction({ base64, mimeType, isPdf }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY / CLAUDE_API_KEY not configured in environment')

  const model = process.env.ANTHROPIC_LABS_MODEL || process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-5'

  const response = await fetch(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: isPdf ? 'document' : 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: labExtractionPrompt() },
          ],
        },
        // Prefill forces the reply to open as a JSON array — no preamble to strip.
        { role: 'assistant', content: '[' },
      ],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`Anthropic lab extraction request failed: ${response.status} ${errBody.slice(0, 300)}`)
  }

  const data = await response.json()
  const text = data?.content?.[0]?.text || ''
  return { rawText: `[${text}`, model }
}

function normalizeFlag(flag, value, low, high) {
  const f = String(flag || '').toLowerCase().trim()
  if (VALID_FLAGS.has(f)) return f
  if (value != null && low != null && high != null) {
    if (value < low) return 'low'
    if (value > high) return 'high'
    return 'normal'
  }
  return 'normal'
}

function normalizeMarker(raw) {
  const marker_name = String(raw?.marker_name || '').trim().slice(0, 200)
  if (!marker_name) return null
  const value = raw?.value === null || raw?.value === undefined || raw?.value === '' ? null : Number(raw.value)
  const reference_range_low = raw?.reference_range_low === null || raw?.reference_range_low === undefined || raw?.reference_range_low === '' ? null : Number(raw.reference_range_low)
  const reference_range_high = raw?.reference_range_high === null || raw?.reference_range_high === undefined || raw?.reference_range_high === '' ? null : Number(raw.reference_range_high)
  return {
    marker_name,
    value: Number.isFinite(value) ? value : null,
    unit: raw?.unit ? String(raw.unit).trim().slice(0, 40) : null,
    reference_range_low: Number.isFinite(reference_range_low) ? reference_range_low : null,
    reference_range_high: Number.isFinite(reference_range_high) ? reference_range_high : null,
    flag: normalizeFlag(raw?.flag, Number.isFinite(value) ? value : null, Number.isFinite(reference_range_low) ? reference_range_low : null, Number.isFinite(reference_range_high) ? reference_range_high : null),
    ai_note: raw?.ai_note ? String(raw.ai_note).trim().slice(0, 500) : null,
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

function parseBody(req) {
  if (!req.body || typeof req.body !== 'string') return req.body || {}
  try { return JSON.parse(req.body) } catch { return {} }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Username-Auth, X-Username-Token')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' })

  const sql = neon(process.env.DATABASE_URL)
  const userId = await getAuthenticatedUserId(req, sql)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  await ensureTables(sql)

  const action = req.query.action
  const body = parseBody(req)

  // ── GET ?action=list ────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'list') {
    const panels = await sql`
      SELECT p.id, p.panel_date, p.uploaded_at, p.source_file_url,
        COUNT(m.id) FILTER (WHERE m.flag IN ('high', 'low', 'critical')) AS flagged_count,
        COUNT(m.id) FILTER (WHERE m.flag = 'normal') AS normal_count
      FROM lab_panels p
      LEFT JOIN lab_markers m ON m.panel_id = p.id
      WHERE p.user_id = ${userId}
      GROUP BY p.id
      ORDER BY p.panel_date DESC, p.uploaded_at DESC
    `
    return res.json({
      panels: panels.map(p => ({
        id: p.id,
        panel_date: p.panel_date,
        uploaded_at: p.uploaded_at,
        source_file_url: p.source_file_url,
        flagged_count: Number(p.flagged_count),
        normal_count: Number(p.normal_count),
      })),
    })
  }

  // ── GET ?action=get&id=... ──────────────────────────────────────────────
  if (req.method === 'GET' && action === 'get') {
    const id = Number(req.query.id)
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const panels = await sql`SELECT id, panel_date, uploaded_at, source_file_url FROM lab_panels WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
    const panel = panels[0]
    if (!panel) return res.status(404).json({ error: 'Not found' })
    const markers = await sql`SELECT * FROM lab_markers WHERE panel_id = ${id} ORDER BY marker_name ASC`
    return res.json({ panel, markers })
  }

  // ── POST ?action=upload ─────────────────────────────────────────────────
  // Body: { dataUrl: 'data:<mime>;base64,...', mimeType, panel_date }
  if (req.method === 'POST' && action === 'upload') {
    const { dataUrl, mimeType, panel_date = new Date().toISOString().slice(0, 10) } = body || {}
    if (!dataUrl || !mimeType) return res.status(400).json({ error: 'Missing dataUrl or mimeType' })

    const base64 = dataUrl.replace(/^data:[\w/+.-]+;base64,/, '')
    if (base64.length > MAX_BASE64_CHARS) return res.status(413).json({ error: 'File is too large' })

    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' })

    const isPdf = mimeType === 'application/pdf'
    const ext = isPdf ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg'
    const buffer = Buffer.from(base64, 'base64')
    const pathname = `labs/${userId}/${Date.now()}.${ext}`

    const blob = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: mimeType,
    })

    let rawText, model
    try {
      const result = await callAnthropicLabExtraction({ base64, mimeType, isPdf })
      rawText = result.rawText
      model = result.model
    } catch (err) {
      console.error('[labs] Anthropic extraction failed:', err?.message || err)
      return res.status(502).json({ error: 'Lab extraction failed', debug: err?.message || String(err) })
    }

    let parsed
    try {
      parsed = JSON.parse(rawText)
      if (!Array.isArray(parsed)) throw new Error('Response was not a JSON array')
    } catch (err) {
      console.error('[labs] Failed to parse AI response:', err?.message || err)
      return res.status(502).json({ error: 'Could not parse lab results from AI response', debug: rawText.slice(0, 500) })
    }

    const markers = parsed.map(normalizeMarker).filter(Boolean)

    const panelRows = await sql`
      INSERT INTO lab_panels (user_id, source_file_url, panel_date, raw_ai_response)
      VALUES (${userId}, ${blob.url}, ${panel_date}, ${JSON.stringify({ model, text: rawText })})
      RETURNING id, panel_date, uploaded_at, source_file_url
    `
    const panel = panelRows[0]

    const insertedMarkers = []
    for (const m of markers) {
      const rows = await sql`
        INSERT INTO lab_markers (panel_id, marker_name, value, unit, reference_range_low, reference_range_high, flag, ai_note)
        VALUES (${panel.id}, ${m.marker_name}, ${m.value}, ${m.unit}, ${m.reference_range_low}, ${m.reference_range_high}, ${m.flag}, ${m.ai_note})
        RETURNING *
      `
      insertedMarkers.push(rows[0])
    }

    return res.json({ panel, markers: insertedMarkers })
  }

  // ── POST ?action=update_marker ──────────────────────────────────────────
  if (req.method === 'POST' && action === 'update_marker') {
    const { marker_id, value, unit, reference_range_low, reference_range_high, flag } = body || {}
    const id = Number(marker_id)
    if (!id) return res.status(400).json({ error: 'Missing marker_id' })

    const owned = await sql`
      SELECT m.id FROM lab_markers m
      JOIN lab_panels p ON p.id = m.panel_id
      WHERE m.id = ${id} AND p.user_id = ${userId}
      LIMIT 1
    `
    if (!owned[0]) return res.status(404).json({ error: 'Not found' })

    const numValue = value === '' || value == null ? null : Number(value)
    const low = reference_range_low === '' || reference_range_low == null ? null : Number(reference_range_low)
    const high = reference_range_high === '' || reference_range_high == null ? null : Number(reference_range_high)
    const finalFlag = normalizeFlag(flag, Number.isFinite(numValue) ? numValue : null, Number.isFinite(low) ? low : null, Number.isFinite(high) ? high : null)

    const rows = await sql`
      UPDATE lab_markers SET
        value = ${Number.isFinite(numValue) ? numValue : null},
        unit = ${unit ? String(unit).trim().slice(0, 40) : null},
        reference_range_low = ${Number.isFinite(low) ? low : null},
        reference_range_high = ${Number.isFinite(high) ? high : null},
        flag = ${finalFlag}
      WHERE id = ${id}
      RETURNING *
    `
    return res.json({ marker: rows[0] })
  }

  // ── POST ?action=update_panel_date ──────────────────────────────────────
  if (req.method === 'POST' && action === 'update_panel_date') {
    const { panel_id, panel_date } = body || {}
    const id = Number(panel_id)
    if (!id || !panel_date) return res.status(400).json({ error: 'Missing panel_id or panel_date' })
    const rows = await sql`
      UPDATE lab_panels SET panel_date = ${panel_date}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id, panel_date
    `
    if (!rows[0]) return res.status(404).json({ error: 'Not found' })
    return res.json({ ok: true, panel_date: rows[0].panel_date })
  }

  // ── POST ?action=marker_history ─────────────────────────────────────────
  // Body: { names: string[] } — returns series only for markers with 2+ panels
  if (req.method === 'POST' && action === 'marker_history') {
    const names = Array.isArray(body?.names) ? [...new Set(body.names.filter(Boolean))].slice(0, 50) : []
    if (!names.length) return res.json({ history: {} })

    const rows = await sql`
      SELECT m.marker_name, m.value, m.unit, p.panel_date
      FROM lab_markers m
      JOIN lab_panels p ON p.id = m.panel_id
      WHERE p.user_id = ${userId} AND m.marker_name = ANY(${names}) AND m.value IS NOT NULL
      ORDER BY p.panel_date ASC
    `

    const grouped = {}
    for (const r of rows) {
      if (!grouped[r.marker_name]) grouped[r.marker_name] = []
      grouped[r.marker_name].push({ date: r.panel_date, value: parseFloat(r.value), unit: r.unit })
    }

    const history = {}
    for (const [name, points] of Object.entries(grouped)) {
      if (new Set(points.map(p => p.date)).size >= 2) history[name] = points
    }
    return res.json({ history })
  }

  return res.status(404).json({ error: `Unknown action: ${action}` })
}
