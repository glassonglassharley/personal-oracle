import { useState, useRef, useEffect } from 'react'
import { useT } from './LanguageContext.jsx'
import { BrowserMultiFormatReader } from '@zxing/browser'
import SupplementsSection from './SupplementsSection.jsx'

// ── Constants ──────────────────────────────────────────────────────────────────

const QUALITY_COLOR = { clean: '#22c55e', okay: '#f59e0b', cheat: '#ef4444' }
const QUALITY_BG    = { clean: 'rgba(34,197,94,0.12)', okay: 'rgba(245,158,11,0.12)', cheat: 'rgba(239,68,68,0.12)' }
const QUALITY_DOT   = { clean: '', okay: '', cheat: '' }
const AI_KEY        = import.meta.env.VITE_ANTHROPIC_API_KEY
const API           = import.meta.env.VITE_API_URL || ''
export const DEFAULT_NUTRITION_GOALS = { calories: 2000, protein: 150, carbs: 200, fat: 80, water: 8 }

// ── Public exports ─────────────────────────────────────────────────────────────

export function normalizeMeals(raw) {
  if (Array.isArray(raw)) return raw
  return []
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function detectEmoji(text) {
  const t = (text || '').toLowerCase()
  if (/chicken|turkey/.test(t))            return '🍗'
  if (/\begg/.test(t))                     return '🥚'
  if (/beef|steak|burger/.test(t))         return '🥩'
  if (/rice|grain/.test(t))               return '🍚'
  if (/salad|greens?|veget|veggi/.test(t)) return '🥗'
  if (/shake|protein|smoothie/.test(t))    return '🥛'
  if (/pizza/.test(t))                     return '🍕'
  if (/coffee|espresso|latte/.test(t))     return '☕'
  if (/fish|salmon|tuna|shrimp/.test(t))  return '🐟'
  if (/pasta|noodle|spaghetti/.test(t))   return '🍝'
  if (/fruit|banana|apple|berr/.test(t))  return '🍌'
  if (/sandwich|wrap|bread/.test(t))      return '🥪'
  if (/soup|broth/.test(t))               return '🍲'
  return '🍽️'
}

function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function yesterdayKey() {
  const d = new Date(); d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function makeMeal(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    text: '', at: nowTime(),
    calories: 0, protein: 0, carbs: 0, fat: 0,
    quality: null, emoji: '', photo: null,
    timestamp: Date.now(), source: 'manual', notes: '',
    components: null, quantity: 1,
    ...overrides,
  }
}

function parsePositiveNumber(value, fallback = 0) {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function scaledNutritionValue(value, quantity) {
  return Math.round((parsePositiveNumber(value, 0) * parsePositiveNumber(quantity, 1)) * 10) / 10
}

function quantityLabel(quantity) {
  const q = parsePositiveNumber(quantity, 1)
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')
}

function netCarbsValue(meal) {
  const carbs = Number(meal?.carbs || 0)
  const fiber = Number(meal?.fiber || 0)
  return Math.max(0, Math.round((carbs - fiber) * 10) / 10)
}

const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= 900

// ── Speech ─────────────────────────────────────────────────────────────────────

function useSpeech(onResult) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  function toggle() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported in this browser.'); return }
    if (listening) { recRef.current?.stop(); return }
    const rec = new SR()
    rec.lang = 'en-US'; rec.interimResults = false
    rec.onresult = e => { onResult(e.results[0][0].transcript); setListening(false) }
    rec.onerror = () => setListening(false)
    rec.onend   = () => setListening(false)
    recRef.current = rec; rec.start(); setListening(true)
  }
  return { listening, toggle }
}

// ── AI helpers ─────────────────────────────────────────────────────────────────

async function callClaude(body) {
  if (!AI_KEY) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': AI_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    // Use outermost { } to correctly handle nested objects/arrays
    const start = text.indexOf('{')
    const end   = text.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    return JSON.parse(text.slice(start, end + 1))
  } catch { return null }
  finally { clearTimeout(timeout) }
}

async function parseNutritionAI(text) {
  return callClaude({
    model: 'claude-haiku-4-5-20251001', max_tokens: 128,
    messages: [{ role: 'user', content: `Estimate nutrition for: "${text}". Reply ONLY with valid JSON: {"calories":0,"protein":0,"carbs":0,"fat":0}` }],
  })
}

async function parsePhotoMealAI(base64Jpeg) {
  return callClaude({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Jpeg } },
        {
          type: 'text',
          text: `You are a nutrition expert. Analyze this meal photo and provide a detailed breakdown. Reply with ONLY a JSON object, no markdown, no explanation outside the JSON:
{"meal_name":"short name for the whole meal","description":"1-2 sentence description of what you see","components":[{"name":"component name","portion":"estimated portion size","calories":0,"protein":0,"carbs":0,"fat":0}],"totals":{"calories":0,"protein":0,"carbs":0,"fat":0},"confidence":"high","confidence_note":"brief note about accuracy","emoji":"single emoji best representing this meal","quality":"clean"}`,
        },
      ],
    }],
  })
}

async function compressImage(file, maxDim = 800, quality = 0.7) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const r = maxDim / Math.max(width, height)
        width = Math.round(width * r); height = Math.round(height * r)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      const b64 = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      URL.revokeObjectURL(url); resolve(b64)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

// ── Barcode ────────────────────────────────────────────────────────────────────

async function lookupBarcode(barcode) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1) return null
    const p = data.product; const n = p.nutriments || {}
    return {
      text: p.product_name || `Product ${barcode}`,
      calories: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
      protein:  Math.round(n.proteins_100g  || n.proteins  || 0),
      carbs:    Math.round(n.carbohydrates_100g || n.carbohydrates || 0),
      fat:      Math.round(n.fat_100g || n.fat || 0),
    }
  } catch { return null }
}

// ── Clean Eating Streak ────────────────────────────────────────────────────────

function calcCleanStreak(history, todayMeals) {
  const byDate = {}
  for (const day of history) {
    const meals = normalizeMeals(day.meals)
    if (!meals.length) continue
    byDate[day.date] = !meals.some(m => m.quality && m.quality !== 'clean')
  }
  const today = todayKey()
  const norm = normalizeMeals(todayMeals)
  if (norm.length > 0) byDate[today] = !norm.some(m => m.quality && m.quality !== 'clean')
  let streak = 0
  for (const date of Object.keys(byDate).sort().reverse()) {
    if (byDate[date] === false) break
    if (byDate[date] === true) streak++
  }
  return streak
}

// ── Nutrition Rings ────────────────────────────────────────────────────────────

function NutritionRing({ value, goal, color, label, unit, size = 68 }) {
  const sw = 6, r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const pct  = goal > 0 ? Math.min(1, value / goal) : 0
  const done = pct >= 1
  const arc  = circ * pct
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ display: 'block' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={sw} />
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={done ? '#FFD700' : color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={`${arc} ${circ}`} strokeDashoffset={0}
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: done ? '#FFD700' : 'var(--text)' }}>
            {value > 999 ? `${(value/1000).toFixed(1)}k` : value}
          </span>
          <span style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 600 }}>{unit}</span>
        </div>
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</span>
    </div>
  )
}

