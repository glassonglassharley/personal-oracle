import { useState, useEffect, useRef, useMemo } from 'react'
import { useSignIn, useSignUp, useUser, useAuth } from '@clerk/clerk-react'
import { LanguageContext, useT } from './LanguageContext.jsx'
import T from './i18n.js'

import './App.css'
import Photos from './Photos.jsx'
import LabsView from './LabsView.jsx'

import MealsSection from './Meals.jsx'
import ExerciseDetail from './ExerciseDetail.jsx'
import Settings from './Settings.jsx'
import PartnerPage from './PartnerPage.jsx'
import AdminUsers from './AdminUsers.jsx'
import { mergeSavePatches } from './syncPatches.js'
import StepsCard from './StepsWidget.jsx'
import StepsHistory from './StepsHistory.jsx'
import SleepTracker from './SleepTracker.jsx'
import WaterRing from './WaterRing.jsx'
import WaterHistory from './WaterHistory.jsx'
import ProgressChart from './ProgressChart.jsx'
import DashboardAssistant from './DashboardAssistant.jsx'
import MeditationDetail from './MeditationDetail.jsx'
import BooksDetail from './BooksDetail.jsx'
import { detectPRs, calcAllTimeRecords, computeRecap } from './progressEngine.js'

const API = import.meta.env.VITE_API_URL || ''

// â"€â"€ Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const TODAY = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BUILTIN_PLATES = [
  { id: 'steps',    name: 'Steps',       color: '#6B7280', type: 'reps',  inc: [100, 1000] },
  { id: 'pushups',  name: 'Push-ups',    color: '#4A90D9', type: 'reps',  inc: [1, 10] },
  { id: 'squats',   name: 'Squats',      color: '#27AE60', type: 'reps',  inc: [1, 10] },
  { id: 'situps',   name: 'Sit-ups',     color: '#E8A020', type: 'reps',  inc: [1, 10] },
  { id: 'pullups',   name: 'Pull-ups',     color: '#C0392B', type: 'reps',  inc: [1, 5]  },
  { id: 'dips',      name: 'Dips',         color: '#10B981', type: 'reps',  inc: [1, 5]  },
  { id: 'dead_hang', name: 'Dead Hang',    color: '#0EA5E9', type: 'timed', inc: [5, 15] },
  { id: 'curls',     name: 'Dumbbell Curls', color: '#7B3FA0', type: 'reps',  inc: [1, 10] },
  { id: 'bench',     name: 'Bench Press',  color: '#C25E1A', type: 'reps',  inc: [1, 5] },
]

const MEALS_PLATE = { id: 'meals', name: 'Meals', color: '#14B8A6', type: 'reps', inc: [1, 1] }

const LIFESTYLE_PLATES = [
  { id: 'meditation', name: 'Meditation', color: '#38BDF8', type: 'timed' },
  { id: 'books',      name: 'Books',      color: '#8B5CF6', type: 'reps'  },
]

function tEx(def, t) {
  const k = 'ex_' + def.id
  const s = t(k)
  return s === k ? def.name : s
}

const PRESET_COLORS = ['#4A90D9', '#E8A020', '#C0392B', '#7B3FA0', '#C25E1A', '#14B8A6']

const DEFAULT_GOALS = {
  pushups: 50, squats: 50, situps: 50, pullups: 10,
  dips: 50, curls: 30, bench: 30, steps: 10000,
}

const DEFAULT_NUTRITION_GOALS = { calories: 2000, protein: 150, carbs: 200, fat: 80, water: 8 }

const DEFAULT_SHARING = {
  streak: true, daily: true,
  pushups: true, squats: true, situps: false, pullups: false,
  curls: false, bench: false, steps: false, meals: false, history: false,
}

const DEFAULT_REMINDER_SETTINGS = {
  enabled: false,
  workout: { enabled: true, time: '09:00' },
  meals: { enabled: false, time: '12:00' },
  water: { enabled: false, time: '15:00' },
  sleep: { enabled: false, time: '22:30' },
}

const BUILTIN_PLATE_IDS = new Set(BUILTIN_PLATES.map(p => p.id))
const BUILTIN_PLATE_NAME_TO_ID = new Map(BUILTIN_PLATES.map(p => [normalizeExerciseName(p.name), p.id]))

function normalizeExerciseName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function numericExerciseValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value && typeof value === 'object') {
    const reps = Number(value.reps)
    return Number.isFinite(reps) ? reps : 0
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function dedupeByOrder(ids = []) {
  const seen = new Set()
  const out = []
  for (const id of ids || []) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function findBuiltinDuplicateCustomExercises(customExercises = []) {
  const duplicates = []
  for (const ex of customExercises || []) {
    const builtinId = BUILTIN_PLATE_IDS.has(ex?.id)
      ? ex.id
      : BUILTIN_PLATE_NAME_TO_ID.get(normalizeExerciseName(ex?.name))
    if (builtinId) duplicates.push({ customId: ex.id, builtinId })
  }
  return duplicates.filter(d => d.customId && d.builtinId && d.customId !== d.builtinId)
}

function migrateLegacyRewards(rewards) {
  if (!Array.isArray(rewards) || rewards.length === 0) return rewards
  let changed = false
  const result = rewards.map(r => {
    if (r.milestoneId !== 'custom') return r
    const label = (r.customMilestone || r.milestoneLabel || '').trim()
    if (/10[,.]?000\s*total\s*reps/i.test(label))
      return (changed = true, { ...r, milestoneId: 'total_reps', goalTarget: 10000, done: false })
    if (/10\s*hours?\s*(of\s*)?meditation/i.test(label))
      return (changed = true, { ...r, milestoneId: 'meditation_hours', goalTarget: 10, done: false })
    if (/10\s*books?\s*completed/i.test(label))
      return (changed = true, { ...r, milestoneId: 'books_count', goalTarget: 10, done: false })
    if (/1[,.]?000\s*reps\s*(on\s*)?each/i.test(label))
      return (changed = true, { ...r, milestoneId: 'per_exercise', goalTarget: 1000, done: false })
    if (/walk\s*100\s*miles?/i.test(label))
      return (changed = true, { ...r, milestoneId: 'distance_miles', goalTarget: 100, goalConfig: { stepsPerMile: 2000 }, done: false })
    return r
  })
  return changed ? result : rewards
}

function removeBuiltinDuplicateCustomExercises(config = {}, today = {}) {
  const customExercises = Array.isArray(config.customExercises) ? config.customExercises : []
  const duplicates = findBuiltinDuplicateCustomExercises(customExercises)
  if (duplicates.length === 0) return { config, today, duplicates }

  const alias = new Map(duplicates.map(d => [d.customId, d.builtinId]))
  const nextConfig = {
    ...config,
    customExercises: customExercises.filter(ex => !alias.has(ex.id)),
  }

  nextConfig.plateOrder = dedupeByOrder((Array.isArray(config.plateOrder) ? config.plateOrder : [])
    .map(id => alias.get(id) || id))

  if (config.goals && typeof config.goals === 'object') {
    nextConfig.goals = { ...config.goals }
    for (const { customId, builtinId } of duplicates) {
      if (nextConfig.goals[builtinId] == null && nextConfig.goals[customId] != null) {
        nextConfig.goals[builtinId] = nextConfig.goals[customId]
      }
      delete nextConfig.goals[customId]
    }
  }

  if (config.plateSettings && typeof config.plateSettings === 'object') {
    nextConfig.plateSettings = { ...config.plateSettings }
    for (const { customId, builtinId } of duplicates) {
      if (!nextConfig.plateSettings[builtinId] && nextConfig.plateSettings[customId]) {
        nextConfig.plateSettings[builtinId] = nextConfig.plateSettings[customId]
      }
      delete nextConfig.plateSettings[customId]
    }
  }

  const nextToday = { ...(today || {}) }
  for (const { customId, builtinId } of duplicates) {
    if (nextToday[customId] == null) continue
    nextToday[builtinId] = numericExerciseValue(nextToday[builtinId]) + numericExerciseValue(nextToday[customId])
    delete nextToday[customId]
  }

  return { config: nextConfig, today: nextToday, duplicates }
}

function normalizeReminderSettings(settings = {}) {
  const merged = { ...DEFAULT_REMINDER_SETTINGS, ...settings }
  for (const key of ['workout', 'meals', 'water', 'sleep']) {
    merged[key] = { ...DEFAULT_REMINDER_SETTINGS[key], ...(settings?.[key] || {}) }
  }
  return merged
}

function getEffGoal(goals, id) {
  if (goals && goals[id] != null) return goals[id]
  if (id.startsWith('custom_')) return 20
  return DEFAULT_GOALS[id] || null
}

function defaultDayData() {
  return {
    pushups: 0, squats: 0, situps: 0, pullups: 0, dips: 0, dead_hang: 0,
    curls: 0, bench: 0, steps: 0, sleepHours: 0, sleepLog: [], meals: [], water: 0,
    meditation: 0, books: 0,
  }
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtSeconds(total) {
  const s = Math.max(0, Math.round(Number(total) || 0))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`
}


// â"€â"€ Theme â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('tl-theme') || 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tl-theme', theme)
  }, [theme])
  return [theme, () => setTheme(t => t === 'dark' ? 'light' : 'dark')]
}

function useLanguage() {
  const [language, setLanguage] = useState(() => localStorage.getItem('tl-lang') || 'en')
  useEffect(() => {
    document.documentElement.lang = language
    localStorage.setItem('tl-lang', language)
  }, [language])
  return [language, setLanguage]
}

function ReminderScheduler({ settings, dayData, nutritionGoals }) {
  useEffect(() => {
    const cfg = normalizeReminderSettings(settings)
    if (!cfg.enabled || typeof window === 'undefined' || !('Notification' in window)) return undefined
    if (Notification.permission !== 'granted') return undefined

    const timers = []
    const getDone = (key) => {
      if (key === 'workout') {
        return ['pushups', 'squats', 'situps', 'pullups', 'curls', 'dead_hang'].some(id => Number(dayData?.[id] || 0) > 0)
          || Number(dayData?.bench?.reps || 0) > 0
      }
      if (key === 'meals') return Array.isArray(dayData?.meals) && dayData.meals.length > 0
      if (key === 'water') return Number(dayData?.water || 0) >= Number(nutritionGoals?.water || 8)
      if (key === 'sleep') return Number(dayData?.sleepHours || 0) > 0 || (Array.isArray(dayData?.sleepLog) && dayData.sleepLog.length > 0)
      return false
    }
    const copy = {
      workout: ['Workout reminder', getDone('workout') ? 'Nice work today — open your log if you want to add more.' : 'Ready for a quick set? Log anything you do today.'],
      meals: ['Meal reminder', getDone('meals') ? 'Meals are started for today. Add anything else when you have a minute.' : 'Quick check-in: log your meal or snack while it is fresh.'],
      water: ['Hydration reminder', getDone('water') ? 'Hydration goal is looking good. Keep sipping.' : 'Tiny nudge: add a glass or bottle of water.'],
      sleep: ['Sleep reminder', getDone('sleep') ? 'Sleep is already logged. Wind down when you can.' : 'Wind-down time. When you head to bed, log it with the sleep shortcut.'],
    }

    function nextDelay(time) {
      const [hh = '9', mm = '0'] = String(time || '09:00').split(':')
      const now = new Date()
      const next = new Date(now)
      next.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0)
      if (next <= now) next.setDate(next.getDate() + 1)
      return Math.max(1000, next.getTime() - now.getTime())
    }

    function schedule(key) {
      if (!cfg[key]?.enabled || !cfg[key]?.time) return
      const id = window.setTimeout(() => {
        const [title, body] = copy[key]
        try {
          new Notification(title, {
            body,
            tag: `training-log-${key}`,
            icon: '/icon.svg',
            badge: '/icon.svg',
          })
        } catch {}
        schedule(key)
      }, nextDelay(cfg[key].time))
      timers.push(id)
    }

    for (const key of ['workout', 'meals', 'water', 'sleep']) schedule(key)
    return () => timers.forEach(id => window.clearTimeout(id))
  }, [settings, dayData, nutritionGoals])

  return null
}

// â"€â"€ Progress Ring â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ProgressRing({ value, goal, color }) {
  const S = 76, sw = 5
  const r = (S - sw) / 2
  const circ = 2 * Math.PI * r
  const pct  = goal > 0 ? Math.min(1, value / goal) : 0
  const done = pct >= 1

  return (
    <svg width={S} height={S} className="progress-ring">
      <circle cx={S/2} cy={S/2} r={r}
        fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={sw} />
      <circle cx={S/2} cy={S/2} r={r}
        fill="none"
        stroke={done ? '#4ade80' : color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${S/2} ${S/2})`}
        className={done ? 'ring-arc ring-done' : 'ring-arc'}
      />
    </svg>
  )
}

// â"€â"€ Demo seed data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const DEMO_TODAY = {
  pushups: 35, squats: 10, situps: 20, pullups: 7,
  curls: 25, bench: 12, steps: 6834, sleepHours: 7.5, sleepLog: [], meals: [], water: 6,
}

const DEMO_GOALS = {
  pushups: 50, squats: 50, situps: 50, pullups: 10, curls: 30, bench: 20, steps: 10000,
}