function NutritionRings({ meals, water, nutritionGoals, onEditGoals }) {
  const totals = meals.reduce((a, m) => {
    a.calories += Number(m.calories || 0)
    a.protein  += Number(m.protein || 0)
    a.carbs    += Number(m.carbs || 0)
    a.fat      += Number(m.fat || 0)
    a.netCarbs += netCarbsValue(m)
    return a
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, netCarbs: 0 })
  const g = { ...DEFAULT_NUTRITION_GOALS, ...nutritionGoals }
  return (
    <div onClick={onEditGoals} style={{
      background: 'var(--surface)', border: '1.5px solid var(--border)',
      borderRadius: 16, padding: '14px 10px',
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', alignItems: 'center', gap: 4,
      cursor: 'pointer',
    }}>
      <NutritionRing value={Math.round(totals.calories)} goal={g.calories} color="#C8313E" label="Cal" unit="kcal" size={60} />
      <NutritionRing value={Math.round(totals.protein)}  goal={g.protein}  color="#2E7D4F" label="Protein" unit="g" size={60} />
      <NutritionRing value={Math.round(totals.netCarbs)} goal={g.carbs}    color="#f59e0b" label="Net Carb" unit="g" size={60} />
      <NutritionRing value={Math.round(totals.fat)}      goal={g.fat}      color="#7c3aed" label="Fat" unit="g" size={60} />
    </div>
  )
}

// ── Water Tracker ──────────────────────────────────────────────────────────────