function makeDemoHistory() {
  const seed = [
    [40, 50, 35, 10, 30, 15, 9200],
    [25, 30,  0,  8, 20, 10, 7500],
    [50, 50, 50, 12, 30, 12, 11200],
    [ 0, 20, 15,  0,  0,  0, 4300],
    [30, 40, 30,  9, 25, 12, 8900],
    [45, 45, 40, 11, 28, 14, 10100],
    [20, 35, 25,  7, 15,  8, 6200],
  ]
  return seed.map((v, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (7 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    return { date: key, pushups: v[0], squats: v[1], situps: v[2], pullups: v[3], curls: v[4], bench: v[5], steps: v[6], sleepHours: [7, 6.5, 8, 5.5, 7.25, 8.25, 6.75][i], sleepLog: [], meals: [], water: [7, 5, 8, 4, 6, 9, 6][i] }
  })
}

// â"€â"€ Sign-In Screen â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const USERNAME_AUTH_KEY = 'tl-username-auth'

function AuthDivider({ label = 'OR' }) {
  return (
    <div className="auth-divider">
      <div />
      <span>{label}</span>
      <div />
    </div>
  )
}

function EmailCodeAuth({ onUsernameAuth, onDemo }) {
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn()
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp()
  const [mode, setMode] = useState('username') // username | signUp | code | password
  const [emailIntent, setEmailIntent] = useState('login') // 'login' | 'signup' when in email mode
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)
  const [codeDestination, setCodeDestination] = useState('')
  const [codeStrategy, setCodeStrategy] = useState('email_code')

  const ready = signInLoaded && signUpLoaded
  const isUsername = mode === 'username'
  const isUsernameSignup = mode === 'signUp'
  const isUsernameAccess = isUsername || isUsernameSignup
  const isEmailMode = mode === 'code' || mode === 'password'
  const isSignUp = isUsernameSignup || (isEmailMode && emailIntent === 'signup')
  const isPassword = mode === 'password'
  const isCode = mode === 'code'

  // Strip every non-digit so iOS autofill ("123 456") and copy-paste quirks
  // never send an invalid code to Clerk.
  function sanitizeCode(raw) {
    return raw.replace(/\D/g, '').slice(0, 6)
  }

  function clerkMsg(err) {
    const e = err?.errors?.[0]
    if (!e) return err?.message || null
    if (e.code === 'form_code_incorrect') return 'Incorrect code — double-check it and try again.'
    if (e.code === 'verification_expired') return 'This code has expired. Resend it and try again.'
    if (e.code === 'form_identifier_not_found') return 'No account found for that email or phone. Sign up instead.'
    if (e.code === 'form_password_incorrect') return 'That password did not work. Try again or use a code.'
    if (e.code === 'session_exists') return 'You\'re already signed in. Reload the page.'
    return e.longMessage || e.message || null
  }

  // Generate a username from an email address, unique enough to avoid collisions.
  function autoUsername(emailAddr) {
    const base = emailAddr.split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 12) || 'user'
    const suffix = Date.now().toString(36).slice(-5)
    return `${base}_${suffix}`
  }

  // Attempt to supply a username to the in-flight signUp object.
  // Retries once with a fully-random name if the first attempt is rejected.
  async function ensureUsername(emailAddr) {
    const name1 = autoUsername(emailAddr)
    try {
      return await signUp.update({ username: name1 })
    } catch {
      // First attempt rejected (e.g. taken). Try a pure-random fallback.
      const name2 = `user_${Date.now().toString(36)}`
      return await signUp.update({ username: name2 })
    }
  }

  function findCodeFactor(created) {
    return created.supportedFirstFactors?.find(f =>
      (f.strategy === 'email_code' && f.emailAddressId) ||
      (f.strategy === 'phone_code' && f.phoneNumberId)
    )
  }

  async function prepareCodeFactor(created) {
    const factor = findCodeFactor(created)
    if (!factor) throw new Error('Code sign-in is not enabled for that email or phone number yet.')
    setCodeDestination(factor.safeIdentifier || identifier.trim())
    setCodeStrategy(factor.strategy)
    if (factor.strategy === 'phone_code') {
      await signIn.prepareFirstFactor({ strategy: 'phone_code', phoneNumberId: factor.phoneNumberId })
    } else {
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId })
    }
  }

  async function startAuthFlow(e) {
    e.preventDefault()
    const value = identifier.trim()
    if (!ready || !value) return

    // Apple "Hide My Email" relay addresses can't reliably receive Clerk OTPs.
    if (isSignUp && value.toLowerCase().endsWith('@privaterelay.appleid.com')) {
      setError('Use your real email address instead of Apple Hide My Email.')
      return
    }

    setLoading(true)
    setError('')
    try {
      if (isSignUp) {
        await signUp.create({ emailAddress: value })

        // If Clerk requires a username, supply it NOW — before sending the OTP —
        // so attemptEmailAddressVerification can return 'complete' in one shot.
        const missingNow = signUp.missingFields || []
        if (missingNow.includes('username')) {
          await ensureUsername(value)
        }

        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
        setCodeDestination(value)
      } else if (isPassword) {
        if (!password) {
          setError('Enter your password.')
          return
        }
        const result = await signIn.create({ identifier: value, password })
        if (result.status === 'complete') {
          await setSignInActive({ session: result.createdSessionId })
          return
        }
        if (result.status === 'needs_second_factor') {
          throw new Error('Two-factor authentication is required for this account.')
        }
        throw new Error(`Password sign-in returned "${result.status}". Try a code instead.`)
      } else {
        const created = await signIn.create({ identifier: value })
        await prepareCodeFactor(created)
      }
      setPending(true)
      setResent(false)
    } catch (err) {
      setError(clerkMsg(err) || 'Could not continue. Check your info and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyEmailCode(e) {
    e.preventDefault()
    const digits = sanitizeCode(code)
    if (!ready || digits.length < 6) {
      setError('Enter the 6-digit code.')
      return
    }
    setLoading(true)
    setError('')
    try {
      if (isSignUp) {
        let result = await signUp.attemptEmailAddressVerification({ code: digits })

        // Fallback: username wasn't set during startAuthFlow (e.g. Clerk updated its
        // requirements, or missingFields wasn't populated before OTP send).
        if (result.status === 'missing_requirements') {
          const missing = result.missingFields || signUp.missingFields || []
          if (missing.includes('username')) {
            result = await ensureUsername(identifier.trim())
          }
        }

        if (result.status === 'complete') {
          await setSignUpActive({ session: result.createdSessionId })
        } else if (result.status === 'missing_requirements') {
          const still = (result.missingFields || []).join(', ') || 'unknown fields'
          throw new Error(`Sign-up still incomplete after auto-fill (missing: ${still}). Try again or contact support.`)
        } else {
          throw new Error(`Unexpected sign-up status "${result.status}". Try again.`)
        }
      } else {
        const result = await signIn.attemptFirstFactor({ strategy: codeStrategy, code: digits })
        if (result.status === 'complete') {
          await setSignInActive({ session: result.createdSessionId })
        } else if (result.status === 'needs_second_factor') {
          throw new Error('Two-factor authentication is required for this account.')
        } else {
          throw new Error(`Sign-in returned unexpected status "${result.status}". Try again.`)
        }
      }
    } catch (err) {
      setError(clerkMsg(err) || 'Verification failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    if (!ready || loading) return
    setLoading(true)
    setError('')
    try {
      if (isSignUp) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      } else {
        const created = await signIn.create({ identifier: identifier.trim() })
        await prepareCodeFactor(created)
      }
      setCode('')
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    } catch (err) {
      setError(clerkMsg(err) || 'Could not resend code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function reset(nextMode = mode, nextEmailIntent) {
    setMode(nextMode)
    if (nextEmailIntent !== undefined) setEmailIntent(nextEmailIntent)
    setPending(false)
    setCode('')
    setError('')
    setResent(false)
    setCodeDestination('')
    setCodeStrategy('email_code')
  }

  return (
    <section className="auth-card" aria-label="Sign in">
      <div className="auth-brand">
        <div className="auth-icon" aria-hidden="true"></div>
        <h1>Growth Mirror</h1>
        <p>Your daily training log.</p>
      </div>

      {!pending && (
        <div className="auth-intent-switch" aria-label="Choose sign up or login">
          <button
            type="button"
            className={isSignUp ? 'active' : ''}
            onClick={() => isEmailMode ? (setEmailIntent('signup'), setError('')) : reset('signUp')}
          >Sign up</button>
          <button
            type="button"
            className={isUsername || (isEmailMode && emailIntent === 'login') ? 'active' : ''}
            onClick={() => isEmailMode ? (setEmailIntent('login'), setError('')) : reset('username')}
          >Login</button>
        </div>
      )}

      {isUsernameAccess && !pending ? (
        <UsernameAuth onUsernameAuth={onUsernameAuth} intent={isUsernameSignup ? 'signup' : 'login'} />
      ) : (
        <form className="email-auth-form" onSubmit={pending ? verifyEmailCode : startAuthFlow}>
          {!pending ? (
            <>
              <p className="email-auth-help">
                {isSignUp ? 'Create an account with your email address.' : 'Enter your email to receive a sign-in code.'}
              </p>
              <input
                className="email-auth-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="email address"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
              />
              {isPassword && (
                <input
                  className="email-auth-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              )}
              <button className="email-auth-button" disabled={loading || !ready || !identifier.trim() || (isPassword && !password)}>
                {loading ? 'Sending…' : isPassword ? 'Sign in' : isSignUp ? 'Send sign-up code' : 'Send code'}
              </button>
            </>
          ) : (
            <>
              <p className="email-auth-help">Enter the 6-digit code sent to <strong>{codeDestination || identifier.trim()}</strong>.</p>
              <input
                className="email-auth-input email-auth-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={e => setCode(sanitizeCode(e.target.value))}
              />
              <button className="email-auth-button" disabled={loading || !ready || sanitizeCode(code).length < 6}>
                {loading ? 'Checking…' : isSignUp ? 'Create account' : 'Continue'}
              </button>
              <div className="auth-code-actions">
                <button type="button" className="auth-text-button" onClick={() => reset('username')} disabled={loading}>Use username</button>
                <button type="button" className="auth-text-button" onClick={resendCode} disabled={loading}>{resent ? 'Sent' : 'Resend code'}</button>
              </div>
            </>
          )}
          {error && <p className="email-auth-error">{error}</p>}
        </form>
      )}

      <AuthDivider label="or" />

      <div className="auth-secondary-actions">
        {isUsernameAccess ? (
          <button type="button" className="auth-text-button" onClick={() => reset('code', isUsernameSignup ? 'signup' : 'login')}>
            {isUsernameSignup ? 'Sign up with email instead' : 'Sign in with email instead'}
          </button>
        ) : (
          <button type="button" className="auth-text-button" onClick={() => reset(emailIntent === 'signup' ? 'signUp' : 'username')}>
            Use username instead
          </button>
        )}
        <button type="button" className="auth-text-button" onClick={onDemo}>Explore demo</button>
      </div>
    </section>
  )
}

function UsernameAuth({ onUsernameAuth, onCancel, intent: initialIntent = 'login', initialUsername = '' }) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(USERNAME_AUTH_KEY) || 'null') } catch { return null }
  })()
  const [intent, setIntent] = useState(initialIntent)
  const [username, setUsername] = useState(initialUsername || saved?.username || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isSignup = intent === 'signup'

  async function submitUsername(e) {
    e.preventDefault()
    setError('')

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (isSignup && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setLoading(true)
    try {
      const token = saved?.username === username.trim().toLowerCase() ? saved?.token : null
      const res = await fetch(`${API}/api/auth/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, token, password, createOnly: isSignup }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.error === 'already_exists') {
          setIntent('login')
          setPassword('')
          setConfirmPassword('')
          setError('You already have an account — enter your password to log in.')
          return
        }
        if (data.error === 'not_found') {
          setError('No account found for that username. Sign up to create one.')
          return
        }
        throw new Error(data.message || data.error || 'Could not sign in.')
      }

      const session = { username: data.username, token: data.token }
      localStorage.setItem(USERNAME_AUTH_KEY, JSON.stringify(session))
      onUsernameAuth(session)
    } catch (err) {
      setError(err.message || 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = username.trim().length >= 3 && password.length > 0 && (!isSignup || confirmPassword.length > 0)

  return (
    <form className="username-auth-inline" onSubmit={submitUsername}>
      <p className="email-auth-help">
        {isSignup ? 'Pick a username and password. No email required.' : 'Enter your username and password.'}
      </p>
      <input
        className="email-auth-input"
        type="text"
        autoComplete="username"
        placeholder="username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />
      <input
        className="email-auth-input"
        type="password"
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        placeholder="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {isSignup && (
        <input
          className="email-auth-input"
          type="password"
          autoComplete="new-password"
          placeholder="confirm password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
        />
      )}
      <button className="email-auth-button" disabled={loading || !canSubmit}>
        {loading ? (isSignup ? 'Creating…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
      </button>
      {onCancel && <button type="button" className="auth-text-button" onClick={onCancel}>Use email instead</button>}
      {error && <p className="email-auth-error">{error}</p>}
    </form>
  )
}

function SignInScreen({ onDemo, onUsernameAuth }) {
  return (
    <div className="auth-screen">
      <div className="auth-shell">
        <EmailCodeAuth onUsernameAuth={onUsernameAuth} onDemo={onDemo} />
      </div>
    </div>
  )
}


// â"€â"€ Goal Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function GoalModal({ def, currentGoal, currentSettings, onSave, onClose }) {
  const t = useT()
  const isWeighted = false
  const isTimed = def.type === 'timed'
  const [goal, setGoal] = useState(
    currentGoal != null ? String(isTimed ? Math.round(currentGoal / 60) : currentGoal) : ''
  )

  const defInc   = def.inc       || [1, 10]

  const [incSmall, setIncSmall] = useState(String(currentSettings?.inc?.[0]       ?? defInc[0]))
  const [incBig,   setIncBig]   = useState(String(currentSettings?.inc?.[1]       ?? defInc[1]))

  const row   = { display: 'flex', gap: 10 }
  const field = { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }
  const fl    = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }

  function handleSave() {
    const g = parseInt(goal)
    const stored = isTimed ? g * 60 : g
    const settings = { inc: [Math.max(1, parseInt(incSmall) || defInc[0]), Math.max(1, parseInt(incBig) || defInc[1])] }
    onSave(g > 0 ? stored : null, settings)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tEx(def, t)}</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          <label className="modal-label">{isTimed ? 'Daily goal (minutes)' : t('goal_daily')}</label>
          <input type="number" inputMode="numeric" value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder={isTimed ? 'e.g. 2 — blank to remove' : 'e.g. 50 — blank to remove'}
            autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />

          <>
            <label className="modal-label" style={{ marginTop: 16 }}>{t('btn_inc')}</label>
            <div style={row}>
              <div style={field}><span style={fl}>{t('inc_small')}</span>
                <input type="number" inputMode="numeric" value={incSmall}
                  onChange={e => setIncSmall(e.target.value)} placeholder="1" />
              </div>
              <div style={field}><span style={fl}>{t('inc_large')}</span>
                <input type="number" inputMode="numeric" value={incBig}
                  onChange={e => setIncBig(e.target.value)} placeholder="10" />
              </div>
            </div>
          </>
        </div>
        <button className="btn-primary" onClick={handleSave}>{t('save')}</button>
      </div>
    </div>
  )
}

// â"€â"€ Add Exercise Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function AddExerciseModal({ onSave, onClose }) {
  const t = useT()
  const [name, setName] = useState('')
  const [type, setType] = useState('reps')
  const [color, setColor] = useState(PRESET_COLORS[0])

  function handleSave() {
    if (!name.trim()) return
    onSave({ id: 'custom_' + Date.now(), name: name.trim(), type, color,
      inc: type === 'timed' ? [5, 15] : [1, 10] })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('new_exercise')}</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body">
          <label className="modal-label">{t('ex_name')}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Dips" autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()} />
          <label className="modal-label" style={{ marginTop: 16 }}>{t('ex_type')}</label>
          <div className="type-toggle">
            <button className={type === 'reps' ? 'active' : ''} onClick={() => setType('reps')}>{t('type_reps')}</button>
            <button className={type === 'timed' ? 'active' : ''} onClick={() => setType('timed')}>{t('type_timed')}</button>
          </div>
          <label className="modal-label" style={{ marginTop: 16 }}>{t('ex_color')}</label>
          <div className="color-picker">
            {PRESET_COLORS.map(c => (
              <button key={c} className={`color-swatch ${color === c ? 'selected' : ''}`}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
          {t('save_exercise')}
        </button>
      </div>
    </div>
  )
}

// â"€â"€ Exercise Plate â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ExercisePlate({ def, value, onChange, onDelete, editMode, goal, onSetGoal, onDetail }) {
  const t = useT()
  const { color, type } = def
  const name = tEx(def, t)
  const isCustom = !BUILTIN_PLATES.find(b => b.id === def.id)
  const [editField, setEditField] = useState(null)
  const [editVal,   setEditVal]   = useState('')
  const lastTapRef = useRef({ key: '', at: 0 })

  function guardedChange(nextValue, actionKey) {
    const now = performance.now()
    const last = lastTapRef.current
    if (last.key === actionKey && now - last.at < 650) return
    lastTapRef.current = { key: actionKey, at: now }
    onChange(nextValue)
  }

  function startEdit(field, current) {
    setEditVal(String(current))
    setEditField(field)
  }

  function commitEdit(field) {
    const n = parseInt(editVal)
    if (!isNaN(n) && n >= 0) {
      onChange(n)
    }
    setEditField(null)
  }

  function onKey(e, field) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(field) }
    if (e.key === 'Escape') setEditField(null)
  }

  const inlineInput = (fontSize, width) => ({
    background: 'var(--surface2)', border: '1.5px solid var(--accent)',
    borderRadius: 8, color: 'var(--text)', fontSize, fontWeight: 800,
    fontFamily: 'inherit', textAlign: 'center', width, padding: '3px 4px',
    outline: 'none', letterSpacing: '-0.5px', boxSizing: 'border-box',
  })

  const tapStyle = {
    cursor: 'pointer',
    borderBottom: '2px dotted rgba(128,128,128,0.5)',
    paddingBottom: 1,
  }


  const count = typeof value === 'number' ? value : 0
  const done  = goal > 0 && count >= goal
  const hasRing = goal > 0
  const isTimed = type === 'timed'
  const countDisplay = isTimed ? fmtSeconds(count) : count.toLocaleString()

  return (
    <div className={`plate ${done ? 'plate-done' : ''}`} style={{ '--pc': color, cursor: onDetail ? 'pointer' : 'default' }} onClick={() => onDetail && onDetail(def)}>
      {editMode && isCustom && onDelete && (
        <button className="plate-delete" onClick={e => { e.stopPropagation(); onDelete() }}>x</button>
      )}
      <div className="plate-top-row">
        <div className="plate-name">
          {name}
        </div>
        {onSetGoal && <button className="plate-gear" onClick={e => { e.stopPropagation(); onSetGoal() }}>⚙</button>}
      </div>

      {hasRing ? (
        <div className={`plate-ring-wrap ${done ? 'ring-wrap-done' : ''}`}>
          <ProgressRing value={count} goal={goal} color={color} />
          {editField === 'val' ? (
            <input type="number" inputMode="numeric" autoFocus value={editVal}
              style={{ ...inlineInput(15, 58), position: 'absolute' }}
              onChange={e => setEditVal(e.target.value)} onBlur={() => commitEdit('val')}
              onKeyDown={e => onKey(e, 'val')} onFocus={e => e.target.select()} onClick={e => e.stopPropagation()} />
          ) : (
            <div className={`plate-ring-num ${done ? 'val-done' : ''}`}
              onClick={e => { e.stopPropagation(); startEdit('val', count) }} style={{ cursor: 'pointer' }}>
              {done && <span className="ring-check">✓</span>}
              <span style={{ borderBottom: '1.5px dotted rgba(128,128,128,0.4)', display: 'inline-block', paddingBottom: 1 }}>
                {countDisplay}
              </span>
            </div>
          )}
        </div>
      ) : (
        editField === 'val' ? (
          <input type="number" inputMode="numeric" autoFocus value={editVal}
            style={{ ...inlineInput(30, '100%'), flex: 1, alignSelf: 'center', marginBottom: 4 }}
            onChange={e => setEditVal(e.target.value)} onBlur={() => commitEdit('val')}
            onKeyDown={e => onKey(e, 'val')} onFocus={e => e.target.select()} onClick={e => e.stopPropagation()} />
        ) : (
          <div className="plate-val" onClick={e => { e.stopPropagation(); startEdit('val', count) }} style={{ cursor: 'pointer' }}>
            {count === 0
              ? <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted)', borderBottom: '2px dotted rgba(128,128,128,0.4)' }}>{t('tap_to_set')}</span>
              : <span style={{ borderBottom: '2px dotted rgba(128,128,128,0.4)', display: 'inline-block', paddingBottom: 1 }}>{countDisplay}</span>
            }
          </div>
        )
      )}

      {hasRing && (
        <div className="plate-goal-text">
          {isTimed
            ? `${fmtSeconds(count)} / ${fmtSeconds(goal)}`
            : `${count.toLocaleString()} / ${goal.toLocaleString()} ${def.id === 'steps' ? t('ex_steps') : t('reps')}`
          }
        </div>
      )}

      <div className="plate-controls">
        <button className="cb cb-minus" onClick={e => { e.stopPropagation(); guardedChange(Math.max(0, count - def.inc[0]), `minus-${def.inc[0]}`) }}>−</button>
        <button className="cb" onClick={e => { e.stopPropagation(); guardedChange(count + def.inc[0], `plus-${def.inc[0]}`) }}>+{def.inc[0]}{isTimed ? 's' : ''}</button>
        <button className="cb cb-big" onClick={e => { e.stopPropagation(); guardedChange(count + def.inc[1], `plus-${def.inc[1]}`) }}>+{def.inc[1]}{isTimed ? 's' : ''}</button>
      </div>

    </div>
  )
}

// â"€â"€ Plate Grid â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function applyPlateSettings(def, plateSettings) {
  const s = plateSettings?.[def.id]
  if (!s) return def
  return {
    ...def,
    ...(s.color     ? { color: s.color }         : {}),
    ...(s.inc       ? { inc: s.inc }             : {}),
  }
}

function orderPlates(plates, plateOrder = []) {
  const byId = new Map(plates.map(p => [p.id, p]))
  const ordered = []
  for (const id of plateOrder || []) {
    const plate = byId.get(id)
    if (plate) {
      ordered.push(plate)
      byId.delete(id)
    }
  }
  return [...ordered, ...plates.filter(p => byId.has(p.id))]
}

// ── Plate Grid ────────────────────────────────────────────────────────────────

function PlateGrid({ dayData, customExercises, onChange, onAddCustom, onDeleteCustom, goals, onSetGoal, plateSettings, onSetPlateSettings, plateOrder, onDetail, history }) {
  const t = useT()
  const [editMode, setEditMode]   = useState(false)
  const [showAddModal, setAdd]    = useState(false)
  const [goalModal, setGoalModal] = useState(null)

  function update(id, val) {
    onChange({ ...dayData, [id]: val && typeof val === 'object' ? Number(val.reps || 0) : val })
  }

  const allPlates = orderPlates([...BUILTIN_PLATES, ...customExercises].filter(p => p.id !== 'steps'), plateOrder)

  return (
    <>
      <div className="grid-header">
        <span className="grid-date">{t('section_workouts')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {customExercises.length > 0 && (
            <button className="edit-toggle" onClick={() => setEditMode(e => !e)}>
              {editMode ? t('done') : t('edit')}
            </button>
          )}
          <button className="edit-toggle" onClick={() => setAdd(true)}
            style={{ color: 'var(--text)', borderColor: 'var(--border)' }}>
            {t('add_workout')}
          </button>
        </div>
      </div>

      <div className="plate-grid">
        {allPlates.map(def => {
          const effDef = applyPlateSettings(def, plateSettings)
          return (
            <ExercisePlate
              key={def.id}
              def={effDef}
              value={dayData[def.id] && typeof dayData[def.id] === 'object' ? Number(dayData[def.id].reps || 0) : dayData[def.id]}
              onChange={val => update(def.id, val)}
              onDelete={() => onDeleteCustom(def.id)}
              editMode={editMode}
              goal={getEffGoal(goals, def.id)}
              onSetGoal={() => setGoalModal(effDef)}
              onDetail={onDetail ? () => onDetail(effDef) : undefined}
              history={history}
            />
          )
        })}
      </div>

      {showAddModal && (
        <AddExerciseModal
          onSave={ex => { onAddCustom(ex); setAdd(false) }}
          onClose={() => setAdd(false)}
        />
      )}
      {goalModal && (
        <GoalModal
          def={goalModal}
          currentGoal={getEffGoal(goals, goalModal.id)}
          currentSettings={plateSettings[goalModal.id]}
          onSave={(newGoal, settings) => {
            onSetGoal(goalModal.id, newGoal)
            onSetPlateSettings(goalModal.id, settings)
            setGoalModal(null)
          }}
          onClose={() => setGoalModal(null)}
        />
      )}
    </>
  )
}

// â"€â"€ History View â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// ── Personal Overview helpers ─────────────────────────────────────────────────

function overviewDayReps(data) {
  if (!data) return 0
  let total = 0
  total += data.pushups     || 0
  total += data.squats      || 0
  total += data.situps      || 0
  total += data.pullups     || 0
  total += data.dips        || 0
  total += data.curls       || 0
  total += typeof data.bench === 'number' ? data.bench : Number(data.bench?.reps || 0)
  total += data.books       || 0
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('custom_')) continue
    if (typeof v === 'number') total += v
    else if (v?.reps) total += v.reps
  }
  return total
}

function computeOverviewStats(history, dayData) {
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const allDays = [...history.filter(d => d.date !== todayKey), { date: todayKey, ...dayData }]
  const byDate = {}
  let totalReps = 0
  for (const d of allDays) {
    const r = overviewDayReps(d)
    byDate[d.date] = r
    totalReps += r
  }
  let streak = 0
  const cur = new Date()
  for (let i = 0; i < 365; i++) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`
    if ((byDate[key] || 0) > 0) { streak++; cur.setDate(cur.getDate() - 1) }
    else if (i > 0) break
    else cur.setDate(cur.getDate() - 1)
  }
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
  const daysThisMonth = Object.entries(byDate).filter(([d, r]) => d.startsWith(monthPrefix) && r > 0).length
  const TIER_MINS = [0, 1000, 5000, 20000, 75000]
  const TIER_NAMES_OV = ['Beginner', 'Active', 'Dedicated', 'Advanced', 'Elite']
  const tierIdx = TIER_MINS.reduce((best, min, i) => totalReps >= min ? i : best, 0)
  const last7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    last7.push({ date: key, reps: byDate[key] || 0 })
  }
  return { totalReps, streak, daysThisMonth, tierName: TIER_NAMES_OV[tierIdx], last7 }
}

function PhotosStripMini({ authHeaders }) {
  const [photos, setPhotos] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!authHeaders) {
      try { setPhotos(JSON.parse(localStorage.getItem('training-log-photos') || '[]')) } catch { setPhotos([]) }
      setLoaded(true)
      return
    }
    async function load() {
      try {
        const hdrs = await authHeaders()
        const res = await fetch(`${API}/api/photos?action=list`, { headers: hdrs })
        if (res.ok) setPhotos(await res.json())
        else throw new Error()
      } catch {
        try { setPhotos(JSON.parse(localStorage.getItem('training-log-photos') || '[]')) } catch {}
      } finally { setLoaded(true) }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAdding(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
          const scale = Math.min(1, 800 / img.width)
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
          const c = document.createElement('canvas')
          c.width = w; c.height = h
          c.getContext('2d').drawImage(img, 0, 0, w, h)
          URL.revokeObjectURL(url)
          resolve(c.toDataURL('image/jpeg', 0.7))
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error()) }
        img.src = url
      })
      const date = new Date().toISOString().slice(0, 10)
      if (authHeaders) {
        const hdrs = await authHeaders()
        const res = await fetch(`${API}/api/photos?action=upload&date=${date}`, {
          method: 'POST',
          headers: { ...hdrs, 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, date }),
        })
        if (res.ok) {
          const { url } = await res.json()
          setPhotos(prev => [...prev, { url, date }])
        }
      } else {
        const updated = [...photos, { dataUrl, date }]
        setPhotos(updated)
        localStorage.setItem('training-log-photos', JSON.stringify(updated))
      }
    } catch {}
    setAdding(false)
    e.target.value = ''
  }

  const THUMB = 72
  const photoSrc = p => p.url || p.dataUrl || ''

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Progress Photos
        </div>
        {photos.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={adding}
          style={{
            width: THUMB, height: THUMB, flexShrink: 0, borderRadius: 10,
            border: '2px dashed var(--border)', background: 'var(--surface2)',
            color: 'var(--accent)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>{adding ? '…' : '+'}</span>
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add</span>
        </button>
        {!loaded
          ? Array.from({ length: 2 }, (_, i) => (
              <div key={i} style={{ width: THUMB, height: THUMB, flexShrink: 0, borderRadius: 10, background: 'var(--surface2)' }} />
            ))
          : photos.length === 0
            ? Array.from({ length: 2 }, (_, i) => (
                <div key={i} style={{
                  width: THUMB, height: THUMB, flexShrink: 0, borderRadius: 10,
                  border: '1.5px dashed var(--border)', background: 'var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>Photo</span>
                </div>
              ))
            : photos.slice().reverse().map((p, i) => (
                <div key={p.url || i} style={{ flexShrink: 0, position: 'relative' }}>
                  <img src={photoSrc(p)} alt={p.date} style={{ width: THUMB, height: THUMB, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                  <span style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    fontSize: 8, fontWeight: 700, color: '#fff', textAlign: 'center',
                    padding: '2px 0', background: 'rgba(0,0,0,0.5)', borderRadius: '0 0 10px 10px',
                  }}>{p.date?.slice(5)}</span>
                </div>
              ))
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

function PersonalProfileCard({ profile, onSaveProfile }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => ({
    gender: profile?.gender || '',
    height_ft: profile?.height_ft !== undefined ? String(profile.height_ft) : '',
    height_in: profile?.height_in !== undefined ? String(profile.height_in) : '',
    weight: profile?.weight !== undefined ? String(profile.weight) : '',
    body_fat: profile?.body_fat !== undefined && profile.body_fat !== null ? String(profile.body_fat) : '',
    fitness_goal: profile?.fitness_goal || 'maintain',
  }))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) return
    setForm({
      gender: profile?.gender || '',
      height_ft: profile?.height_ft !== undefined ? String(profile.height_ft) : '',
      height_in: profile?.height_in !== undefined ? String(profile.height_in) : '',
      weight: profile?.weight !== undefined ? String(profile.weight) : '',
      body_fat: profile?.body_fat !== undefined && profile.body_fat !== null ? String(profile.body_fat) : '',
      fitness_goal: profile?.fitness_goal || 'maintain',
    })
  }, [profile, editing])

  const hasProfile = !!(profile?.gender && profile?.height_ft && profile?.weight && profile?.fitness_goal)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const pill = active => ({
    flex: 1, padding: '9px 6px', borderRadius: 10, border: 'none',
    background: active ? 'var(--accent)' : 'var(--surface2)',
    color: active ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: 800,
    cursor: 'pointer',
  })
  const input = {
    width: '100%', boxSizing: 'border-box', background: 'var(--surface2)',
    border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)',
    fontSize: 16, fontWeight: 700, fontFamily: 'inherit', padding: '10px 12px',
    outline: 'none',
  }

  async function saveProfile(e) {
    e.stopPropagation()
    if (saving) return
    setSaving(true)
    try {
      await onSaveProfile({
        gender: form.gender,
        height_ft: parseInt(form.height_ft) || 0,
        height_in: parseInt(form.height_in) || 0,
        weight: parseFloat(form.weight) || 0,
        body_fat: form.body_fat ? parseFloat(form.body_fat) : null,
        fitness_goal: form.fitness_goal || 'maintain',
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const goalText = form.fitness_goal === 'build_muscle' ? 'Build Muscle' : form.fitness_goal === 'lose_fat' ? 'Lose Fat' : 'Maintain'

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 16,
      border: '1.5px solid var(--border)', padding: '14px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Profile
        </div>
        <button
          onClick={e => { e.stopPropagation(); setEditing(v => !v) }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: 0 }}
        >
          {editing ? 'Close' : hasProfile ? 'Edit' : 'Set up'}
        </button>
      </div>

      {!editing ? (
        hasProfile ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: 'Gender', value: profile.gender === 'male' ? 'Male' : 'Female' },
              { label: 'Height', value: `${profile.height_ft}ft ${profile.height_in || 0}in` },
              { label: 'Weight', value: `${profile.weight} lb` },
              profile.body_fat ? { label: 'Body Fat', value: `${profile.body_fat}%` } : null,
              { label: 'Goal', value: profile.fitness_goal === 'build_muscle' ? 'Build Muscle' : profile.fitness_goal === 'lose_fat' ? 'Lose Fat' : 'Maintain' },
            ].filter(Boolean).map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(90deg, rgba(139,92,246,0.1), transparent)',
              border: '1px dashed var(--accent)', textAlign: 'left', color: 'var(--text)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800 }}>Complete your profile</span>
            <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 16 }}>›</span>
          </button>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={pill(form.gender === 'male')} onClick={() => set('gender', 'male')}>Male</button>
            <button style={pill(form.gender === 'female')} onClick={() => set('gender', 'female')}>Female</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="number" inputMode="numeric" placeholder="Height ft" value={form.height_ft} onChange={e => set('height_ft', e.target.value)} style={input} />
            <input type="number" inputMode="numeric" placeholder="Height in" value={form.height_in} onChange={e => set('height_in', e.target.value)} style={input} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input type="number" inputMode="decimal" placeholder="Weight" value={form.weight} onChange={e => set('weight', e.target.value)} style={input} />
            <input type="number" inputMode="decimal" placeholder="Body fat %" value={form.body_fat} onChange={e => set('body_fat', e.target.value)} style={input} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={pill(form.fitness_goal === 'build_muscle')} onClick={() => set('fitness_goal', 'build_muscle')}>Build</button>
            <button style={pill(form.fitness_goal === 'lose_fat')} onClick={() => set('fitness_goal', 'lose_fat')}>Lose</button>
            <button style={pill(form.fitness_goal === 'maintain')} onClick={() => set('fitness_goal', 'maintain')}>Maintain</button>
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.65 : 1 }}
          >
            {saving ? 'Saving…' : `Save Profile (${goalText})`}
          </button>
        </div>
      )}
    </div>
  )
}

function PersonalOverview({ history, dayData, customExercises, authHeaders, profile, onSaveProfile }) {
  const stats = useMemo(() => computeOverviewStats(history, dayData), [history, dayData])
  const { totalReps, streak, daysThisMonth, last7 } = stats
  const startDate = useMemo(() => {
    if (!history || history.length === 0) return null
    const earliest = history.reduce((min, d) => d.date < min ? d.date : min, history[0].date)
    return new Date(earliest + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [history])
  const allDefs = [...BUILTIN_PLATES, ...LIFESTYLE_PLATES, ...(customExercises || []), MEALS_PLATE]
  const todayKey = TODAY()

  const weekCards = useMemo(() => last7.map(({ date }) => {
    const day = date === todayKey ? dayData : history.find(d => d.date === date)
    if (!day) return null
    const items = allDefs.map(def => {
      const v = day[def.id]
      if (v == null) return null
      if (def.type === 'bench' || def.type === 'weighted_reps') {
        const reps = typeof v === 'number' ? v : Number(v?.reps || 0)
        if (!reps) return null
        return { name: def.name, display: reps.toLocaleString(), color: def.color }
      }
      if (Array.isArray(v)) return v.length ? { name: def.name, display: String(v.length), color: def.color } : null
      if (typeof v === 'number' && v > 0) return { name: def.name, display: v.toLocaleString(), color: def.color }
      return null
    }).filter(Boolean)
    if (typeof day.water === 'number' && day.water > 0) items.push({ name: 'Water', display: `${day.water}c`, color: '#2B5DA8' })
    return items.length > 0 ? { date, items } : null
  }).filter(Boolean), [last7, history, dayData, todayKey])

  const card = {
    background: 'var(--surface)', borderRadius: 16,
    border: '1.5px solid var(--border)', padding: '14px 14px', marginBottom: 12,
  }

  const totalDisplay = totalReps >= 10000
    ? `${(totalReps / 1000).toFixed(1)}k`
    : totalReps.toLocaleString()

  return (
    <div style={{ paddingBottom: 16 }}>

      <PersonalProfileCard profile={profile} onSaveProfile={onSaveProfile} />

      {/* 1. Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'All-Time Reps', value: totalDisplay },
          { label: 'Day Streak', value: streak > 0 ? `${streak} 🔥` : '—' },
          { label: 'Days This Mo.', value: String(daysThisMonth) },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 14, padding: '12px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
              {value}
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Start date */}
      {startDate && (
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.4px', marginBottom: 10, opacity: 0.7 }}>
          journey started {startDate}
        </div>
      )}

      {/* 2. Progress Photos Strip */}
      <div style={card}>
        <PhotosStripMini authHeaders={authHeaders} />
      </div>

      {/* 4. This Week Recap */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
          This Week
        </div>
        {weekCards.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '8px 0 4px' }}>
            No workouts logged yet this week.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {weekCards.slice().reverse().map(({ date, items }) => (
              <div key={date} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                  {fmtDate(date)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {items.map(item => (
                    <span key={item.name} className="history-chip" style={{ '--pc': item.color }}>
                      <span className="chip-name">{item.name}</span>
                      <span className="chip-val">{item.display}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryView({ history, customExercises }) {
  const t = useT()
  if (history.length === 0) {
    return (
      <div className="history-empty">

        <p>{t('no_history')}</p>
        <p className="muted">{t('no_history_sub')}</p>
      </div>
    )
  }

  const allDefs = [...BUILTIN_PLATES, ...LIFESTYLE_PLATES, ...customExercises, MEALS_PLATE]

  return (
    <div className="history-list">
      {history.map(day => {
        const items = allDefs.map(def => {
          const v = day[def.id]
          if (v == null) return null
          if (def.type === 'bench' || def.type === 'weighted_reps') {
            const reps = typeof v === 'number' ? v : Number(v?.reps || 0)
            if (!reps) return null
            return { name: tEx(def, t), display: reps.toLocaleString(), color: def.color }
          }
          if (Array.isArray(v)) {
            if (!v.length) return null
            return { name: tEx(def, t), display: String(v.length), color: def.color }
          }
          if (typeof v === 'number' && v > 0) {
            const display = def.type === 'timed' ? fmtSeconds(v) : v.toLocaleString()
            return { name: tEx(def, t), display, color: def.color }
          }
          return null
        }).filter(Boolean)

        if (typeof day.water === 'number' && day.water > 0) {
          items.push({ name: 'Water', display: `${day.water} cups`, color: '#2B5DA8' })
        }

        if (items.length === 0) return null
        return (
          <div className="history-card" key={day.date}>
            <div className="history-card-date">{fmtDate(day.date)}</div>
            <div className="history-chips">
              {items.map(item => (
                <span key={item.name} className="history-chip" style={{ '--pc': item.color }}>
                  <span className="chip-name">{item.name}</span>
                  <span className="chip-val">{item.display}</span>
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tracker Bottom Sheet ───────────────────────────────────────────────────────

function TrackerSheet({ title, onClose, children }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 800, backdropFilter: 'blur(2px)',
        }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 801,
        background: 'var(--bg)', borderRadius: '22px 22px 0 0',
        padding: '0 max(16px, var(--safe-right)) calc(40px + var(--safe-bottom)) max(16px, var(--safe-left))',
        maxHeight: 'calc(100dvh - var(--safe-top) - 16px)', overflowY: 'auto',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <style>{`@keyframes slideUpSheet { from { transform: translateY(60%) } to { transform: translateY(0) } }`}</style>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 14px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'var(--surface2)', color: 'var(--muted)',
              fontSize: 18, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}
          >✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

// â"€â"€ Settings Footer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function SettingsFooter({ voiceToken, onRegenToken, regenLoading, signOut }) {
  const [copied, setCopied]       = useState(false)
  const [showToken, setShowToken] = useState(false)

  function copyToken() {
    if (!voiceToken) return
    navigator.clipboard.writeText(voiceToken).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="settings-footer">
      <div className="settings-row">
        <span className="settings-label">Siri token</span>
        <div className="vt-controls">
          {voiceToken ? (
            <>
              <code className="vt-code" onClick={() => setShowToken(s => !s)}>
                {showToken ? voiceToken : voiceToken.slice(0, 8) + '…'}
              </code>
              <button className="vt-btn" onClick={copyToken}>{copied ? '✓' : 'Copy'}</button>
            </>
          ) : (
            <span className="vt-none">none</span>
          )}
          <button className="vt-btn" onClick={onRegenToken} disabled={regenLoading}>
            {regenLoading ? '…' : voiceToken ? 'Regen' : 'Generate'}
          </button>
        </div>
      </div>
      <button className="sign-out-btn" onClick={() => signOut()}>Sign out</button>
    </div>
  )
}

// ── PR Toast ──────────────────────────────────────────────────────────────────

function PRToast({ pr, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [pr])
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      display: 'flex', justifyContent: 'center', padding: 'calc(14px + var(--safe-top)) max(16px, var(--safe-right)) 14px max(16px, var(--safe-left))',
      pointerEvents: 'none', animation: 'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #b45309, #d97706)',
        color: '#fff', borderRadius: 14, padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 6px 24px rgba(217,119,6,0.45)',
        fontSize: 15, fontWeight: 700, maxWidth: 380,
      }}>
        <span style={{ fontSize: 22 }}>🏆</span>
        <div>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>New PR!</div>
          <div>{pr.exercise} — {pr.display}</div>
        </div>
      </div>
    </div>
  )
}

// ── Meditation Tile ───────────────────────────────────────────────────────────

const MEDITATION_SESSION_KEY = 'meditation_session'

function MeditationTile({ value, onChange, onDetail, goal }) {
  const t = useT()
  const color = '#38BDF8'

  const [running, setRunning] = useState(() => {
    try { return !!localStorage.getItem(MEDITATION_SESSION_KEY) } catch { return false }
  })
  const [elapsed, setElapsed] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editMinutes, setEditMinutes] = useState('')
  const startRef = useRef(null)
  const intervalRef = useRef(null)
  const elapsedRef = useRef(0)
  const wakeLockRef = useRef(null)

  // Restore in-progress session (runs before the running effect due to declaration order)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MEDITATION_SESSION_KEY)
      if (raw) {
        const { startTimestamp } = JSON.parse(raw)
        startRef.current = startTimestamp
        const e = Math.floor((Date.now() - startTimestamp) / 1000)
        elapsedRef.current = e
        setElapsed(e)
      }
    } catch {
      try { localStorage.removeItem(MEDITATION_SESSION_KEY) } catch {}
      setRunning(false)
    }
  }, [])

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {}
  }

  function releaseWakeLock() {
    try { wakeLockRef.current?.release(); wakeLockRef.current = null } catch {}
  }

  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current)
      releaseWakeLock()
      return
    }
    acquireWakeLock()
    intervalRef.current = setInterval(() => {
      if (!startRef.current) return
      const e = Math.floor((Date.now() - startRef.current) / 1000)
      elapsedRef.current = e
      setElapsed(e)
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running])

  // On visibility restore: recalculate elapsed from timestamp + re-acquire wake lock
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible' || !running || !startRef.current) return
      const e = Math.floor((Date.now() - startRef.current) / 1000)
      elapsedRef.current = e
      setElapsed(e)
      if (!wakeLockRef.current || wakeLockRef.current.released) acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [running])

  // Release wake lock on unmount
  useEffect(() => () => { clearInterval(intervalRef.current); releaseWakeLock() }, [])

  function startTimer(e) {
    e.stopPropagation()
    const startTimestamp = Date.now()
    startRef.current = startTimestamp
    elapsedRef.current = 0
    try { localStorage.setItem(MEDITATION_SESSION_KEY, JSON.stringify({ startTimestamp })) } catch {}
    setRunning(true)
  }

  function stopTimer(e) {
    e.stopPropagation()
    setRunning(false)
    const sec = elapsedRef.current
    try { localStorage.removeItem(MEDITATION_SESSION_KEY) } catch {}
    startRef.current = null
    elapsedRef.current = 0
    setElapsed(0)
    if (sec > 0) onChange((value || 0) + sec)
  }

  function openEditor(e) {
    e.stopPropagation()
    setEditMinutes(value ? String(Math.round((value / 60) * 10) / 10) : '')
    setEditing(true)
  }

  function saveEditor(e) {
    e.stopPropagation()
    const mins = Number(editMinutes)
    const secs = Number.isFinite(mins) && mins > 0 ? Math.round(mins * 60) : 0
    onChange(secs)
    setEditing(false)
  }

  function cancelEditor(e) {
    e.stopPropagation()
    setEditing(false)
  }

  const total = value || 0
  const done = goal > 0 && total >= goal

  return (
    <div
      className={`plate ${done ? 'plate-done' : ''}`}
      style={{
        '--pc': color,
        cursor: onDetail ? 'pointer' : 'default',
        borderLeft: '1px solid var(--border)',
      }}
      onClick={() => !running && onDetail && onDetail()}
    >
      <div className="plate-top-row">
        <div className="plate-name">{t('ex_meditation')}</div>
      </div>

      {running ? (
        <div className="plate-val" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
          {fmtSeconds(elapsed)}
          <span style={{ fontSize: 11, marginLeft: 5, opacity: 0.7 }}>●</span>
        </div>
      ) : (
        <div className="plate-val">
          {total === 0
            ? <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted)' }}>{t('tap_to_set')}</span>
            : <span style={{ color: done ? '#4ade80' : 'var(--text)' }}>{fmtSeconds(total)}{done && ' ✓'}</span>
          }
        </div>
      )}

      {goal > 0 && (
        <div className="plate-goal-text">{fmtSeconds(total)} / {fmtSeconds(goal)}</div>
      )}

      <div className="plate-controls">
        {running ? (
          <button
            className="cb cb-big"
            style={{ flex: 1, color, background: `${color}18`, borderColor: `${color}40` }}
            onClick={stopTimer}
          >
            Stop
          </button>
        ) : editing ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={editMinutes}
              placeholder="min"
              onClick={e => e.stopPropagation()}
              onChange={e => setEditMinutes(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEditor(e)
                if (e.key === 'Escape') cancelEditor(e)
              }}
              autoFocus
              style={{
                minWidth: 0, flex: 1, border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--surface)', color: 'var(--text)', padding: '8px 9px',
                fontSize: 13, fontWeight: 800, textAlign: 'center', fontFamily: 'inherit',
              }}
            />
            <button className="cb" onClick={saveEditor}>Save</button>
            <button className="cb" onClick={cancelEditor}>Cancel</button>
          </>
        ) : (
          <>
            <button className="cb" onClick={startTimer}>Start</button>
            <button className="cb" onClick={e => { e.stopPropagation(); onChange(total + 60) }}>+1m</button>
            <button className="cb" onClick={e => { e.stopPropagation(); onChange(total + 300) }}>+5m</button>
            <button className="cb" onClick={openEditor}>{total > 0 ? 'Edit' : 'Set'}</button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Books Tile ────────────────────────────────────────────────────────────────

function BooksTile({ sessions, booksConfig, onAddSession, onDetail }) {
  const t = useT()
  const color = '#8B5CF6'
  const books = booksConfig?.books || []
  const currentBook = books.find(b => b.status === 'reading') || null
  const finished = books.filter(b => b.status === 'finished')
  const finishedCount = finished.length
  const lastFinished = finished.slice().sort((a, b) => {
    if (a.dateFinished && b.dateFinished) return b.dateFinished.localeCompare(a.dateFinished)
    return 0
  })[0] || null
  const displayBook = currentBook || lastFinished
  const count = sessions || 0

  return (
    <div
      className="plate"
      style={{
        '--pc': color,
        cursor: onDetail ? 'pointer' : 'default',
        borderLeft: '1px solid var(--border)',
      }}
      onClick={() => onDetail && onDetail()}
    >
      <div className="plate-top-row">
        <div className="plate-name">{t('ex_books')}</div>
        {finishedCount > 0 && (
          <div style={{ fontSize: 10, color, fontWeight: 700 }}>{finishedCount} read</div>
        )}
      </div>

      <div
        className="plate-val"
        style={{
          fontSize: displayBook ? 13 : 15,
          color: displayBook ? 'var(--text)' : 'var(--muted)',
          lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          maxHeight: '2.6em',
        }}
      >
        {displayBook ? displayBook.title : t('books_no_current')}
      </div>
      {!currentBook && lastFinished && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: -4, marginBottom: 2 }}>last finished</div>
      )}

      <div className="plate-goal-text">
        {count > 0 ? `${count} session${count !== 1 ? 's' : ''} today` : 'Tap + to log'}
      </div>

      <div className="plate-controls">
        <button
          className="cb cb-big"
          style={{ flex: 1 }}
          onClick={e => { e.stopPropagation(); onAddSession(count + 1) }}
        >
          +1
        </button>
      </div>
    </div>
  )
}

// ── Weight Section ────────────────────────────────────────────────────────────

function WeightSection({ weightLog, onLogWeight }) {
  const [lbs, setLbs] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayEntry = weightLog.find(e => e.date === todayKey)

  useEffect(() => {
    if (todayEntry) {
      setLbs(String(todayEntry.weight_lbs))
      setNotes(todayEntry.notes || '')
    }
  }, [todayEntry?.weight_lbs])

  async function handleSubmit(e) {
    e.preventDefault()
    const w = parseFloat(lbs)
    if (!w || w <= 0) return
    setLoading(true)
    await onLogWeight(w, notes.trim())
    setLoading(false)
  }

  const chartData = weightLog.filter(e => e.weight_lbs > 0)
  const recent = [...weightLog].reverse().slice(0, 7)
  const vals = chartData.map(e => e.weight_lbs)
  const minW = vals.length ? Math.min(...vals) : null
  const maxW = vals.length ? Math.max(...vals) : null
  const curW = vals.length ? vals[vals.length - 1] : null

  const cardStyle = {
    background: 'var(--surface)', borderRadius: 16, padding: '16px',
    marginBottom: 12, border: '1.5px solid var(--border)',
  }
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6,
  }

  function fmtShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Input card */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          Body Weight
        </div>
        {todayEntry && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            Today: <strong style={{ color: 'var(--text)' }}>{todayEntry.weight_lbs} lbs</strong>
            {todayEntry.notes ? <span> — {todayEntry.notes}</span> : null}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 108px' }}>
            <div style={labelStyle}>Weight (lbs)</div>
            <input
              type="number" inputMode="decimal" step="0.1" min="50" max="500"
              value={lbs} onChange={e => setLbs(e.target.value)}
              placeholder="170.0"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Notes (optional)</div>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="morning, post-workout…"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <button
            className="btn-primary" disabled={loading || !lbs}
            style={{ flexShrink: 0, padding: '8px 16px', fontSize: 13 }}
          >
            {loading ? '…' : todayEntry ? 'Update' : 'Log'}
          </button>
        </form>
      </div>

      {/* Chart */}
      {chartData.length >= 2 && (() => {
        const W = 340, H = 90, pL = 4, pR = 4, pT = 14, pB = 4
        const iW = W - pL - pR, iH = H - pT - pB
        const minV = Math.min(...vals) * 0.995
        const maxV = Math.max(...vals) * 1.005
        const range = maxV - minV || 1
        const cx = i => pL + (chartData.length > 1 ? (i / (chartData.length - 1)) * iW : iW / 2)
        const cy = v => pT + iH - ((v - minV) / range) * iH
        const line = chartData.map((e, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(e.weight_lbs).toFixed(1)}`).join(' ')
        const area = `${line} L${cx(chartData.length - 1).toFixed(1)},${pT + iH} L${cx(0).toFixed(1)},${pT + iH} Z`
        return (
          <div style={cardStyle}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              {[['MIN', minW], ['MAX', maxW], ['NOW', curW]].map(([label, val]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px' }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{val}</div>
                </div>
              ))}
            </div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
              <defs>
                <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#wg)" />
              <path d={line} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={cx(chartData.length - 1)} cy={cy(chartData[chartData.length - 1].weight_lbs)} r={4} fill="#22c55e" />
            </svg>
          </div>
        )
      })()}

      {/* Recent entries */}
      {recent.length > 0 && (
        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Recent</div>
          {recent.map((e, i) => (
            <div key={e.date} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 0', borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
              fontSize: 14,
            }}>
              <span style={{ color: 'var(--muted)', minWidth: 80 }}>{fmtShort(e.date)}</span>
              <span style={{ fontWeight: 800 }}>{e.weight_lbs} lbs</span>
              {e.notes
                ? <span style={{ color: 'var(--muted)', fontSize: 12, flex: 1, textAlign: 'right' }}>{e.notes}</span>
                : <span style={{ flex: 1 }} />
              }
            </div>
          ))}
        </div>
      )}

      {chartData.length < 2 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '8px 0 4px' }}>
          No weight trend yet — log today’s weight to start the graph
        </div>
      )}
    </div>
  )
}

// ── Your Records ──────────────────────────────────────────────────────────────

const PRIORITY_PR_ROWS = [
  { id: 'bench', exercise: 'Bench Press', type: 'reps', display: 'No record yet' },
  { id: 'meditation', exercise: 'Meditation', type: 'timed', display: 'No time yet' },
  { id: 'pullups', exercise: 'Pull-ups', type: 'reps', display: 'No record yet' },
  { id: 'planks', exercise: 'Plank', type: 'timed', display: 'No time yet' },
  { id: 'dead_hang', exercise: 'Dead Hang', type: 'timed', display: 'No time yet' },
]

function YourRecords({ history, dayData, customExercises }) {
  const records = calcAllTimeRecords(history, dayData, customExercises)
  const priorityIds = new Set(PRIORITY_PR_ROWS.map(row => row.id))
  const priorityEntries = PRIORITY_PR_ROWS.map(row => [
    row.id,
    records[row.id] || { ...row, pending: true },
  ])
  const otherEntries = Object.entries(records)
    .filter(([id]) => !priorityIds.has(id))
    .sort(([, a], [, b]) => String(b.date || '').localeCompare(String(a.date || '')))
  const entries = [...priorityEntries, ...otherEntries]

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        background: 'linear-gradient(135deg, #d977061f, #f59e0b12)',
        border: '1.5px solid #d9770644', borderRadius: 16, padding: 16,
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          🏆 PR Board
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
          Your all-time bests across every tracked category — lifts, reps, steps, meditation, and more.
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="history-empty" style={{ marginTop: 0 }}>
          <p>No PRs yet</p>
          <p className="muted">Log a workout to start building your record board.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(([id, rec]) => (
            <div key={id} style={{
              background: 'var(--surface)', borderRadius: 12, padding: '12px 16px',
              border: '1.5px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{rec.exercise}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {rec.pending ? 'Not logged yet' : fmtDate(rec.date)} · {
                    rec.type === 'reps' ? 'Rep PR' :
                    rec.type === 'steps' ? 'Step PR' :
                    rec.type === 'timed' ? 'Best time' :
                    rec.type === 'sessions' ? 'Session PR' :
                    rec.type === 'bottles' ? 'Best day' :
                    'Best set'
                  }
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: rec.pending ? 'var(--muted)' : '#d97706', whiteSpace: 'nowrap' }}>{rec.display}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Milestone Rewards ─────────────────────────────────────────────────────────

const AUTO_MILESTONE_IDS = new Set(['total_reps', 'meditation_hours', 'books_count', 'per_exercise', 'distance_miles'])

function MilestoneRewards({ rewards = [], onChange, goals = {}, customExercises = [], nutritionGoals = {}, dayData = {}, history = [], booksConfig = { books: [] } }) {
  const [rewardText, setRewardText] = useState('')
  const [selectedMilestone, setSelectedMilestone] = useState('custom')
  const [customMilestone, setCustomMilestone] = useState('')
  const [showRewardForm, setShowRewardForm] = useState(false)
  const [goalTarget, setGoalTarget] = useState('')
  const [stepsPerMile, setStepsPerMile] = useState('2000')

  const todayKey = TODAY()
  const allDays = [...history.filter(d => d.date !== todayKey), { date: todayKey, ...dayData }]
  const allTimeReps = computeOverviewStats(history, dayData).totalReps

  const exerciseDefs = [...BUILTIN_PLATES, ...customExercises]

  function exerciseProgress(def) {
    const raw = dayData?.[def.id]
    if (def.type === 'bench') return Number(raw?.reps || 0)
    return Number(raw || 0)
  }

  const goalOptions = exerciseDefs
    .filter(def => goals?.[def.id] != null && Number(goals[def.id]) > 0)
    .map(def => {
      const target = Number(goals[def.id]) || 0
      const current = exerciseProgress(def)
      const unit = def.id === 'steps' ? 'steps' : def.type === 'timed' ? 'seconds' : 'reps'
      return {
        id: `goal:${def.id}`,
        label: `${def.name}: ${target.toLocaleString()} ${unit}`,
        shortLabel: def.name,
        current,
        target,
        unit,
        complete: current >= target,
      }
    })

  const waterGoal = Number(nutritionGoals?.water || 0)
  if (waterGoal > 0) {
    goalOptions.push({
      id: 'goal:water',
      label: `Water: ${waterGoal.toLocaleString()} cups`,
      shortLabel: 'Water',
      current: Number(dayData?.water || 0),
      target: waterGoal,
      unit: 'cups',
      complete: Number(dayData?.water || 0) >= waterGoal,
    })
  }

  const records = calcAllTimeRecords(history, dayData, customExercises)
  const prOptions = Object.entries(records).slice(0, 12).map(([id, rec]) => ({
    id: `pr:${id}`,
    label: `Maintain PR: ${rec.exercise} — ${rec.display}`,
    shortLabel: rec.exercise,
    current: rec.display,
    target: rec.display,
    unit: 'PR',
    complete: true,
  }))

  const options = [
    ...goalOptions,
    ...prOptions,
    { id: 'total_reps',       label: 'Total Reps goal',          shortLabel: 'Total Reps',   current: 0, target: 1, unit: 'reps',    complete: false },
    { id: 'meditation_hours', label: 'Meditation Hours goal',     shortLabel: 'Meditation',   current: 0, target: 1, unit: 'hrs',     complete: false },
    { id: 'books_count',      label: 'Books Completed goal',      shortLabel: 'Books',        current: 0, target: 1, unit: 'books',   complete: false },
    { id: 'per_exercise',     label: 'Each Exercise Reps goal',   shortLabel: 'Per Exercise', current: 0, target: 1, unit: 'exercises', complete: false },
    { id: 'distance_miles',   label: 'Walk N Miles goal',         shortLabel: 'Distance',     current: 0, target: 1, unit: 'miles',   complete: false },
    { id: 'custom', label: 'Custom milestone', shortLabel: 'Custom', current: 0, target: 1, unit: '', complete: false },
  ]

  function optionFor(reward) {
    if (reward.milestoneId === 'custom') {
      return {
        id: 'custom',
        label: reward.customMilestone || 'Custom milestone',
        shortLabel: 'Custom',
        current: reward.done ? 1 : 0,
        target: 1,
        unit: '',
        complete: !!reward.done,
      }
    }
    const gt = Number(reward.goalTarget) || 0
    if (reward.milestoneId === 'total_reps') {
      const target = gt || 10000
      return { id: 'total_reps', label: `${target.toLocaleString()} Total Reps`, shortLabel: 'Total Reps', current: allTimeReps, target, unit: 'reps', complete: allTimeReps >= target }
    }
    if (reward.milestoneId === 'meditation_hours') {
      const target = gt || 10
      const totalSec = allDays.reduce((s, d) => s + (Number(d.meditation) || 0), 0)
      const hours = Math.round(totalSec / 3600 * 10) / 10
      return { id: 'meditation_hours', label: `${target} Hours of Meditation`, shortLabel: 'Meditation', current: hours, target, unit: 'hrs', complete: hours >= target }
    }
    if (reward.milestoneId === 'books_count') {
      const target = gt || 10
      const count = (booksConfig?.books || []).filter(b => b.status === 'finished').length
      return { id: 'books_count', label: `${target} Books Completed`, shortLabel: 'Books', current: count, target, unit: 'books', complete: count >= target }
    }
    if (reward.milestoneId === 'per_exercise') {
      const threshold = gt || 1000
      const repDefs = [...BUILTIN_PLATES.filter(p => p.type === 'reps'), ...customExercises.filter(p => p.type === 'reps' || !p.type)]
      const totals = repDefs.map(def => allDays.reduce((s, d) => s + numericExerciseValue(d[def.id]), 0))
      const reached = totals.filter(t => t >= threshold).length
      const n = repDefs.length
      return { id: 'per_exercise', label: `${threshold.toLocaleString()} Reps on Each Exercise`, shortLabel: 'Per Exercise', current: reached, target: n, unit: 'exercises', complete: n > 0 && reached === n }
    }
    if (reward.milestoneId === 'distance_miles') {
      const target = gt || 100
      const spm = Number(reward.goalConfig?.stepsPerMile) || 2000
      const totalSteps = allDays.reduce((s, d) => s + (Number(d.steps) || 0), 0)
      const miles = Math.round(totalSteps / spm * 10) / 10
      return { id: 'distance_miles', label: `Walk ${target} Miles`, shortLabel: 'Distance', current: miles, target, unit: 'miles', complete: miles >= target }
    }
    return options.find(o => o.id === reward.milestoneId) || {
      id: reward.milestoneId,
      label: reward.milestoneLabel || 'Milestone',
      shortLabel: 'Milestone',
      current: 0,
      target: 1,
      unit: '',
      complete: false,
    }
  }

  function addReward(e) {
    e.preventDefault()
    const cleanReward = rewardText.trim()
    const opt = options.find(o => o.id === selectedMilestone) || options[0]
    const cleanCustom = selectedMilestone === 'custom' ? customMilestone.trim() : ''
    const isAuto = AUTO_MILESTONE_IDS.has(selectedMilestone)
    const targetNum = isAuto ? parseFloat(goalTarget) : null
    if (!cleanReward) return
    if (selectedMilestone === 'custom' && !cleanCustom) return
    if (isAuto && (!goalTarget || !Number.isFinite(targetNum) || targetNum <= 0)) return
    const goalConfig = selectedMilestone === 'distance_miles'
      ? { stepsPerMile: Number(stepsPerMile) || 2000 }
      : undefined
    const next = [{
      id: `reward_${Date.now()}`,
      reward: cleanReward.slice(0, 120),
      milestoneId: selectedMilestone,
      milestoneLabel: selectedMilestone === 'custom' ? cleanCustom.slice(0, 160) : opt.label,
      customMilestone: cleanCustom.slice(0, 160),
      goalTarget: isAuto ? targetNum : undefined,
      goalConfig: goalConfig || undefined,
      claimed: false,
      done: false,
      createdAt: new Date().toISOString(),
    }, ...rewards]
    onChange(next)
    setRewardText('')
    setCustomMilestone('')
    setGoalTarget('')
    setStepsPerMile('2000')
    setSelectedMilestone(options[0]?.id || 'custom')
    setShowRewardForm(false)
  }

  function updateReward(id, patch) {
    onChange(rewards.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function removeReward(id) {
    onChange(rewards.filter(r => r.id !== id))
  }

  const counts = rewards.reduce((acc, reward) => {
    const opt = optionFor(reward)
    if (reward.claimed) acc.claimed += 1
    else if (opt.complete) acc.ready += 1
    else acc.locked += 1
    return acc
  }, { ready: 0, locked: 0, claimed: 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: 'linear-gradient(135deg, #f59e0b20, #7c3aed18)',
        border: '1.5px solid #f59e0b44', borderRadius: 18, padding: 16,
      }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 6 }}>
          🎁 Milestone Rewards
        </div>
        <h2 style={{ fontSize: 22, lineHeight: 1.05, letterSpacing: '-0.8px', marginBottom: 8 }}>Delayed gratification goals</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
          Attach rewards to the goals, PRs, and milestones you set throughout the app. When a milestone is ready, claim the reward intentionally.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
          {[
            ['Ready', counts.ready, '#22c55e'],
            ['Locked', counts.locked, 'var(--muted)'],
            ['Claimed', counts.claimed, '#f59e0b'],
          ].map(([label, count, color]) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color }}>{count}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {!showRewardForm ? (
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowRewardForm(true)}
          style={{ alignSelf: 'flex-start', padding: '11px 16px', borderRadius: 12 }}
        >
          + Add reward goal
        </button>
      ) : (
        <form onSubmit={addReward} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reward</label>
            <button
              type="button"
              className="vt-btn"
              onClick={() => setShowRewardForm(false)}
              style={{ padding: '4px 9px' }}
            >
              Close
            </button>
          </div>
          <input
            value={rewardText}
            onChange={e => setRewardText(e.target.value)}
            placeholder="e.g. New running shoes, movie night, massage"
            maxLength={120}
          />
          <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unlock when I hit</label>
          <select value={selectedMilestone} onChange={e => { setSelectedMilestone(e.target.value); setGoalTarget('') }}>
            {options.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
          </select>
          {selectedMilestone === 'custom' && (
            <input
              value={customMilestone}
              onChange={e => setCustomMilestone(e.target.value)}
              placeholder="Describe the milestone you want to earn this with"
              maxLength={160}
            />
          )}
          {AUTO_MILESTONE_IDS.has(selectedMilestone) && (
            <>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {selectedMilestone === 'per_exercise' ? 'Reps per exercise' : selectedMilestone === 'distance_miles' ? 'Miles target' : selectedMilestone === 'meditation_hours' ? 'Hours target' : selectedMilestone === 'books_count' ? 'Books target' : 'Reps target'}
              </label>
              <input
                type="number"
                min="1"
                value={goalTarget}
                onChange={e => setGoalTarget(e.target.value)}
                placeholder={selectedMilestone === 'per_exercise' ? 'e.g. 1000' : selectedMilestone === 'distance_miles' ? 'e.g. 100' : selectedMilestone === 'meditation_hours' ? 'e.g. 10' : selectedMilestone === 'books_count' ? 'e.g. 10' : 'e.g. 10000'}
              />
              {selectedMilestone === 'distance_miles' && (
                <>
                  <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Steps per mile (default 2000)</label>
                  <input
                    type="number"
                    min="500"
                    max="5000"
                    value={stepsPerMile}
                    onChange={e => setStepsPerMile(e.target.value)}
                    placeholder="2000"
                  />
                </>
              )}
            </>
          )}
          <button className="btn-primary" disabled={
            !rewardText.trim() ||
            (selectedMilestone === 'custom' && !customMilestone.trim()) ||
            (AUTO_MILESTONE_IDS.has(selectedMilestone) && (!goalTarget || parseFloat(goalTarget) <= 0))
          }>
            Add Reward Goal
          </button>
        </form>
      )}

      {rewards.length === 0 ? (
        <div className="history-empty" style={{ marginTop: 8 }}>
          <div className="empty-icon">🎯</div>
          <p>No reward goals yet</p>
          <p className="muted">Tap Add reward goal when you are ready to attach one to a milestone.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rewards.map(reward => {
            const opt = optionFor(reward)
            const progress = typeof opt.current === 'number' && typeof opt.target === 'number' && opt.target > 0
              ? Math.min(1, opt.current / opt.target)
              : opt.complete ? 1 : 0
            const ready = opt.complete && !reward.claimed
            return (
              <div key={reward.id} style={{
                background: 'var(--surface)', border: `1.5px solid ${reward.claimed ? '#f59e0b55' : ready ? '#22c55e66' : 'var(--border)'}`,
                borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.4px' }}>{reward.reward}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>{opt.label}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: reward.claimed ? '#f59e0b' : ready ? '#22c55e' : 'var(--muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {reward.claimed ? 'Claimed' : ready ? 'Ready' : 'Locked'}
                  </div>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'var(--surface2)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: reward.claimed ? '#f59e0b' : ready ? '#22c55e' : 'var(--accent)', borderRadius: 999 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {typeof opt.current === 'number' && typeof opt.target === 'number'
                      ? `${opt.current.toLocaleString()} / ${opt.target.toLocaleString()} ${opt.unit}`
                      : String(opt.current || opt.target || '')}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {reward.milestoneId === 'custom' && !reward.claimed && (
                      <button type="button" className="vt-btn" onClick={() => updateReward(reward.id, { done: !reward.done })}>
                        {reward.done ? 'Mark locked' : 'Mark ready'}
                      </button>
                    )}
                    {ready && (
                      <button type="button" className="vt-btn" style={{ color: '#22c55e' }} onClick={() => updateReward(reward.id, { claimed: true })}>
                        Claim
                      </button>
                    )}
                    {reward.claimed && (
                      <button type="button" className="vt-btn" onClick={() => updateReward(reward.id, { claimed: false })}>Undo</button>
                    )}
                    <button type="button" className="vt-btn" style={{ color: 'var(--error)' }} onClick={() => removeReward(reward.id)}>Delete</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export default function App() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { isLoaded: authLoaded, getToken, signOut } = useAuth()
  const [theme, toggleTheme]     = useTheme()
  const [language, setLanguage]  = useLanguage()

  function t(key, vars) {
    const str = T[language]?.[key] ?? T.en?.[key] ?? key
    if (!vars) return str
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), str)
  }

  const [demoMode, setDemoMode]       = useState(false)
  const [usernameSession, setUsernameSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USERNAME_AUTH_KEY) || 'null') } catch { return null }
  })
  const [dayData, setDayData]        = useState(defaultDayData())
  const [customExercises, setCustom] = useState([])
  const [goals, setGoals]            = useState({})
  const [plateSettings, setPlateSettings] = useState({})
  const [plateOrder, setPlateOrder] = useState([])
  const [voiceToken, setVoiceToken]  = useState(null)
  const [ouraPAT, setOuraPAT]        = useState(null)
  const [favorites, setFavorites]    = useState([])
  const [nutritionGoals, setNutritionGoals] = useState(DEFAULT_NUTRITION_GOALS)
  const [supplements, setSupplements] = useState([])
  const [shareToken, setShareToken]   = useState(null)
  const [sharingSettings, setSharingSettings] = useState(DEFAULT_SHARING)
  const [reminderSettings, setReminderSettings] = useState(DEFAULT_REMINDER_SETTINGS)
  const [milestoneRewards, setMilestoneRewards] = useState([])
  const [profile, setProfile]        = useState({})
  const [savedUsername, setSavedUsername] = useState(null)
  const [history, setHistory]        = useState([])
  const [view, setView]              = useState('today')
  const [saveStatus, setSaveStatus]  = useState(null)
  const [regenLoading, setRegen]     = useState(false)
  const [detailDef, setDetailDef]    = useState(null)
  const [appLoading, setAppLoading]  = useState(true)
  const [prToast, setPrToast]        = useState(null)
  const [weightLog, setWeightLog]    = useState([])
  const [linkPartners, setLinkPartners] = useState([])
  const [detailPanel, setDetailPanel] = useState(null) // 'steps' | 'water' | 'sleep'
  const [personalTab, setPersonalTab] = useState('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [booksConfig, setBooksConfig] = useState({ books: [] })
  const [meditationDetailOpen, setMeditationDetailOpen] = useState(false)
  const [booksDetailOpen, setBooksDetailOpen] = useState(false)
  const shownPRsRef                  = useRef(new Set())

  function enterDemo() {
    setDemoMode(true)
    setUsernameSession(null)
    setDayData(DEMO_TODAY)
    setGoals(DEMO_GOALS)
    setHistory(makeDemoHistory())
    configRef.current = { customExercises: [], goals: DEMO_GOALS, voiceToken: null, ouraPAT: null, plateSettings: {}, plateOrder: [], favorites: [], nutritionGoals: DEFAULT_NUTRITION_GOALS, shareToken: null, sharingSettings: DEFAULT_SHARING, reminderSettings: DEFAULT_REMINDER_SETTINGS, booksConfig: { books: [] }, milestoneRewards: [] }
    setAppLoading(false)
  }

  function handleUsernameAuth(session) {
    setDemoMode(false)
    setUsernameSession(session)
    setAppLoading(true)
  }

  async function handleSignOut() {
    if (usernameSession) {
      localStorage.removeItem(USERNAME_AUTH_KEY)
      setUsernameSession(null)
      setAppLoading(false)
      return
    }
    await signOut()
  }
  const saveTimer                    = useRef(null)
  const savingRef                    = useRef(false)   // true while a POST is in-flight
  const lastLoadRef                  = useRef(0)
  const pendingSaveRef               = useRef(null)   // latest unsaved day patch
  const cachedTokenRef               = useRef(null)   // cached JWT for beforeunload flush
  const configSavingRef              = useRef(false)  // true while persistConfig is in flight
  const configDirtyRef               = useRef(false)  // a newer save was requested while one was in flight
  const autoSyncedUsernameRef        = useRef(false)  // ensures one-shot auto-persist of derived username
  // always-current config snapshot — updated imperatively in every handler
  const configRef = useRef({ customExercises: [], goals: {}, voiceToken: null, ouraPAT: null, plateSettings: {}, plateOrder: [], favorites: [], nutritionGoals: DEFAULT_NUTRITION_GOALS, supplements: [], shareToken: null, sharingSettings: DEFAULT_SHARING, reminderSettings: DEFAULT_REMINDER_SETTINGS, linkPartners: [], booksConfig: { books: [] }, milestoneRewards: [] })

  useEffect(() => {
    if (isSignedIn && usernameSession) {
      localStorage.removeItem(USERNAME_AUTH_KEY)
      setUsernameSession(null)
    }
  }, [isSignedIn, usernameSession])

  useEffect(() => {
    if ((!isSignedIn && !usernameSession) || !authLoaded) return
    loadAll().then(() => applyUrlParams())
    lastLoadRef.current = Date.now()

    function flushPendingSave() {
      if (!saveTimer.current || !pendingSaveRef.current) return
      const pending = pendingSaveRef.current
      const flushHeaders = usernameSession?.username && usernameSession?.token
        ? { 'X-Username-Auth': usernameSession.username, 'X-Username-Token': usernameSession.token, 'Content-Type': 'application/json' }
        : cachedTokenRef.current
          ? { 'Authorization': `Bearer ${cachedTokenRef.current}`, 'Content-Type': 'application/json' }
          : null
      if (!flushHeaders) return
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      pendingSaveRef.current = null
      // keepalive ensures the request completes even after page unload
      fetch(`${API}/api/log`, {
        method: 'POST',
        keepalive: true,
        headers: flushHeaders,
        body: JSON.stringify({ action: 'save_day', date: pending.date, data: pending.patch }),
      }).catch(() => {})
    }

    function maybeReload() {
      if (saveTimer.current) return
      if (savingRef.current) return
      if (Date.now() - lastLoadRef.current < 1000) return
      lastLoadRef.current = Date.now()
      loadAll().then(() => applyUrlParams())
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        maybeReload()
      } else {
        flushPendingSave()
      }
    }

    // Refresh every 30 s while the tab is visible so all devices stay in sync
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') maybeReload()
    }, 30000)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', maybeReload)
    window.addEventListener('beforeunload', flushPendingSave)
    window.addEventListener('pagehide', flushPendingSave)

    return () => {
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', maybeReload)
      window.removeEventListener('beforeunload', flushPendingSave)
      window.removeEventListener('pagehide', flushPendingSave)
    }
  }, [isSignedIn, usernameSession, authLoaded])

  // One-shot: if config never had a partnerUsername saved, auto-persist the derived one
  // so every user appears in the partner search directory without requiring a manual Settings edit
  useEffect(() => {
    if (appLoading || demoMode) return
    if (autoSyncedUsernameRef.current) return
    if (configRef.current?.partnerUsername) { autoSyncedUsernameRef.current = true; return }
    if (!partnerUsername || partnerUsername === 'athlete') return
    autoSyncedUsernameRef.current = true
    handleSetUsername(partnerUsername)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appLoading])

  async function authHeaders() {
    if (usernameSession?.username && usernameSession?.token) {
      return {
        'X-Username-Auth': usernameSession.username,
        'X-Username-Token': usernameSession.token,
      }
    }
    let token = null
    for (let attempt = 0; attempt < 5; attempt += 1) {
      token = await getToken()
      if (token) break
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    if (!token) throw new Error('Auth token unavailable')
    cachedTokenRef.current = token
    return { 'Authorization': `Bearer ${token}` }
  }

  function changedFields(prev, next) {
    const patch = {}
    const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])
    for (const key of keys) {
      const before = prev?.[key]
      const after = next?.[key]
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        patch[key] = after === undefined ? null : after
      }
    }
    return patch
  }

  async function loadAll(isRetry = false) {
    try {
      const res = await fetch(`${API}/api/log?date=${TODAY()}`, { headers: await authHeaders(), cache: 'no-store' })
      if (!res.ok) {
        if (!isRetry) setTimeout(() => loadAll(true), 2000)
        else setAppLoading(false)
        return
      }
      const data = await res.json()
      // If the server is on a newer deployment, reload so stale cached JS doesn't persist
      const incomingDeployId = data.deploymentId
      if (window.__deploymentId && incomingDeployId && window.__deploymentId !== incomingDeployId) {
        window.location.reload()
        return
      }
      if (incomingDeployId) window.__deploymentId = incomingDeployId
      lastLoadRef.current = Date.now()
      const cfg = data.config || {}
      const cfgCustom   = cfg.customExercises || []
      const cfgGoals    = cfg.goals || {}
      const cfgPS       = cfg.plateSettings || {}
      const cfgPlateOrder = Array.isArray(cfg.plateOrder) ? cfg.plateOrder : []
      const cfgToken    = cfg.voiceToken || null
      const cfgOuraPAT  = cfg.ouraPAT || null
      const cfgFavs     = cfg.favorites || []
      const cfgNutr     = cfg.nutritionGoals || DEFAULT_NUTRITION_GOALS
      const cfgSupplements = Array.isArray(cfg.supplements) ? cfg.supplements : []
      const cfgBooksConfig = (() => {
        if (Array.isArray(cfg.booksConfig?.books) && cfg.booksConfig.books.length > 0) return cfg.booksConfig
        try {
          const ls = JSON.parse(localStorage.getItem('tl-books-backup') || 'null')
          if (Array.isArray(ls?.books) && ls.books.length > 0) return ls
        } catch {}
        return cfg.booksConfig || { books: [] }
      })()
      const cfgMilestoneRewardsRaw = Array.isArray(cfg.milestoneRewards) ? cfg.milestoneRewards : []
      const cfgMilestoneRewards = migrateLegacyRewards(cfgMilestoneRewardsRaw)
      const rewardsMigrated = cfgMilestoneRewards !== cfgMilestoneRewardsRaw
      const cfgShare    = cfg.shareToken || null
      const cfgSharing  = cfg.sharingSettings || DEFAULT_SHARING
      const cfgReminders = normalizeReminderSettings(cfg.reminderSettings)
      const cfgPartnerUsername = cfg.partnerUsername || null
      const cfgLinkPartners = (cfg.linkPartners || []).map(p => ({ token: p.token || p.userId, username: p.username || 'partner' }))
      const loadedConfig = { customExercises: cfgCustom, goals: cfgGoals, voiceToken: cfgToken, ouraPAT: cfgOuraPAT, plateSettings: cfgPS, plateOrder: cfgPlateOrder, favorites: cfgFavs, nutritionGoals: cfgNutr, supplements: cfgSupplements, shareToken: cfgShare, sharingSettings: cfgSharing, reminderSettings: cfgReminders, partnerUsername: cfgPartnerUsername, profile: cfg.profile || {}, linkPartners: cfgLinkPartners, booksConfig: cfgBooksConfig, milestoneRewards: cfgMilestoneRewards }
      const rawToday = { ...defaultDayData(), ...(data.today || {}) }
      const migrated = removeBuiltinDuplicateCustomExercises(loadedConfig, rawToday)
      const activeConfig = migrated.config
      const incomingToday = migrated.today
      if (migrated.duplicates.length > 0) {
        const todayPatch = {}
        const mergeGroups = new Map()
        for (const { customId, builtinId } of migrated.duplicates) {
          todayPatch[builtinId] = incomingToday[builtinId]
          todayPatch[customId] = null
          mergeGroups.set(builtinId, [...(mergeGroups.get(builtinId) || []), customId])
        }
        Promise.resolve(authHeaders()).then(headers => Promise.all([
          fetch(`${API}/api/log`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_config', config: activeConfig }),
          }),
          fetch(`${API}/api/log`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_day', date: TODAY(), data: todayPatch }),
          }),
          ...Array.from(mergeGroups, ([toId, fromIds]) => fetch(`${API}/api/log`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'merge_exercise_data', fromIds, toId }),
          })),
        ])).catch(() => {})
      }
      if (rewardsMigrated) {
        Promise.resolve(authHeaders()).then(headers =>
          fetch(`${API}/api/log`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_config', config: activeConfig }),
          })
        ).catch(() => {})
      }
      if (!pendingSaveRef.current || pendingSaveRef.current.date !== TODAY()) {
        setDayData(incomingToday)
      }
      // Don't overwrite config state if a save is in flight — keep optimistic values
      if (!configSavingRef.current) {
        setCustom(activeConfig.customExercises || [])
        setGoals(activeConfig.goals || {})
        setPlateSettings(activeConfig.plateSettings || {})
        setPlateOrder(activeConfig.plateOrder || [])
        setVoiceToken(activeConfig.voiceToken || null)
        setOuraPAT(activeConfig.ouraPAT || null)
        setFavorites(activeConfig.favorites || [])
        setNutritionGoals(activeConfig.nutritionGoals || DEFAULT_NUTRITION_GOALS)
        setSupplements(activeConfig.supplements || [])
        setBooksConfig(activeConfig.booksConfig || { books: [] })
        setMilestoneRewards(activeConfig.milestoneRewards || [])
        setShareToken(activeConfig.shareToken || null)
        setSharingSettings(activeConfig.sharingSettings || DEFAULT_SHARING)
        setReminderSettings(activeConfig.reminderSettings || DEFAULT_REMINDER_SETTINGS)
        setProfile(activeConfig.profile || {})
        if (activeConfig.partnerUsername) setSavedUsername(activeConfig.partnerUsername)
        setLinkPartners(activeConfig.linkPartners || [])
        configRef.current = activeConfig
      }
      setHistory(data.history || [])
      setAppLoading(false)
      fetchWeightLog()
    } catch {
      if (!isRetry) setTimeout(() => loadAll(true), 2000)
      else setAppLoading(false)
    }
  }

  async function applyUrlParams() {
    const params = new URLSearchParams(window.location.search)
    const stepsStr = params.get('steps')
    if (!stepsStr) return
    const steps = parseInt(stepsStr)
    if (isNaN(steps) || steps < 0) return
    window.history.replaceState({}, '', window.location.pathname)
    const targetDate = params.get('date') || TODAY()
    try {
      const hdrs = await authHeaders()
      await fetch(`${API}/api/log`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_day', date: targetDate, data: { steps } }),
      })
      if (targetDate === TODAY()) await loadAll()
    } catch {}
  }

  function scheduleSave(patch, options = {}) {
    if (demoMode) return
    if (!patch || Object.keys(patch).length === 0) return
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    const date = TODAY()
    const pending = pendingSaveRef.current
    pendingSaveRef.current = {
      date,
      patch: pending?.date === date ? mergeSavePatches(pending.patch, patch) : patch,
      retries: 0,
    }
    saveTimer.current = setTimeout(() => persistDay(pendingSaveRef.current), options.immediate ? 0 : 500)
  }

  async function persistDay(pending) {
    saveTimer.current = null
    savingRef.current = true
    pendingSaveRef.current = null
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/log`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_day', date: pending.date, data: pending.patch }),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      const saved = await res.json().catch(() => null)
      if (saved?.data && pending.date === TODAY()) {
        setDayData(prev => ({ ...prev, ...saved.data }))
      }
      savingRef.current = false
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch {
      savingRef.current = false
      setSaveStatus('error')
      const retries = (pending.retries || 0) + 1
      if (retries <= 4) {
        const delay = Math.min(1000 * retries, 8000)
        pendingSaveRef.current = { ...pending, retries }
        saveTimer.current = setTimeout(() => persistDay(pendingSaveRef.current), delay)
      }
    }
  }

  async function persistConfig(cfg, attempt = 0) {
    if (demoMode) return

    // Serialize saves: if one is already in flight, mark dirty and return.
    // The in-flight save's completion handler will trigger another save
    // with the latest configRef.current, preventing race-condition overwrites.
    if (attempt === 0 && configSavingRef.current) {
      configDirtyRef.current = true
      return
    }

    configSavingRef.current = true
    configDirtyRef.current = false
    setSaveStatus('saving')

    // Always save the LATEST config snapshot — callers update configRef before
    // calling us, so this is always the most current state even across concurrent calls.
    const latest = configRef.current
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/log`, {
        method: 'POST',
        keepalive: true,
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_config', config: latest }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      configSavingRef.current = false
      if (configDirtyRef.current) {
        // Config changed while this save was in flight — immediately resave
        configDirtyRef.current = false
        persistConfig(configRef.current, 0)
      } else {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(null), 2000)
      }
    } catch {
      if (attempt < 3) {
        setTimeout(() => persistConfig(configRef.current, attempt + 1), Math.min(1000 * (attempt + 1), 4000))
      } else {
        configSavingRef.current = false
        configDirtyRef.current = false
        setSaveStatus('error')
      }
    }
  }

  function handleDayChange(newData) {
    const patch = changedFields(dayData, newData)
    setDayData(newData)
    scheduleSave(patch)
    if (!demoMode) {
      const newPRs = detectPRs(newData, history, customExercises)
      for (const pr of newPRs) {
        const key = `${pr.exercise}-${pr.display}`
        if (!shownPRsRef.current.has(key)) {
          shownPRsRef.current.add(key)
          setPrToast(pr)
          break
        }
      }
    }
  }

  function handleStepsUpdate(steps) {
    setDayData(prev => ({ ...prev, steps }))
    scheduleSave({ steps })
  }

  function handleSleepChange(sleepHours) {
    setDayData(prev => ({ ...prev, sleepHours }))
    scheduleSave({ sleepHours })
  }

  function handleSleepClear() {
    setDayData(prev => {
      const { sleepHours, sleepLog, sleepBedAt, sleepWakeAt, ...rest } = prev
      return rest
    })
    scheduleSave({ sleepHours: null, sleepLog: null, sleepBedAt: null, sleepWakeAt: null })
  }

  function handleSetOuraPAT(pat) {
    const cleaned = (pat || '').trim()
    setOuraPAT(cleaned || null)
    configRef.current = { ...configRef.current, ouraPAT: cleaned || null }
    persistConfig(configRef.current)
  }

  function handleMealsChange(newMeals, options = {}) {
    const newData = { ...dayData, meals: newMeals }
    setDayData(newData)
    scheduleSave({ meals: newMeals }, options)
  }

  function handleAddCustom(ex) {
    const builtinId = BUILTIN_PLATE_NAME_TO_ID.get(normalizeExerciseName(ex?.name))
    if (builtinId) {
      const currentOrder = configRef.current.plateOrder || []
      const nextOrder = currentOrder.includes(builtinId) ? currentOrder : [...currentOrder, builtinId]
      setPlateOrder(nextOrder)
      configRef.current = { ...configRef.current, plateOrder: nextOrder }
      persistConfig(configRef.current)
      return
    }
    const updated = [...customExercises, ex]
    setCustom(updated)
    configRef.current = { ...configRef.current, customExercises: updated, plateOrder: [...(configRef.current.plateOrder || []), ex.id] }
    setPlateOrder(configRef.current.plateOrder)
    persistConfig(configRef.current)
  }

  function handleDeleteCustom(id) {
    const updated = customExercises.filter(e => e.id !== id)
    setCustom(updated)
    const nextOrder = (configRef.current.plateOrder || []).filter(pid => pid !== id)
    setPlateOrder(nextOrder)
    configRef.current = { ...configRef.current, customExercises: updated, plateOrder: nextOrder }
    persistConfig(configRef.current)
    setDayData(d => {
      const c = { ...d }
      delete c[id]
      scheduleSave({ [id]: null })
      return c
    })
  }

  function handleSetGoal(exId, value) {
    const newGoals = { ...configRef.current.goals }
    if (value != null && value > 0) { newGoals[exId] = value }
    else { delete newGoals[exId] }
    setGoals(newGoals)
    configRef.current = { ...configRef.current, goals: newGoals }
    persistConfig(configRef.current)
  }

  function handleSetPlateSettings(exId, settings) {
    const newSettings = { ...configRef.current.plateSettings, [exId]: settings }
    setPlateSettings(newSettings)
    configRef.current = { ...configRef.current, plateSettings: newSettings }
    persistConfig(configRef.current)
  }

  function handlePlateOrderChange(nextOrder) {
    const updated = Array.isArray(nextOrder) ? nextOrder : []
    setPlateOrder(updated)
    configRef.current = { ...configRef.current, plateOrder: updated }
    persistConfig(configRef.current)
  }

  function handleWaterChange(water) {
    const newData = { ...dayData, water }
    setDayData(newData)
    scheduleSave({ water })
  }

  function handleFavoritesChange(newFavs) {
    setFavorites(newFavs)
    configRef.current = { ...configRef.current, favorites: newFavs }
    persistConfig(configRef.current)
  }

  function handleNutritionGoalsChange(newGoals) {
    setNutritionGoals(newGoals)
    configRef.current = { ...configRef.current, nutritionGoals: newGoals }
    persistConfig(configRef.current)
  }

  function handleSupplementsChange(newSupplements) {
    setSupplements(newSupplements)
    configRef.current = { ...configRef.current, supplements: newSupplements }
    persistConfig(configRef.current)
  }

  function handleBooksConfigChange(newBooksConfig) {
    setBooksConfig(newBooksConfig)
    configRef.current = { ...configRef.current, booksConfig: newBooksConfig }
    try { localStorage.setItem('tl-books-backup', JSON.stringify(newBooksConfig)) } catch {}
    persistConfig(configRef.current)
  }

  function handleSharingChange(key, newVal) {
    const updated = { ...sharingSettings, [key]: newVal }
    setSharingSettings(updated)
    configRef.current = { ...configRef.current, sharingSettings: updated }
    persistConfig(configRef.current)
  }


  function handleMilestoneRewardsChange(nextRewards) {
    const updated = Array.isArray(nextRewards) ? nextRewards : []
    setMilestoneRewards(updated)
    configRef.current = { ...configRef.current, milestoneRewards: updated }
    persistConfig(configRef.current)
  }

  function handleReminderSettingsChange(nextSettings) {
    const updated = normalizeReminderSettings(nextSettings)
    setReminderSettings(updated)
    configRef.current = { ...configRef.current, reminderSettings: updated }
    persistConfig(configRef.current)
  }

  function handleSaveProfile(newProfile) {
    setProfile(newProfile)
    configRef.current = { ...configRef.current, profile: newProfile }
    persistConfig(configRef.current)
  }

  function handleSetUsername(newUsername) {
    setSavedUsername(newUsername)
    configRef.current = { ...configRef.current, partnerUsername: newUsername }
    persistConfig(configRef.current)
  }

  async function handleGenerateShareToken(usernameOverride) {
    const token = crypto.randomUUID()
    const username = usernameOverride || partnerUsername
    setShareToken(token)
    configRef.current = { ...configRef.current, shareToken: token, partnerUsername: username }
    persistConfig(configRef.current)
  }

  async function fetchWeightLog() {
    if (demoMode) return
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/health-metrics?metric=weight`, { headers: hdrs })
      if (res.ok) {
        const data = await res.json()
        setWeightLog(data.entries || [])
      }
    } catch {}
  }

  async function handleLogWeight(lbs, notes) {
    try {
      const hdrs = await authHeaders()
      await fetch(`${API}/api/health-metrics?metric=weight`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TODAY(), weight_lbs: lbs, notes }),
      })
      await fetchWeightLog()
    } catch {}
  }

  function handleAddLinkPartner({ token, username }) {
    const updated = [{ token, username }, ...linkPartners.filter(p => p.token !== token)].slice(0, 20)
    setLinkPartners(updated)
    configRef.current = { ...configRef.current, linkPartners: updated }
    persistConfig(configRef.current)
  }

  function handleRemoveLinkPartner(token) {
    const updated = linkPartners.filter(p => p.token !== token)
    setLinkPartners(updated)
    configRef.current = { ...configRef.current, linkPartners: updated }
    persistConfig(configRef.current)
  }

  const partnerUsername = (() => {
    const email = user?.primaryEmailAddress?.emailAddress || ''
    const raw = savedUsername || usernameSession?.username || user?.username || user?.fullName || user?.firstName || email.split('@')[0] || profile?.username || 'athlete'
    return String(raw)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'athlete'
  })()

  const adminUserIds = String(import.meta.env.VITE_ADMIN_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
  const adminUsernames = String(import.meta.env.VITE_ADMIN_USERNAMES || '')
    .split(',')
    .map(name => name.trim().toLowerCase())
    .filter(Boolean)
  const showAdminNav = new URLSearchParams(window.location.search).get('admin') === '1'
    || (user?.id && adminUserIds.includes(user.id))
    || (usernameSession?.username && adminUsernames.includes(usernameSession.username.toLowerCase()))

  async function handleRegenToken() {
    setRegen(true)
    try {
      const hdrs = await authHeaders()
      const res = await fetch(`${API}/api/log`, {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_voice_token' }),
      })
      const data = await res.json()
      if (data.voiceToken) { setVoiceToken(data.voiceToken); configRef.current = { ...configRef.current, voiceToken: data.voiceToken } }
    } catch {}
    setRegen(false)
  }

  const dashboardRecap = useMemo(
    () => computeRecap(dayData, history, customExercises),
    [dayData, history, customExercises]
  )
  const allTimeRecords = useMemo(
    () => calcAllTimeRecords(history, dayData, customExercises),
    [history, dayData, customExercises]
  )
  const journeyStartDate = useMemo(() => {
    if (!history || history.length === 0) return null
    const earliest = history.reduce((min, d) => d.date < min ? d.date : min, history[0].date)
    return new Date(earliest + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [history])

  // â"€â"€ Loading (Clerk initialising) â"€â"€
  if (!isLoaded || !authLoaded) {
    return (
      <div className="auth-screen auth-loading-screen">
        <div className="auth-loading-stage">
          <div className="auth-icon auth-loading"></div>
        </div>
      </div>
    )
  }

  // â"€â"€ Not signed in â"€â"€
  if (!isSignedIn && !demoMode && !usernameSession) return <SignInScreen onDemo={enterDemo} onUsernameAuth={handleUsernameAuth} />

  // â"€â"€ Data loading â"€â"€
  if (appLoading) {
    return (
      <div className="auth-screen auth-loading-screen">
        <div className="auth-loading-stage">
          <div className="auth-icon auth-loading"></div>
        </div>
        <div className="auth-loading-text">{t('app_loading')}</div>
      </div>
    )
  }

  // â"€â"€ App â"€â"€
  return (
    <LanguageContext.Provider value={language}>
    <div className="app">
      <ReminderScheduler settings={reminderSettings} dayData={dayData} nutritionGoals={nutritionGoals} />
      {menuOpen && <div className="sidebar-drawer-overlay" onClick={() => setMenuOpen(false)} />}
      <aside className={`app-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <img className="sidebar-brand-icon" src="/growth-coin.png" alt="Growth Mirror logo" />
          <span className="sidebar-brand-name">Growth Mirror</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`sidebar-tab ${view === 'today' ? 'active' : ''}`}
            onClick={() => { setView('today'); setMenuOpen(false); if (!demoMode && !saveTimer.current && !savingRef.current) loadAll() }}>
            <span>📅</span><span>{t('nav_today')}</span>
          </button>
          <button className={`sidebar-tab ${view === 'meals' ? 'active' : ''}`}
            onClick={() => { setView('meals'); setMenuOpen(false); if (!demoMode && !saveTimer.current && !savingRef.current) loadAll() }}>
            <span>🍽️</span><span>{t('nav_meals')}</span>
          </button>
          <button className={`sidebar-tab ${view === 'history' ? 'active' : ''}`}
            onClick={() => { setView('history'); setMenuOpen(false); if (!demoMode && !saveTimer.current && !savingRef.current) loadAll() }}>
            <span>📊</span><span>{t('nav_personal')}</span>
          </button>
          <button className={`sidebar-tab ${view === 'rewards' ? 'active' : ''}`}
            onClick={() => { setView('rewards'); setMenuOpen(false) }}>
            <span>🎁</span><span>Milestone Rewards</span>
          </button>
          <button className={`sidebar-tab ${view === 'partners' ? 'active' : ''}`}
            onClick={() => { setView('partners'); setMenuOpen(false) }}>
            <span>🤝</span><span>{t('nav_partners')}</span>
          </button>
          {showAdminNav && (
            <button className={`sidebar-tab ${view === 'admin' ? 'active' : ''}`}
              onClick={() => { setView('admin'); setMenuOpen(false) }}>
              <span>🛡️</span><span>Admin</span>
            </button>
          )}
          <button className={`sidebar-tab ${view === 'settings' ? 'active' : ''}`}
            onClick={() => { setView('settings'); setMenuOpen(false) }}>
            <span>⚙️</span><span>{t('nav_settings')}</span>
          </button>
        </nav>
        <div className="sidebar-actions">
          {demoMode && (
            <button
              onClick={() => setDemoMode(false)}
              style={{
                width: '100%', background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '9px 8px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t('sign_in_free')}
            </button>
          )}
          {saveStatus && (
            <span className={`save-indicator save-${saveStatus}`}>
              {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? `✓ ${t('app_saved')}` : `✗ ${t('app_error')}`}
            </span>
          )}
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </aside>

      <div className="app-body">
        <header className="app-header">
          <button className="hamburger-btn" onClick={() => setMenuOpen(m => !m)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <h1>Growth Mirror</h1>
          <div className="header-right">
            {saveStatus && (
              <span className={`save-indicator save-${saveStatus}`}>
                {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? `✓ ${t('app_saved')}` : `✗ ${t('app_error')}`}
              </span>
            )}
          </div>
        </header>

        {demoMode && (
          <div style={{
            background: 'linear-gradient(90deg, #7c3aed22, #3B260F22)',
            borderBottom: '1.5px solid #3B260F55',
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
              {t('app_demo_mode')}
            </span>
            <button
              onClick={() => setDemoMode(false)}
              style={{
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '6px 14px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {t('sign_in_free')}
            </button>
          </div>
        )}

        <main className="main-content">
          {view === 'today' && (
            <>
              {journeyStartDate && (
                <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.4px', marginBottom: 10, opacity: 0.7 }}>
                  journey started {journeyStartDate}
                </div>
              )}
              <ProgressChart history={history} dayData={dayData} customExercises={customExercises} theme={theme} />
              <DashboardAssistant
                dayData={dayData}
                history={history}
                customExercises={customExercises}
                goals={goals}
                nutritionGoals={nutritionGoals}
                records={allTimeRecords}
                recap={dashboardRecap}
                authHeaders={authHeaders}
              />
              {/* ── Wellness section ── */}
              <div style={{ marginBottom: 12 }}>
                <div className="grid-header" style={{ marginBottom: 10 }}>
                  <span className="grid-date" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Wellness</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                  <div onClick={() => setDetailPanel('steps')} style={{ cursor: 'pointer' }}>
                    <StepsCard
                      dayData={dayData}
                      authHeaders={authHeaders}
                      onStepsUpdate={handleStepsUpdate}
                      stepGoal={getEffGoal(goals, 'steps') || 10000}
                      compact
                    />
                  </div>
                  <div onClick={() => setDetailPanel('water')} style={{ cursor: 'pointer' }}>
                    <WaterRing
                      water={dayData.water || 0}
                      goal={nutritionGoals?.water || 8}
                      onChange={handleWaterChange}
                      compact
                    />
                  </div>
                  <div onClick={() => setDetailPanel('sleep')} style={{ cursor: 'pointer' }}>
                    <SleepTracker
                      sleepHours={dayData.sleepHours || 0}
                      sleepLog={dayData.sleepLog || []}
                      history={history}
                      onChange={handleSleepChange}
                      authHeaders={authHeaders}
                      ouraPAT={ouraPAT}
                      onSaveOuraPAT={handleSetOuraPAT}
                      compact
                    />
                  </div>
                </div>
                <div className="plate-grid">
                  <MeditationTile
                    value={dayData.meditation || 0}
                    onChange={v => handleDayChange({ ...dayData, meditation: v })}
                    onDetail={() => setMeditationDetailOpen(true)}
                    goal={getEffGoal(goals, 'meditation')}
                  />
                  <BooksTile
                    sessions={dayData.books || 0}
                    booksConfig={booksConfig}
                    onAddSession={v => handleDayChange({ ...dayData, books: v })}
                    onDetail={() => setBooksDetailOpen(true)}
                  />
                </div>
              </div>

              {/* ── Detail sheets ── */}
              {detailPanel === 'steps' && (
                <TrackerSheet title="Steps" onClose={() => setDetailPanel(null)}>
                  <StepsHistory
                    authHeaders={authHeaders}
                    stepGoal={getEffGoal(goals, 'steps') || 10000}
                    dayData={dayData}
                  />
                </TrackerSheet>
              )}

              {detailPanel === 'water' && (
                <TrackerSheet title="Hydration" onClose={() => setDetailPanel(null)}>
                  <WaterRing
                    water={dayData.water || 0}
                    goal={nutritionGoals?.water || 8}
                    onChange={handleWaterChange}
                  />
                  <WaterHistory
                    history={history}
                    dayData={dayData}
                    goal={nutritionGoals?.water || 8}
                  />
                </TrackerSheet>
              )}

              {detailPanel === 'sleep' && (
                <TrackerSheet title="Sleep Cycle" onClose={() => setDetailPanel(null)}>
                  <SleepTracker
                    sleepHours={dayData.sleepHours || 0}
                    sleepLog={dayData.sleepLog || []}
                    history={history}
                    onChange={handleSleepChange}
                    onClear={handleSleepClear}
                    authHeaders={authHeaders}
                    ouraPAT={ouraPAT}
                    onSaveOuraPAT={handleSetOuraPAT}
                  />
                </TrackerSheet>
              )}

              <PlateGrid
                dayData={dayData}
                customExercises={customExercises}
                onChange={handleDayChange}
                onAddCustom={handleAddCustom}
                onDeleteCustom={handleDeleteCustom}
                goals={goals}
                onSetGoal={handleSetGoal}
                plateSettings={plateSettings}
                onSetPlateSettings={handleSetPlateSettings}
                plateOrder={plateOrder}
                onDetail={setDetailDef}
                history={history}
              />

              {dayData.rest && (
                <div style={{
                  width: '100%', padding: '12px', marginTop: 10, boxSizing: 'border-box',
                  background: 'var(--surface)', border: '1.5px solid #8b5cf644',
                  borderRadius: 12, textAlign: 'center', color: '#8b5cf6',
                  fontSize: 14, fontWeight: 600,
                }}>
                  ✓ Rest Day
                </div>
              )}
            </>
          )}
          {view === 'meals' && (
            <MealsSection
              meals={dayData.meals}
              water={dayData.water || 0}
              onChange={handleMealsChange}
              onWaterChange={handleWaterChange}
              favorites={favorites}
              onFavoritesChange={handleFavoritesChange}
              nutritionGoals={nutritionGoals}
              onNutritionGoalsChange={handleNutritionGoalsChange}
              history={history}
              authHeaders={authHeaders}
              supplements={supplements}
              onSupplementsChange={handleSupplementsChange}
            />
          )}
          {view === 'history' && (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                background: 'var(--surface)', border: '1.5px solid var(--border)',
                borderRadius: 14, padding: 6, marginBottom: 14,
              }}>
                {[
                  ['overview', 'Overview'],
                  ['prs', 'PRs'],
                  ['history', 'History'],
                  ['labs', 'Labs'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPersonalTab(id)}
                    style={{
                      border: 'none', borderRadius: 10, padding: '10px 4px',
                      background: personalTab === id ? 'var(--accent)' : 'transparent',
                      color: personalTab === id ? '#fff' : 'var(--muted)',
                      fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {personalTab === 'overview' && (
                <PersonalOverview
                  history={history}
                  dayData={dayData}
                  customExercises={customExercises}
                  authHeaders={authHeaders}
                  profile={profile}
                  onSaveProfile={handleSaveProfile}
                />
              )}
              {personalTab === 'prs' && (
                <YourRecords history={history} dayData={dayData} customExercises={customExercises} />
              )}
              {personalTab === 'history' && (
                <HistoryView history={history} customExercises={customExercises} />
              )}
              {personalTab === 'labs' && (
                <LabsView authHeaders={authHeaders} />
              )}
            </>
          )}
          {view === 'partners' && (
            <PartnerPage
              shareToken={shareToken}
              partnerUsername={partnerUsername}
              onGenerateToken={handleGenerateShareToken}
              authHeaders={authHeaders}
              linkPartners={linkPartners}
              onAddLinkPartner={handleAddLinkPartner}
              onRemoveLinkPartner={handleRemoveLinkPartner}
            />
          )}
          {view === 'rewards' && (
            <MilestoneRewards
              rewards={milestoneRewards}
              onChange={handleMilestoneRewardsChange}
              goals={goals}
              customExercises={customExercises}
              nutritionGoals={nutritionGoals}
              dayData={dayData}
              history={history}
              booksConfig={booksConfig}
            />
          )}
          {view === 'admin' && showAdminNav && (
            <AdminUsers authHeaders={authHeaders} />
          )}
          {view === 'settings' && (
            <Settings
              goals={goals}
              customExercises={customExercises}
              plateSettings={plateSettings}
              plateOrder={plateOrder}
              onPlateOrderChange={handlePlateOrderChange}
              onPlateSettingsChange={handleSetPlateSettings}
              onDeleteCustom={handleDeleteCustom}
              onSetGoal={handleSetGoal}
              onSaveGoals={() => persistConfig(configRef.current)}
              saveStatus={saveStatus}
              voiceToken={voiceToken}
              onRegenToken={handleRegenToken}
              regenLoading={regenLoading}
              theme={theme}
              onToggleTheme={toggleTheme}
              language={language}
              onSetLanguage={setLanguage}
              signOut={handleSignOut}
              history={history}
              dayData={dayData}
              sharingSettings={sharingSettings}
              onSharingChange={handleSharingChange}
              reminderSettings={reminderSettings}
              onReminderSettingsChange={handleReminderSettingsChange}
              authHeaders={authHeaders}
              partnerUsername={partnerUsername}
              onSetUsername={handleSetUsername}
              ouraPAT={ouraPAT}
              onSaveOuraPAT={handleSetOuraPAT}
            />
          )}
        </main>

      </div>
      {detailDef && (
        <ExerciseDetail
          def={detailDef}
          history={history}
          goals={goals}
          dayData={dayData}
          onBack={() => setDetailDef(null)}
          theme={theme}
          authHeaders={demoMode ? null : authHeaders}
          onRefresh={loadAll}
        />
      )}
      {meditationDetailOpen && (
        <MeditationDetail
          history={history}
          dayData={dayData}
          goals={goals}
          onBack={() => setMeditationDetailOpen(false)}
          theme={theme}
          authHeaders={demoMode ? null : authHeaders}
          onRefresh={loadAll}
        />
      )}
      {booksDetailOpen && (
        <BooksDetail
          booksConfig={booksConfig}
          onBooksConfigChange={handleBooksConfigChange}
          history={history}
          dayData={dayData}
          onBack={() => setBooksDetailOpen(false)}
        />
      )}
      {prToast && (
        <PRToast pr={prToast} onDismiss={() => setPrToast(null)} />
      )}
    </div>
    </LanguageContext.Provider>
  )
}