function WaterTracker({ water, onWaterChange, waterGoal = 8 }) {
  const tl = useT()
  const total = Math.min(Math.max(waterGoal || 8, 4), 16)
  return (
    <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tl('water')}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{water || 0} / {total} {tl('glasses')}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
        {Array.from({ length: total }, (_, i) => {
          const filled = i < (water || 0)
          return (
            <button key={i} onClick={() => onWaterChange(water === i + 1 ? i : i + 1)} style={{
              flex: 1, height: 34, borderRadius: 8, fontSize: 16,
              background: filled ? 'rgba(43,93,168,0.15)' : 'var(--surface2)',
              border: `1.5px solid ${filled ? '#2B5DA8' : 'var(--border)'}`,
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {filled
                ? <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2B5DA8' }} />
                : <span style={{ color: 'var(--border)', fontSize: 14 }}>○</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Nutrition Goals Modal ──────────────────────────────────────────────────────

function NutritionGoalsModal({ goals, onSave, onClose }) {
  const tl = useT()
  const [g, setG] = useState({ ...DEFAULT_NUTRITION_GOALS, ...goals })
  const fields = [
    { key: 'calories', label: tl('calories'), unit: 'kcal' },
    { key: 'protein',  label: tl('protein'),  unit: 'g' },
    { key: 'carbs',    label: tl('carbs'),    unit: 'g' },
    { key: 'fat',      label: tl('fat'),      unit: 'g' },
    { key: 'water',    label: tl('water'),    unit: tl('glasses') },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: '20px', width: '88%', maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>{tl('daily_nutrition')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map(({ key, label, unit }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
              <input type="number" inputMode="numeric" value={g[key] || ''} onChange={e => setG(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                style={{ width: 80, textAlign: 'right', fontSize: 15, fontWeight: 700, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '6px 8px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              <span style={{ fontSize: 11, color: 'var(--muted)', width: 44 }}>{unit}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { onSave(g); onClose() }} style={{ marginTop: 16, width: '100%', background: 'var(--accent)', color: '#fff', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{tl('save_goals_btn')}</button>
      </div>
    </div>
  )
}

// ── Barcode Sheet ──────────────────────────────────────────────────────────────

function BarcodeSheet({ onResult, onClose }) {
  const tl = useT()
  const [code,     setCode]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [scanning, setScanning] = useState(false)
  const videoRef    = useRef(null)
  const streamRef   = useRef(null)
  const intervalRef = useRef(null)
  const hasDetector = typeof BarcodeDetector !== 'undefined'
  const desktop = isDesktop()

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    clearInterval(intervalRef.current)
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setScanning(true)
      const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39'] })
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            clearInterval(intervalRef.current)
            stream.getTracks().forEach(t => t.stop())
            setScanning(false)
            lookup(barcodes[0].rawValue)
          }
        } catch {}
      }, 300)
    } catch { setError(tl('camera_na')) }
  }

  async function lookup(barcode) {
    if (!barcode.trim()) return
    setLoading(true); setError('')
    const result = await lookupBarcode(barcode.trim())
    setLoading(false)
    if (!result) { setError(tl('product_nf')); return }
    onResult(result)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 120 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: desktop ? 20 : '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'center' }}>{tl('barcode_title')}</div>
        {hasDetector && (
          <button onClick={startCamera} disabled={scanning} style={{ background: scanning ? 'var(--surface2)' : 'var(--accent)', color: scanning ? 'var(--muted)' : '#fff', borderRadius: 12, padding: '11px', fontSize: 14, fontWeight: 700, border: 'none', cursor: scanning ? 'default' : 'pointer' }}>
            {scanning ? tl('scanning') : tl('use_camera')}
          </button>
        )}
        {scanning && <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 12, maxHeight: 180, objectFit: 'cover' }} />}
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" inputMode="numeric" placeholder={tl('enter_barcode')} value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup(code)}
            style={{ flex: 1, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', padding: '10px 12px', outline: 'none' }} />
          <button onClick={() => lookup(code)} disabled={!code.trim() || loading} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: (!code.trim() || loading) ? 0.5 : 1 }}>
            {loading ? '…' : tl('look_up')}
          </button>
        </div>
        {error && <span style={{ fontSize: 12, color: 'var(--error)', textAlign: 'center' }}>{error}</span>}
      </div>
    </div>
  )
}

// ── Photo Analyzing Overlay ────────────────────────────────────────────────────

function PhotoAnalyzingOverlay({ photoDataUrl }) {
  const tl = useT()
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <img src={photoDataUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(14px)', transform: 'scale(1.08)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)' }} />
      <div style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: 28, padding: '36px 44px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        maxWidth: 300, textAlign: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{tl('analyzing')}</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{tl('analyzing_sub')}</span>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.45)', animation: `mealDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Photo Results Screen ───────────────────────────────────────────────────────

function PhotoResultsScreen({ result, photoThumb, onLog, onEditDetails, onCancel }) {
  const [quality, setQuality] = useState(result.quality || null)
  const [notes,   setNotes]   = useState('')
  const isLowConf  = result.confidence === 'low'
  const isMedConf  = result.confidence === 'medium'
  const t          = result.totals || {}
  const components = result.components || []
  const desktop    = isDesktop()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: desktop ? 24 : '24px 24px 0 0',
        width: '100%', maxWidth: 520,
        maxHeight: desktop ? '90dvh' : '92dvh',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s ease',
      }}>

        {/* Photo thumbnail — full-width, rounded top */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {photoThumb
            ? <img src={`data:image/jpeg;base64,${photoThumb}`} alt="Your meal" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: desktop ? '22px 22px 0 0' : '22px 22px 0 0', display: 'block' }} />
            : <div style={{ height: 60, borderRadius: desktop ? '22px 22px 0 0' : '22px 22px 0 0', background: 'var(--surface2)' }} />
          }
          <button onClick={onCancel} style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '18px 20px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Meal name + description */}
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
              {result.meal_name || 'Meal'}
            </div>
            {result.description && (
              <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5, marginTop: 5 }}>{result.description}</div>
            )}
          </div>

          {/* Confidence banner */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: isLowConf ? 'rgba(245,158,11,0.08)' : isMedConf ? 'rgba(245,158,11,0.05)' : 'rgba(34,197,94,0.06)',
            border: `1px solid ${isLowConf || isMedConf ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.25)'}`,
            borderRadius: 10, padding: '8px 12px',
          }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{isLowConf || isMedConf ? '!' : '✓'}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              {isLowConf
                ? 'Hard to see clearly — estimates are rough. '
                : isMedConf
                ? 'Estimates may vary ±15% — adjust if needed. '
                : 'Clear photo — estimates should be accurate. '}
              {result.confidence_note}
            </span>
          </div>

          {/* Components breakdown */}
          {components.length > 0 && (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              {components.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: i < components.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </div>
                    {c.portion && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.portion}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                    {c.calories > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{c.calories} cal</span>}
                    {c.protein  > 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{c.protein}g pro</span>}
                  </div>
                </div>
              ))}
              {/* Totals bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px',
                background: 'var(--accent)',
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {t.calories > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t.calories} cal</span>}
                  {t.protein  > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{t.protein}g pro</span>}
                  {t.carbs    > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{t.carbs}g carbs</span>}
                  {t.fat      > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{t.fat}g fat</span>}
                </div>
              </div>
            </div>
          )}

          {/* Quality selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Quality</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['clean','okay','cheat'].map(q => {
                const active = quality === q
                return (
                  <button key={q} onClick={() => setQuality(quality === q ? null : q)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 20, fontSize: 13, fontWeight: 700,
                    border: `1.5px solid ${QUALITY_COLOR[q]}`,
                    background: active ? QUALITY_COLOR[q] : 'transparent',
                    color: active ? '#fff' : QUALITY_COLOR[q], cursor: 'pointer',
                  }}>
                    {QUALITY_DOT[q]} {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Add a note… (optional)"
            style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', padding: '10px 14px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => onLog({ result, quality, notes })} style={{
              width: '100%',
              background: isLowConf ? 'var(--surface2)' : 'var(--accent)',
              color: isLowConf ? 'var(--text)' : '#fff',
              border: isLowConf ? '1.5px solid var(--border)' : 'none',
              borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>
              ✓ Log This Meal
            </button>
            <button onClick={() => onEditDetails({ result, quality, notes })} style={{
              width: '100%', background: 'transparent',
              color: isLowConf ? 'var(--accent)' : 'var(--muted)',
              border: `1.5px solid ${isLowConf ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Edit Details
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Photo Error Screen ─────────────────────────────────────────────────────────

function PhotoErrorScreen({ onRetry, onLogManually, onCancel }) {
  const desktop = isDesktop()
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div style={{
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        borderRadius: desktop ? 24 : '24px 24px 0 0',
        width: '100%', maxWidth: 400,
        padding: '32px 24px 36px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        animation: 'slideUp 0.25s ease', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Couldn't analyze this photo</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>Try a photo with better lighting, or log this meal manually.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          <button onClick={onRetry} style={{ width: '100%', background: 'var(--accent)', color: '#fff', borderRadius: 14, padding: '13px', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}>Try Again</button>
          <button onClick={onLogManually} style={{ width: '100%', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Log Manually</button>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: '4px' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Meal Logger Sheet (secondary — manual entry) ───────────────────────────────

function MealLoggerSheet({ initial, onSave, onClose, favorites, onFavUpdate }) {
  const [meal,        setMeal]        = useState(() => initial ? { ...initial } : makeMeal())
  const [aiLoading,   setAiLoading]   = useState(false)
  const [aiError,     setAiError]     = useState('')
  const [showBarcode, setShowBarcode] = useState(false)
  const aiTimer  = useRef(null)
  const desktop  = isDesktop()
  const { listening, toggle: toggleMic } = useSpeech(transcript => {
    const next = meal.text ? meal.text + ' ' + transcript : transcript
    setMeal(m => ({ ...m, text: next, emoji: detectEmoji(next) }))
    triggerAI(next)
  })

  useEffect(() => () => clearTimeout(aiTimer.current), [])

  const favChips = (favorites || []).slice(0, 8)

  function setText(val) {
    setMeal(m => ({ ...m, text: val, emoji: detectEmoji(val) }))
    triggerAI(val)
  }

  function triggerAI(text) {
    if (!AI_KEY) return
    clearTimeout(aiTimer.current)
    if (!text.trim() || text.length < 4) return
    aiTimer.current = setTimeout(async () => {
      setAiLoading(true); setAiError('')
      const result = await parseNutritionAI(text)
      setAiLoading(false)
      if (result) animateNutrition(result)
    }, 800)
  }

  function animateNutrition(targets) {
    const keys = ['calories','protein','carbs','fat']
    const start = { calories: meal.calories||0, protein: meal.protein||0, carbs: meal.carbs||0, fat: meal.fat||0 }
    const t0 = Date.now()
    function tick() {
      const p = Math.min(1, (Date.now() - t0) / 600)
      const e = 1 - Math.pow(1 - p, 3)
      const partial = {}
      for (const k of keys) partial[k] = Math.round(start[k] + (targets[k] - start[k]) * e)
      setMeal(m => ({ ...m, ...partial, source: 'ai' }))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  function applyBarcode(product) {
    setMeal(m => ({ ...m, text: product.text, emoji: detectEmoji(product.text), calories: product.calories || m.calories, protein: product.protein || m.protein, carbs: product.carbs || m.carbs, fat: product.fat || m.fat, source: 'barcode' }))
    setShowBarcode(false)
  }

  function applyFavorite(fav) {
    setMeal(m => ({ ...m, text: fav.text, emoji: fav.emoji || detectEmoji(fav.text), calories: fav.calories, protein: fav.protein, carbs: fav.carbs, fat: fav.fat, quality: fav.quality || m.quality, source: 'favorite' }))
  }

  function setNum(field, raw) { setMeal(m => ({ ...m, [field]: parseInt(raw) || 0 })) }

  function handleSave() {
    if (!meal.text.trim()) return
    const saved = { ...meal, text: meal.text.trim() }
    onSave(saved)
    if (onFavUpdate) onFavUpdate(saved)
  }

  const canSave = meal.text.trim().length > 0
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }
  const isAI = meal.source === 'ai' || meal.source === 'photo'

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: desktop ? 'center' : 'flex-end', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.15s ease' }} onClick={onClose}>
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: desktop ? 20 : '20px 20px 0 0', width: '100%', maxWidth: 520, padding: '16px 20px 28px', display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideUp 0.22s ease', maxHeight: '92dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          {!desktop && <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto -4px', flexShrink: 0 }} />}
          <div style={{ fontSize: 17, fontWeight: 700, textAlign: 'center' }}>{initial ? 'Edit Meal' : 'Log Meal'}</div>

          {/* Favorites quick-chips */}
          {!initial && favChips.length > 0 && (
            <div>
              <div style={{ ...lbl, marginBottom: 6 }}>Quick Log</div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                {favChips.map(f => (
                  <button key={f.id} onClick={() => applyFavorite(f)} style={{ flexShrink: 0, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {f.text.split(' ').slice(0, 3).join(' ')}
                    {f.calories > 0 && <span style={{ color: 'var(--muted)', marginLeft: 4 }}>{f.calories}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text + mic */}
          <div>
            <div style={{ position: 'relative' }}>
              <textarea rows={3} autoFocus value={meal.text} onChange={e => setText(e.target.value)}
                placeholder="What did you eat? e.g. grilled chicken, rice and broccoli"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface2)', border: `1.5px solid ${listening ? '#ef4444' : aiLoading ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', padding: '10px 46px 10px 12px', resize: 'none', outline: 'none' }} />
              <button onClick={toggleMic} style={{ position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: '50%', background: listening ? 'rgba(239,68,68,0.15)' : 'var(--surface2)', border: `1.5px solid ${listening ? '#ef4444' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: listening ? '#ef4444' : 'var(--muted)', padding: 0, cursor: 'pointer' }}>
                {listening ? 'Stop' : 'Mic'}
              </button>
            </div>
            {aiLoading && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, fontWeight: 600 }}>Parsing nutrition…</div>}
            {aiError   && <div style={{ fontSize: 11, color: 'var(--error)',  marginTop: 4 }}>{aiError}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => setShowBarcode(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer' }}>Barcode</button>
            </div>
          </div>

          {/* Nutrition */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={lbl}>Nutrition (optional)</span>
              {isAI && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>AI filled</span>}
              {meal.source === 'barcode' && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>Barcode</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{f:'calories',l:'Cal'},{f:'protein',l:'Pro g'},{f:'carbs',l:'Carbs'},{f:'fat',l:'Fat g'}].map(({f,l}) => (
                <div key={f} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{l}</span>
                  <input type="number" inputMode="numeric" value={meal[f] || ''} onChange={e => setNum(f, e.target.value)} placeholder="0"
                    style={{ background: isAI ? 'rgba(59,38,15,0.08)' : 'var(--surface2)', border: `1.5px solid ${isAI ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, color: 'var(--text)', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', padding: '7px 4px', textAlign: 'center', width: '100%', boxSizing: 'border-box', outline: 'none' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={lbl}>Quality</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['clean','okay','cheat'].map(q => {
                const active = meal.quality === q
                return (
                  <button key={q} onClick={() => setMeal(m => ({ ...m, quality: m.quality === q ? null : q }))} style={{ flex: 1, padding: '9px 0', borderRadius: 20, fontSize: 13, fontWeight: 700, border: `1.5px solid ${QUALITY_COLOR[q]}`, background: active ? QUALITY_COLOR[q] : 'transparent', color: active ? '#fff' : QUALITY_COLOR[q], cursor: 'pointer' }}>
                    {QUALITY_DOT[q]} {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={lbl}>Notes (optional)</span>
            <input type="text" value={meal.notes || ''} onChange={e => setMeal(m => ({ ...m, notes: e.target.value }))} placeholder="e.g. post-workout, feeling full…"
              style={{ background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', padding: '9px 12px', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          </div>

          <button onClick={handleSave} disabled={!canSave} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 14, padding: '14px', fontSize: 16, fontWeight: 700, width: '100%', border: 'none', opacity: canSave ? 1 : 0.4, cursor: canSave ? 'pointer' : 'default' }}>
            {initial ? 'Update Meal' : 'Log Meal'}
          </button>
        </div>
      </div>
      {showBarcode && <BarcodeSheet onResult={applyBarcode} onClose={() => setShowBarcode(false)} />}
    </>
  )
}

// ── Gallery helpers ────────────────────────────────────────────────────────────

const CARD_GRADIENTS = [
  'linear-gradient(145deg,#0f0c29,#302b63)',
  'linear-gradient(145deg,#0a1628,#1e3a5f)',
  'linear-gradient(145deg,#0d1f12,#1a4028)',
  'linear-gradient(145deg,#1a0a20,#3d1a5c)',
  'linear-gradient(145deg,#1a1000,#3d2800)',
  'linear-gradient(145deg,#0a1a1a,#0d3333)',
  'linear-gradient(145deg,#1a0a10,#4a1020)',
]

function mealGradient(meal) {
  if (meal.quality === 'clean') return 'linear-gradient(145deg,#052e16,#14532d)'
  if (meal.quality === 'cheat') return 'linear-gradient(145deg,#450a0a,#7f1d1d)'
  if (meal.quality === 'okay')  return 'linear-gradient(145deg,#431407,#7c2d12)'
  const hash = [...(meal.text || meal.id || '')].reduce((a, c) => a + c.charCodeAt(0), 0)
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length]
}

// ── Macro Bar ──────────────────────────────────────────────────────────────────

function MacroBar({ label, value, max, color, unit }) {
  if (!value || value === 0) return null
  const pct = Math.min(1, value / max)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 64, fontSize: 12, fontWeight: 600, color: 'var(--muted)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(128,128,128,0.15)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`,
          background: color, borderRadius: 3,
          transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>
      <div style={{ width: 58, textAlign: 'right', fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', flexShrink: 0 }}>
        {value}<span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)', marginLeft: 1 }}>{unit}</span>
      </div>
    </div>
  )
}

// ── Gallery Card (Pinterest style) ────────────────────────────────────────────

function GalleryCard({ meal, onClick }) {
  const hasPhoto = !!(meal.photo && meal.source === 'photo')
  const qColor   = meal.quality ? QUALITY_COLOR[meal.quality] : null
  const calStr   = meal.calories > 0 ? `${meal.calories} cal` : null
  const proStr   = meal.protein  > 0 ? `${meal.protein}g P`  : null
  const netStr   = netCarbsValue(meal) > 0 ? `${netCarbsValue(meal)}g net` : null
  const qtyStr   = (meal.source === 'barcode' || meal.source === 'usda' || meal.source === 'openfoodfacts') && parsePositiveNumber(meal.quantity, 1) !== 1 ? `${quantityLabel(meal.quantity)}×` : null
  const badge    = [qtyStr, calStr, proStr, netStr].filter(Boolean).join(' · ')
  const comps    = meal.components || []

  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--surface)',
        border: qColor ? `1.5px solid ${qColor}55` : '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        transition: 'transform 0.15s ease',
      }}
      onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {/* Visual: photo at natural ratio, or fixed-height gradient */}
      <div style={{ position: 'relative' }}>
        {hasPhoto ? (
          <img
            src={`data:image/jpeg;base64,${meal.photo}`}
            alt={meal.text}
            style={{ width: '100%', display: 'block' }}
          />
        ) : (
          <div style={{
            height: 130,
            background: mealGradient(meal),
          }} />
        )}

        {/* Time badge */}
        <div style={{
          position: 'absolute', top: 7, left: 7,
          background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          borderRadius: 6, padding: '2px 6px',
        }}>
          <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>{meal.at}</span>
        </div>

        {/* Quality dot */}
        {meal.quality && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            width: 9, height: 9, borderRadius: '50%',
            background: QUALITY_COLOR[meal.quality],
            border: '1.5px solid rgba(0,0,0,0.25)',
          }} />
        )}

        {/* Ingredient count badge */}
        {comps.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 7, right: 7,
            background: 'rgba(59,38,15,0.88)',
            borderRadius: 6, padding: '2px 6px',
          }}>
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>{comps.length} items</span>
          </div>
        )}
      </div>

      {/* Info below the visual */}
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text)',
          lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {meal.text}
        </div>
        {badge && (
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 3 }}>{badge}</div>
        )}
        {meal.quality && (
          <div style={{
            display: 'inline-block', marginTop: 5,
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
            color: QUALITY_COLOR[meal.quality],
            background: QUALITY_BG[meal.quality],
            borderRadius: 4, padding: '2px 6px',
          }}>
            {meal.quality}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Meal Detail Sheet ──────────────────────────────────────────────────────────

function MealDetailSheet({ meal, onEdit, onDelete, onFavorite, isFavorite, onClose }) {
  const hasPhoto   = !!(meal.photo && meal.source === 'photo')
  const components = meal.components || []
  const hasMacros  = meal.calories > 0 || meal.protein > 0 || meal.carbs > 0 || meal.fat > 0 || meal.fiber > 0

  const sectionLabel = {
    fontSize: 10, fontWeight: 800, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: 10,
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', animation: 'fadeIn 0.2s ease' }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', borderRadius: '24px 24px 0 0',
          maxHeight: '92dvh', overflowY: 'auto',
          animation: 'slideUp 0.28s cubic-bezier(0.34,1.1,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Photo / gradient header */}
        <div style={{ position: 'relative', margin: '10px 16px 0', borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
          {hasPhoto ? (
            <img
              src={`data:image/jpeg;base64,${meal.photo}`}
              alt={meal.text}
              style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              height: 180,
              background: mealGradient(meal),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 80,
            }}>
            </div>
          )}

          {/* Gradient fade to surface at bottom */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(transparent, var(--surface))' }} />

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 10, right: 10,
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', border: 'none',
              color: '#fff', fontSize: 17, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        <div style={{ padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Name + meta */}
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                  {meal.text}
                </h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{meal.at}</span>
                  {meal.quality && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: QUALITY_COLOR[meal.quality],
                      background: QUALITY_BG[meal.quality],
                      border: `1px solid ${QUALITY_COLOR[meal.quality]}44`,
                      borderRadius: 20, padding: '2px 9px',
                    }}>
                      {QUALITY_DOT[meal.quality]} {meal.quality}
                    </span>
                  )}
                  {meal.source === 'photo' && (
                    <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-dim)', borderRadius: 6, padding: '2px 6px' }}>AI Analyzed</span>
                  )}
                  {meal.source === 'barcode' && (
                    <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.12)', borderRadius: 6, padding: '2px 6px' }}>
                      Barcode{parsePositiveNumber(meal.quantity, 1) !== 1 ? ` · ${quantityLabel(meal.quantity)}×` : ''}
                    </span>
                  )}
                  {(meal.source === 'usda' || meal.source === 'openfoodfacts') && (
                    <span style={{ fontSize: 10, color: meal.source === 'usda' ? '#22c55e' : '#f59e0b', fontWeight: 800, background: meal.source === 'usda' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.12)', borderRadius: 6, padding: '2px 6px' }}>
                      {meal.sourceLabel || (meal.source === 'usda' ? 'USDA' : 'Open Food Facts')}{parsePositiveNumber(meal.quantity, 1) !== 1 ? ` · ${quantityLabel(meal.quantity)}×` : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onFavorite(meal)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: isFavorite ? '#f59e0b' : 'var(--muted)', padding: '2px', flexShrink: 0 }}
              >
                {isFavorite ? '★' : '☆'}
              </button>
            </div>
            {meal.notes && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5 }}>{meal.notes}</p>
            )}
          </div>

          {/* Macro bars */}
          {hasMacros && (
            <div>
              <div style={sectionLabel}>Nutrition</div>
              <div style={{ background: 'var(--surface2)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                <MacroBar label="Calories" value={meal.calories} max={900}  color="#C8313E" unit="kcal" />
                <MacroBar label="Protein"  value={meal.protein}  max={80}   color="#22c55e" unit="g" />
                <MacroBar label="Net Carbs" value={netCarbsValue(meal)} max={80} color="#f59e0b" unit="g" />
                <MacroBar label="Carbs"    value={meal.carbs}    max={120}  color="#f59e0b" unit="g" />
                <MacroBar label="Fiber"    value={meal.fiber}    max={40}   color="#14b8a6" unit="g" />
                <MacroBar label="Fat"      value={meal.fat}      max={60}   color="#7c3aed" unit="g" />
              </div>
            </div>
          )}

          {/* Ingredients from AI */}
          {components.length > 0 && (
            <div>
              <div style={sectionLabel}>Ingredients · {components.length} items</div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {components.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: i < components.length - 1 ? '1px solid var(--border)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.03)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                      {c.portion && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{c.portion}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {c.calories > 0 && <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{c.calories} cal</div>}
                      {(c.protein > 0 || c.carbs > 0 || c.fat > 0) && (
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                          {[c.protein > 0 && `${c.protein}P`, c.carbs > 0 && `${c.carbs}C`, c.fat > 0 && `${c.fat}F`].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Totals row */}
                {(meal.calories > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--accent)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Total</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {meal.calories > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{meal.calories} cal</span>}
                      {meal.protein  > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{meal.protein}g P</span>}
                      {meal.carbs    > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{meal.carbs}g C</span>}
                      {meal.fat      > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{meal.fat}g F</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              onClick={() => { onEdit(meal); onClose() }}
              style={{
                flex: 1, padding: '13px', borderRadius: 14,
                border: '1.5px solid var(--border)', background: 'transparent',
                color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Edit
            </button>
            <button
              onClick={() => { onDelete(meal.id); onClose() }}
              style={{
                flex: 1, padding: '13px', borderRadius: 14,
                border: '1.5px solid rgba(239,68,68,0.35)', background: 'transparent',
                color: '#ef4444', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Favorites Section ──────────────────────────────────────────────────────────

function FavoritesSection({ favorites, onQuickLog }) {
  if (!favorites || favorites.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Favorites</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {favorites.map(f => (
          <button key={f.id} onClick={() => onQuickLog(f)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
            {f.text.split(' ').slice(0, 4).join(' ')}
            {f.calories > 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{f.calories}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Copy Yesterday Button ──────────────────────────────────────────────────────

function CopyYesterdayButton({ history, onCopy }) {
  const yk    = yesterdayKey()
  const yDay  = history.find(d => d.date === yk)
  const yMeals = normalizeMeals(yDay?.meals)
  if (!yMeals.length) return null
  return (
    <button onClick={() => onCopy(yMeals)} style={{ width: '100%', background: 'var(--surface2)', border: '1.5px dashed var(--border)', borderRadius: 14, padding: '12px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      ↩ Copy yesterday's {yMeals.length} meal{yMeals.length !== 1 ? 's' : ''}
    </button>
  )
}

// ── Barcode Scanner ────────────────────────────────────────────────────────────

async function fetchProductByBarcode(barcode) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,serving_size,nutriments`, { signal: controller.signal })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1) return null
    const p = data.product
    const n = p.nutriments || {}
    return {
      name: p.product_name || '',
      servingSize: p.serving_size || '',
      calories: Math.round(n['energy-kcal_serving'] || n['energy-kcal_100g'] || 0),
      protein:  Math.round(n['proteins_serving']     || n['proteins_100g']     || 0),
      carbs:    Math.round(n['carbohydrates_serving'] || n['carbohydrates_100g'] || 0),
      fat:      Math.round(n['fat_serving']           || n['fat_100g']           || 0),
    }
  } catch { return null }
  finally { clearTimeout(timeout) }
}

function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
      if (cancelled) return
      if (result) {
        cancelled = true
        try { reader.reset() } catch {}
        onResult(result.getText())
      }
    }).catch(() => {
      if (!cancelled) setError('Camera not available. Check permissions and try again.')
    })
    return () => {
      cancelled = true
      try { reader.reset() } catch {}
    }
  }, [onResult])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'rgba(0,0,0,0.7)', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        <span style={{ color: '#fff', fontSize: 17, fontWeight: 800 }}>Scan Barcode</span>
      </div>
      {error ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <span style={{ fontSize: 36 }}>📷</span>
          <span style={{ color: '#fff', fontSize: 15, textAlign: 'center' }}>{error}</span>
          <button onClick={onClose} style={{ padding: '12px 28px', background: '#3B260F', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Close</button>
        </div>
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay playsInline muted />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
            <div style={{ position: 'relative', width: 260, height: 160, border: '2px solid rgba(59,38,15,0.9)', borderRadius: 14, boxShadow: '0 0 0 2px rgba(59,38,15,0.3)' }}>
              <div style={{ position: 'absolute', top: -1, left: -1, width: 24, height: 24, borderTop: '3px solid #3B260F', borderLeft: '3px solid #3B260F', borderRadius: '10px 0 0 0' }} />
              <div style={{ position: 'absolute', top: -1, right: -1, width: 24, height: 24, borderTop: '3px solid #3B260F', borderRight: '3px solid #3B260F', borderRadius: '0 10px 0 0' }} />
              <div style={{ position: 'absolute', bottom: -1, left: -1, width: 24, height: 24, borderBottom: '3px solid #3B260F', borderLeft: '3px solid #3B260F', borderRadius: '0 0 0 10px' }} />
              <div style={{ position: 'absolute', bottom: -1, right: -1, width: 24, height: 24, borderBottom: '3px solid #3B260F', borderRight: '3px solid #3B260F', borderRadius: '0 0 10px 0' }} />
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600 }}>
            Point camera at barcode
          </div>
        </div>
      )}
    </div>
  )
}

function BarcodeScanConfirmSheet({ product, onAdd, onClose }) {
  const [text,     setText]     = useState(product.name || '')
  const [quantity, setQuantity] = useState('1')
  const [calories, setCalories] = useState(String(product.calories || ''))
  const [protein,  setProtein]  = useState(String(product.protein  || ''))
  const [carbs,    setCarbs]    = useState(String(product.carbs    || ''))
  const [fat,      setFat]      = useState(String(product.fat      || ''))

  const qty = parsePositiveNumber(quantity, 1)
  const scaled = {
    calories: scaledNutritionValue(calories, qty),
    protein:  scaledNutritionValue(protein, qty),
    carbs:    scaledNutritionValue(carbs, qty),
    fat:      scaledNutritionValue(fat, qty),
  }
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 15, boxSizing: 'border-box', outline: 'none' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', width: '100%', boxSizing: 'border-box', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          {product.name ? `📦 ${product.name.slice(0, 60)}` : '📦 Scanned Item'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, marginBottom: 14 }}>
          Metrics below are per serving{product.servingSize ? ` (${product.servingSize})` : ''}. Set how many pieces/servings you actually had.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</div>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Item name" style={inputStyle} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quantity consumed</div>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>{quantityLabel(qty)}×</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setQuantity(String(Math.max(0.25, Math.round((qty - 1) * 100) / 100)))} style={{ width: 40, height: 40, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>−</button>
              <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" min="0.25" step="0.25" inputMode="decimal" style={{ ...inputStyle, textAlign: 'center', fontWeight: 800 }} />
              <button onClick={() => setQuantity(String(Math.round((qty + 1) * 100) / 100))} style={{ width: 40, height: 40, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setQuantity(String(n))} style={{ flex: 1, padding: '7px 8px', borderRadius: 10, border: `1px solid ${qty === n ? 'var(--accent)' : 'var(--border)'}`, background: qty === n ? 'var(--accent-dim)' : 'var(--surface2)', color: qty === n ? 'var(--accent)' : 'var(--muted)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{n}×</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[["Calories", calories, setCalories], ["Protein (g)", protein, setProtein], ["Carbs (g)", carbs, setCarbs], ["Fat (g)", fat, setFat]].map(([label, val, setter]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                <input value={val} onChange={e => setter(e.target.value)} type="number" min="0" style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '11px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Total to log</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, color: 'var(--text)', fontSize: 13, fontWeight: 800 }}>
              <span>{scaled.calories} cal</span>
              <span>{scaled.protein}g protein</span>
              <span>{scaled.carbs}g carbs</span>
              <span>{scaled.fat}g fat</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => onAdd(makeMeal({
              text:     (text.trim() || 'Scanned item'),
              calories: scaled.calories,
              protein:  scaled.protein,
              carbs:    scaled.carbs,
              fat:      scaled.fat,
              quantity: qty,
              servingSize: product.servingSize || '',
              perServing: {
                calories: parsePositiveNumber(calories, 0),
                protein:  parsePositiveNumber(protein, 0),
                carbs:    parsePositiveNumber(carbs, 0),
                fat:      parsePositiveNumber(fat, 0),
              },
              emoji:    detectEmoji(text),
              source:   'barcode',
              notes:    qty !== 1 ? `${quantityLabel(qty)} servings consumed` : '',
            }))}
            style={{ flex: 2, padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #3B260F, #7c3aed)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
          >
            Add {quantityLabel(qty)}× to Log
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Free Food Database Search ───────────────────────────────────────────────────
function FoodSearchPanel({ authHeaders, onAdd }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])
  const [qtyById, setQtyById] = useState({})

  async function search() {
    const q = query.trim()
    if (q.length < 2) return
    setLoading(true); setError('')
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (authHeaders) Object.assign(headers, await authHeaders())
      const res = await fetch(`${API}/api/log`, {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'nutrition_search', query: q }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Food search failed')
      setResults(Array.isArray(data.foods) ? data.foods : [])
      if (!data.foods?.length) setError('No foods found. Try a simpler search like “eggs”, “rice”, or “chicken breast”.')
    } catch (e) {
      setError(e.message || 'Food search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function addFood(food) {
    const qty = parsePositiveNumber(qtyById[food.id], 1)
    onAdd(makeMeal({
      text: food.name,
      calories: scaledNutritionValue(food.calories, qty),
      protein:  scaledNutritionValue(food.protein, qty),
      carbs:    scaledNutritionValue(food.carbs, qty),
      fat:      scaledNutritionValue(food.fat, qty),
      fiber:    scaledNutritionValue(food.fiber, qty),
      netCarbs: scaledNutritionValue(food.netCarbs, qty),
      quantity: qty,
      servingSize: food.servingSize || '',
      source: food.source === 'Open Food Facts' ? 'openfoodfacts' : 'usda',
      sourceLabel: food.source,
      sourceId: food.sourceId || '',
      brand: food.brand || '',
      emoji: detectEmoji(food.name),
      notes: `${quantityLabel(qty)}× ${food.servingSize || 'serving'} · ${food.source}`,
    }))
  }

  const macroPill = (label, value, color) => value > 0 ? (
    <span style={{ fontSize: 11, fontWeight: 800, color, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 7px' }}>{value}{label}</span>
  ) : null

  return (
    <div style={{ background: 'linear-gradient(180deg, var(--surface), rgba(59,38,15,0.04))', border: '1.5px solid var(--border)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.25px' }}>Free Food Database</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45, marginTop: 2 }}>Search USDA + Open Food Facts. Free macro lookup for keto-style meal logging: calories, protein, fat, carbs, fiber, net carbs.</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search food: eggs, avocado, greek yogurt…" style={{ flex: 1, background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', padding: '11px 12px', outline: 'none', minWidth: 0 }} />
        <button onClick={search} disabled={loading || query.trim().length < 2} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '0 14px', fontSize: 13, fontWeight: 900, opacity: loading || query.trim().length < 2 ? 0.55 : 1, cursor: loading ? 'default' : 'pointer' }}>{loading ? '…' : 'Search'}</button>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--error)', lineHeight: 1.45 }}>{error}</div>}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(food => {
            const qty = parsePositiveNumber(qtyById[food.id], 1)
            return (
              <div key={food.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)', lineHeight: 1.25 }}>{food.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{[food.brand, food.servingSize, food.source].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 900, color: food.source === 'USDA' ? '#22c55e' : '#f59e0b', background: food.source === 'USDA' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', borderRadius: 999, padding: '4px 7px' }}>{food.source === 'USDA' ? 'USDA' : 'OFF'}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {macroPill(' cal', Math.round(food.calories || 0), '#C8313E')}
                  {macroPill('g P', Math.round(food.protein || 0), '#22c55e')}
                  {macroPill('g net', Math.round(food.netCarbs || 0), '#f59e0b')}
                  {macroPill('g fat', Math.round(food.fat || 0), '#7c3aed')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800 }}>Qty</span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[0.5, 1, 2].map(n => <button key={n} onClick={() => setQtyById(p => ({ ...p, [food.id]: String(n) }))} style={{ flex: 1, border: `1px solid ${qty === n ? 'var(--accent)' : 'var(--border)'}`, background: qty === n ? 'var(--accent-dim)' : 'var(--surface2)', color: qty === n ? 'var(--accent)' : 'var(--muted)', borderRadius: 9, padding: '7px 4px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>{n}×</button>)}
                  </div>
                  <button onClick={() => addFood(food)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 11px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>Add</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Meals Section ──────────────────────────────────────────────────────────────

export default function MealsSection({
  meals: rawMeals, water, onChange, onWaterChange,
  favorites, onFavoritesChange,
  nutritionGoals, onNutritionGoalsChange,
  history, authHeaders,
  supplements, onSupplementsChange,
}) {
  const meals = normalizeMeals(rawMeals)
  const [showLogger,  setShowLogger]  = useState(false)
  const [editingMeal, setEditingMeal] = useState(null)
  const [showGoals,   setShowGoals]   = useState(false)
  const [photoFlow,   setPhotoFlow]   = useState(null)
  const [detailMeal,  setDetailMeal]  = useState(null)
  const [showScanner, setShowScanner] = useState(false)
  const [scanProduct, setScanProduct] = useState(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState('')
  const cleanStreak  = calcCleanStreak(history || [], meals)
  const photoInputRef = useRef(null)

  // ── Photo flow ──────────────────────────────────────────────────────────────

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    // No AI key — skip analysis, open manual logger with photo pre-attached
    if (!AI_KEY) {
      const b64ForStorage = await compressImage(file, 400, 0.8)
      setEditingMeal(makeMeal({ photo: b64ForStorage || null, source: 'photo' }))
      return
    }

    const photoDataUrl = URL.createObjectURL(file)
    setPhotoFlow({ phase: 'analyzing', photoDataUrl })

    const [b64ForAI, b64ForStorage] = await Promise.all([
      compressImage(file, 1000, 0.75),
      compressImage(file, 400, 0.8),
    ])

    if (!b64ForAI) {
      setPhotoFlow({ phase: 'error', photoDataUrl })
      return
    }

    const result = await parsePhotoMealAI(b64ForAI)

    if (!result || !result.meal_name) {
      setPhotoFlow({ phase: 'error', photoDataUrl })
      return
    }

    setPhotoFlow({ phase: 'results', result, photoThumb: b64ForStorage, photoDataUrl })
  }

  function dismissPhotoFlow() {
    if (photoFlow?.photoDataUrl) URL.revokeObjectURL(photoFlow.photoDataUrl)
    setPhotoFlow(null)
  }

  function handleLogFromPhoto({ result, quality, notes }) {
    const meal = makeMeal({
      text:       result.meal_name,
      calories:   result.totals?.calories || 0,
      protein:    result.totals?.protein  || 0,
      carbs:      result.totals?.carbs    || 0,
      fat:        result.totals?.fat      || 0,
      emoji:      result.emoji || detectEmoji(result.meal_name || ''),
      quality:    quality || result.quality || null,
      notes:      notes || '',
      photo:      photoFlow?.photoThumb || null,
      source:     'photo',
      components: result.components || null,
    })
    if (photoFlow?.photoDataUrl) URL.revokeObjectURL(photoFlow.photoDataUrl)
    onChange([...meals, meal], { immediate: true })
    setPhotoFlow(null)
  }

  function handleEditDetailsFromPhoto({ result, quality, notes }) {
    const prefilled = makeMeal({
      text:       result.meal_name,
      calories:   result.totals?.calories || 0,
      protein:    result.totals?.protein  || 0,
      carbs:      result.totals?.carbs    || 0,
      fat:        result.totals?.fat      || 0,
      emoji:      result.emoji || detectEmoji(result.meal_name || ''),
      quality:    quality || result.quality || null,
      notes:      notes || '',
      photo:      photoFlow?.photoThumb || null,
      source:     'photo',
      components: result.components || null,
    })
    if (photoFlow?.photoDataUrl) URL.revokeObjectURL(photoFlow.photoDataUrl)
    setPhotoFlow(null)
    setEditingMeal(prefilled)
  }

  // ── Meal CRUD ───────────────────────────────────────────────────────────────

  function handleAdd(meal) {
    const immediate = ['barcode', 'photo', 'usda', 'openfoodfacts'].includes(meal?.source)
    onChange([...meals, meal], { immediate })
    setShowLogger(false)
  }
  function handleDelete(id)    { onChange(meals.filter(m => m.id !== id)) }

  function handleEditSave(saved) {
    const trimmed = { ...saved, text: saved.text.trim() }
    if (meals.some(m => m.id === trimmed.id)) {
      onChange(meals.map(m => m.id === trimmed.id ? trimmed : m), { immediate: ['barcode', 'photo', 'usda', 'openfoodfacts'].includes(trimmed.source) })
    } else {
      onChange([...meals, trimmed], { immediate: ['barcode', 'photo', 'usda', 'openfoodfacts'].includes(trimmed.source) })
    }
    handleFavUpdate(trimmed)
    setEditingMeal(null)
  }

  // ── Favorites ───────────────────────────────────────────────────────────────

  function handleFavUpdate(savedMeal) {
    if (!onFavoritesChange) return
    const existing = (favorites || []).find(f => f.text.toLowerCase() === savedMeal.text.toLowerCase())
    if (existing) {
      onFavoritesChange((favorites || []).map(f => f.id === existing.id ? { ...f, useCount: (f.useCount || 0) + 1, lastUsed: Date.now() } : f))
    } else {
      const allMeals = (history || []).flatMap(d => normalizeMeals(d.meals))
      const count = allMeals.filter(m => m.text?.toLowerCase() === savedMeal.text.toLowerCase()).length
      if (count >= 2) {
        onFavoritesChange([...(favorites || []), {
          id: crypto.randomUUID(), text: savedMeal.text,
          calories: savedMeal.calories || 0, protein: savedMeal.protein || 0,
          carbs: savedMeal.carbs || 0, fat: savedMeal.fat || 0,
          emoji: savedMeal.emoji || '', quality: savedMeal.quality || null,
          useCount: count + 1, lastUsed: Date.now(),
        }])
      }
    }
  }

  function toggleFavorite(meal) {
    if (!onFavoritesChange) return
    const existing = (favorites || []).find(f => f.text.toLowerCase() === meal.text.toLowerCase())
    if (existing) {
      onFavoritesChange((favorites || []).filter(f => f.id !== existing.id))
    } else {
      onFavoritesChange([...(favorites || []), {
        id: crypto.randomUUID(), text: meal.text,
        calories: meal.calories || 0, protein: meal.protein || 0,
        carbs: meal.carbs || 0, fat: meal.fat || 0,
        emoji: meal.emoji || '', quality: meal.quality || null,
        useCount: 1, lastUsed: Date.now(),
      }])
    }
  }

  function quickLogFavorite(fav) {
    onChange([...meals, makeMeal({
      text: fav.text, emoji: fav.emoji || detectEmoji(fav.text),
      calories: fav.calories, protein: fav.protein,
      carbs: fav.carbs, fat: fav.fat,
      quality: fav.quality, source: 'favorite',
    })])
    if (onFavoritesChange) {
      onFavoritesChange((favorites || []).map(f => f.id === fav.id ? { ...f, useCount: (f.useCount || 0) + 1, lastUsed: Date.now() } : f))
    }
  }

  async function handleBarcodeScan(barcode) {
    setShowScanner(false)
    setScanLoading(true)
    setScanError('')
    const product = await fetchProductByBarcode(barcode)
    setScanLoading(false)
    if (!product || !product.name) {
      setScanError('Barcode lookup failed or found no usable nutrition. Try scanning again or enter it manually.')
      return
    }
    setScanProduct(product)
  }

  function copyYesterday(yMeals) {
    onChange([...meals, ...yMeals.map(m => ({ ...m, id: crypto.randomUUID(), at: nowTime(), timestamp: Date.now(), source: 'copied' }))])
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0)
  const totalPro = meals.reduce((s, m) => s + (m.protein  || 0), 0)
  const totalNet = meals.reduce((s, m) => s + netCarbsValue(m), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Camera input — position: fixed off-screen so mobile .click() reliably triggers the camera */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
        onChange={handlePhotoSelect}
      />

      {/* ── Nutrition rings ── */}
      <NutritionRings meals={meals} water={water} nutritionGoals={nutritionGoals} onEditGoals={() => setShowGoals(true)} />

      {/* ── Gallery header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            Food Gallery
          </div>
          {meals.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              {meals.length} meal{meals.length !== 1 ? 's' : ''}
              {totalCal > 0 && ` · ${totalCal} cal`}
              {totalPro > 0 && ` · ${totalPro}g protein`}
              {totalNet > 0 && ` · ${Math.round(totalNet)}g net carbs`}
            </div>
          )}
        </div>
      </div>

      <FoodSearchPanel authHeaders={authHeaders} onAdd={handleAdd} />

      {/* ── Add action strip — primary: Snap Photo + Scan Barcode equal; secondary: Manual ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button
          onClick={() => photoInputRef.current?.click()}
          style={{
            background: 'linear-gradient(135deg, rgba(59,38,15,0.95), rgba(78,69,205,0.78))',
            border: '1.5px solid rgba(143,134,255,0.55)',
            borderRadius: 18, padding: '14px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: 'pointer', minHeight: 72,
            boxShadow: '0 14px 34px rgba(59,38,15,0.22)',
          }}
        >
          <span aria-hidden="true" style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 17,
          }}>📷</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '-0.2px' }}>Snap a Photo</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>
              {AI_KEY ? 'AI reads macros instantly' : 'Add photo + details'}
            </span>
          </div>
        </button>
        <button
          onClick={() => setShowScanner(true)}
          disabled={scanLoading}
          style={{
            background: 'linear-gradient(135deg, rgba(59,38,15,0.95), rgba(78,69,205,0.78))',
            border: '1.5px solid rgba(143,134,255,0.55)',
            borderRadius: 18, padding: '14px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            cursor: 'pointer', minHeight: 72,
            boxShadow: '0 14px 34px rgba(59,38,15,0.22)',
            opacity: scanLoading ? 0.65 : 1,
          }}
        >
          <span aria-hidden="true" style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 17,
          }}>📦</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '-0.2px' }}>
              {scanLoading ? 'Looking up…' : 'Scan Barcode'}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>Fastest food lookup</span>
          </div>
        </button>
      </div>
      <button
        onClick={() => setShowLogger(true)}
        style={{
          width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 14, padding: '11px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 15, opacity: 0.7, color: 'var(--text)' }}>✎</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Type it in manually</span>
      </button>

      {scanError && (
        <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.32)', borderRadius: 14, padding: 12, color: '#ef4444', fontSize: 13, lineHeight: 1.45, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>{scanError}</span>
          <button type="button" onClick={() => { setScanError(''); setShowScanner(true) }} style={{ minWidth: 44, minHeight: 44, border: 'none', borderRadius: 10, background: '#ef4444', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* ── Favorites quick-log ── */}
      {(favorites || []).length > 0 && <FavoritesSection favorites={favorites} onQuickLog={quickLogFavorite} />}

      {/* ── Gallery grid (Pinterest masonry) ── */}
      {meals.length > 0 ? (
        <div style={{ columns: 2, columnGap: 10 }}>
          {[...meals].reverse().map(meal => (
            <div key={meal.id} style={{ breakInside: 'avoid', marginBottom: 10 }}>
              <GalleryCard
                meal={meal}
                onClick={() => setDetailMeal(meal)}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <CopyYesterdayButton history={history || []} onCopy={copyYesterday} />
          {/* Empty state — placeholder gallery strip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
              {[
                { h: 90,  grad: 'linear-gradient(145deg,#0f0c29,#302b63)' },
                { h: 110, grad: 'linear-gradient(145deg,#052e16,#14532d)' },
                { h: 80,  grad: 'linear-gradient(145deg,#431407,#7c2d12)' },
                { h: 100, grad: 'linear-gradient(145deg,#0a1628,#1e3a5f)' },
              ].map((card, i) => (
                <div key={i} style={{ flexShrink: 0, width: 110, borderRadius: 14, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', opacity: 0.38 }}>
                  <div style={{ height: card.h, background: card.grad }} />
                  <div style={{ padding: '7px 9px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ height: 8, width: '68%', background: 'var(--border)', borderRadius: 4 }} />
                    <div style={{ height: 7, width: '42%', background: 'var(--border)', borderRadius: 4, opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', paddingTop: 2 }}>
              <div style={{ fontSize: 16, fontWeight: 850, color: 'var(--text)', letterSpacing: '-0.2px' }}>Your food story starts here</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.55 }}>
                Snap a photo or scan a barcode to fill your gallery
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showLogger   && <MealLoggerSheet onSave={handleAdd} onClose={() => setShowLogger(false)} favorites={favorites} onFavUpdate={handleFavUpdate} />}
      {editingMeal  && <MealLoggerSheet initial={editingMeal} onSave={handleEditSave} onClose={() => setEditingMeal(null)} favorites={favorites} onFavUpdate={null} />}
      {showGoals    && <NutritionGoalsModal goals={{ ...DEFAULT_NUTRITION_GOALS, ...nutritionGoals }} onSave={onNutritionGoalsChange} onClose={() => setShowGoals(false)} />}
      {showScanner  && <BarcodeScanner onResult={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
      {scanProduct  && <BarcodeScanConfirmSheet product={scanProduct} onAdd={meal => { onChange([...meals, meal], { immediate: true }); setScanProduct(null) }} onClose={() => setScanProduct(null)} />}

      {/* ── Detail sheet ── */}
      {detailMeal && (
        <MealDetailSheet
          meal={detailMeal}
          onEdit={m => { setDetailMeal(null); setEditingMeal(m) }}
          onDelete={id => { handleDelete(id); setDetailMeal(null) }}
          onFavorite={toggleFavorite}
          isFavorite={(favorites || []).some(f => f.text.toLowerCase() === detailMeal.text.toLowerCase())}
          onClose={() => setDetailMeal(null)}
        />
      )}

      {/* ── Photo flow overlays ── */}
      {photoFlow?.phase === 'analyzing' && (
        <PhotoAnalyzingOverlay photoDataUrl={photoFlow.photoDataUrl} />
      )}
      {photoFlow?.phase === 'results' && (
        <PhotoResultsScreen
          result={photoFlow.result}
          photoThumb={photoFlow.photoThumb}
          onLog={handleLogFromPhoto}
          onEditDetails={handleEditDetailsFromPhoto}
          onCancel={dismissPhotoFlow}
        />
      )}
      {photoFlow?.phase === 'error' && (
        <PhotoErrorScreen
          onRetry={() => { dismissPhotoFlow(); setTimeout(() => photoInputRef.current?.click(), 100) }}
          onLogManually={() => { dismissPhotoFlow(); setShowLogger(true) }}
          onCancel={dismissPhotoFlow}
        />
      )}

      {/* ── Supplements library ── */}
      <SupplementsSection
        supplements={supplements || []}
        onChange={onSupplementsChange || (() => {})}
        authHeaders={authHeaders}
      />
    </div>
  )
}
