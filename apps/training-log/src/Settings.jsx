import { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useT } from './LanguageContext.jsx'

const BUILTIN_PLATES = [
  { id: 'pushups',   name: 'Push-ups',    color: '#4A90D9' },
  { id: 'squats',    name: 'Squats',      color: '#27AE60' },
  { id: 'situps',    name: 'Sit-ups',     color: '#E8A020' },
  { id: 'pullups',   name: 'Pull-ups',    color: '#C0392B' },
  { id: 'dips',      name: 'Dips',        color: '#10B981' },
  { id: 'dead_hang', name: 'Dead Hang',   color: '#0EA5E9', type: 'timed' },
  { id: 'curls',     name: 'Curls',       color: '#7B3FA0' },
  { id: 'bench',     name: 'Bench Press', color: '#C25E1A' },
]

const DEFAULT_GOALS = {
  pushups: 50, squats: 50, situps: 50, pullups: 10, dips: 50,
  dead_hang: 60, curls: 30, bench: 30,
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
]

const SHARE_ITEMS = [
  { key: 'streak',   label: 'Streak',          desc: 'Days in a row' },
  { key: 'daily',    label: 'Daily rep total', desc: "Today's combined rep count" },
  { key: 'pushups',  label: 'Push-ups',        desc: null },
  { key: 'squats',   label: 'Squats',          desc: null },
  { key: 'situps',   label: 'Sit-ups',         desc: null },
  { key: 'pullups',  label: 'Pull-ups',        desc: null },
  { key: 'curls',    label: 'Curls',           desc: null },
  { key: 'bench',    label: 'Bench press',     desc: null },
  { key: 'steps',    label: 'Steps',           desc: null },
  { key: 'meals',    label: 'Meals',           desc: null },
  { key: 'history',  label: 'Progress history', desc: 'Full chart visible to partners' },
]

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
const TILE_COLORS = ['#4A90D9', '#27AE60', '#E8A020', '#C0392B', '#7B3FA0', '#C25E1A', '#0EA5E9', '#14B8A6', '#EC4899', '#8B5CF6', '#F97316', '#64748B']

function normalizeExerciseName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

const BUILTIN_NAME_IDS = new Set(BUILTIN_PLATES.map(p => normalizeExerciseName(p.name)))
const BUILTIN_IDS = new Set(BUILTIN_PLATES.map(p => p.id))

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function Settings({
  goals, customExercises, plateSettings = {}, plateOrder = [], onPlateOrderChange, onPlateSettingsChange, onDeleteCustom, onSetGoal, onSaveGoals,
  voiceToken, onRegenToken, regenLoading,
  theme, onToggleTheme, language, onSetLanguage, signOut, history, dayData = {},
  sharingSettings = {}, onSharingChange,
  reminderSettings = {}, onReminderSettingsChange,
  authHeaders,
  saveStatus,
  partnerUsername, onSetUsername,
  ouraPAT, onSaveOuraPAT,
}) {
  const t = useT()
  const { user } = useUser()
  const [editingGoal,    setEditingGoal]    = useState(null)
  const [copied,         setCopied]         = useState(false)
  const [copiedHealth,   setCopiedHealth]   = useState(false)
  const [copiedVoiceUrl, setCopiedVoiceUrl] = useState(false)
  const [copiedVoiceBody, setCopiedVoiceBody] = useState(false)
  const [showToken,      setShowToken]      = useState(false)
  const [confirmDel,     setConfirmDel]     = useState(null)
  const [editingUsername, setEditingUsername] = useState(false)
  const [showReorder, setShowReorder] = useState(false)
  const [usernameInput,   setUsernameInput]   = useState('')
  const [usernameSaved,   setUsernameSaved]   = useState(false)
  const [ouraInput,      setOuraInput]      = useState('')
  const [ouraEditing,    setOuraEditing]    = useState(false)
  const [ouraSaved,      setOuraSaved]      = useState(false)
  const [notificationPermission, setNotificationPermission] = useState(() => (
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  ))
  const [pushStatus, setPushStatus] = useState('idle')
  const [pushError, setPushError] = useState('')
  const [pushRegistered, setPushRegistered] = useState(false)

  const duplicateBuiltinCustomIds = new Set((customExercises || [])
    .filter(e => BUILTIN_IDS.has(e?.id) || BUILTIN_NAME_IDS.has(normalizeExerciseName(e?.name)))
    .map(e => e.id))
  const basePlates = [
    ...BUILTIN_PLATES,
    ...(customExercises || [])
      .filter(e => !duplicateBuiltinCustomIds.has(e.id))
      .map(e => ({ id: e.id, name: e.name, color: e.color, type: e.type, isCustom: true })),
  ].map(p => ({ ...p, color: plateSettings?.[p.id]?.color || p.color }))
  const allPlates = [
    ...(plateOrder || []).map(id => basePlates.find(p => p.id === id)).filter(Boolean),
    ...basePlates.filter(p => !(plateOrder || []).includes(p.id)),
  ]
  const safeSharing = { ...Object.fromEntries(SHARE_ITEMS.map(item => [item.key, true])), ...sharingSettings }
  const safeReminders = {
    enabled: false,
    workout: { enabled: true, time: '09:00' },
    meals: { enabled: false, time: '12:00' },
    water: { enabled: false, time: '15:00' },
    sleep: { enabled: false, time: '22:30' },
    ...reminderSettings,
  }
  for (const key of ['workout', 'meals', 'water', 'sleep']) {
    safeReminders[key] = {
      ...(key === 'workout' ? { enabled: true, time: '09:00' } : key === 'meals' ? { enabled: false, time: '12:00' } : key === 'water' ? { enabled: false, time: '15:00' } : { enabled: false, time: '22:30' }),
      ...(reminderSettings?.[key] || {}),
    }
  }
  const remindersSupported = notificationPermission !== 'unsupported'
  const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && remindersSupported
  const pushReady = pushSupported && Boolean(VAPID_PUBLIC_KEY)
  const voiceEndpoint = window.location.origin + '/api/voice'
  const voiceJsonBody = '{\n  "text": "Provided Input"\n}'

  function isLoggedDay(d) {
    return Object.entries(d || {}).some(([k, v]) => {
      if (k === 'date' || k === 'steps') return false
      if (k === 'meals') return Array.isArray(v) ? v.length > 0 : Number(v) > 0
      if (k === 'water') return Number(v) > 0
      return (typeof v === 'number' && v > 0) || (v?.reps > 0)
    })
  }

  function isActiveDay(d) {
    return Object.entries(d || {}).some(([k, v]) => {
      if (k === 'date' || k === 'meals' || k === 'water' || k === 'steps') return false
      return (typeof v === 'number' && v > 0) || (v?.reps > 0)
    })
  }

  // history from the server excludes today — add today if it has any non-step log data
  const hasDataToday  = isLoggedDay(dayData)
  const totalDays     = history.filter(isLoggedDay).length + (hasDataToday ? 1 : 0)
  const activeDays    = history.filter(isActiveDay).length + (isActiveDay(dayData) ? 1 : 0)

  useEffect(() => {
    if (!pushSupported) return undefined
    let cancelled = false
    navigator.serviceWorker.getRegistration('/sw.js')
      .then(reg => reg?.pushManager.getSubscription())
      .then(sub => { if (!cancelled) setPushRegistered(Boolean(sub)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [pushSupported])

  function copyHealthUrl() {
    const url = window.location.origin + '/?steps='
    navigator.clipboard.writeText(url).then(() => {
      setCopiedHealth(true); setTimeout(() => setCopiedHealth(false), 2000)
    })
  }

  function copyToken() {
    if (!voiceToken) return
    navigator.clipboard.writeText(voiceToken).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  function copyVoiceEndpoint() {
    navigator.clipboard.writeText(voiceEndpoint).then(() => {
      setCopiedVoiceUrl(true); setTimeout(() => setCopiedVoiceUrl(false), 2000)
    })
  }

  function copyVoiceBody() {
    navigator.clipboard.writeText(voiceJsonBody).then(() => {
      setCopiedVoiceBody(true); setTimeout(() => setCopiedVoiceBody(false), 2000)
    })
  }

  function saveGoal(id) {
    if (!editingGoal || editingGoal.id !== id) return false
    const n = parseInt(editingGoal.val)
    const plate = allPlates.find(p => p.id === id)
    const stored = plate?.type === 'timed' ? n * 60 : n
    onSetGoal(id, n > 0 ? stored : null)
    setEditingGoal(null)
    return true
  }

  function handleSaveGoals() {
    if (editingGoal) saveGoal(editingGoal.id)
    onSaveGoals?.()
  }

  function movePlate(id, dir) {
    const ids = allPlates.map(p => p.id)
    const idx = ids.indexOf(id)
    const nextIdx = idx + dir
    if (idx < 0 || nextIdx < 0 || nextIdx >= ids.length) return
    const next = [...ids]
    const [item] = next.splice(idx, 1)
    next.splice(nextIdx, 0, item)
    onPlateOrderChange?.(next)
  }

  function resetPlateOrder() {
    onPlateOrderChange?.([])
  }

  function updatePlateColor(id, color) {
    const current = plateSettings?.[id] || {}
    onPlateSettingsChange?.(id, { ...current, color })
  }

  function updateReminders(patch) {
    onReminderSettingsChange?.({ ...safeReminders, ...patch })
  }

  function updateReminderItem(key, patch) {
    onReminderSettingsChange?.({
      ...safeReminders,
      [key]: { ...safeReminders[key], ...patch },
    })
  }

  async function requestNotificationPermission() {
    if (!remindersSupported) return
    try {
      const result = await Notification.requestPermission()
      setNotificationPermission(result)
      if (result === 'granted') updateReminders({ enabled: true })
    } catch {
      setNotificationPermission(Notification.permission)
    }
  }

  async function registerPushDevice() {
    setPushError('')
    if (!pushSupported) {
      setPushError('Push notifications are not supported in this browser.')
      return
    }
    if (!VAPID_PUBLIC_KEY) {
      setPushError('Server push is not configured yet. Add VITE_VAPID_PUBLIC_KEY before subscribing devices.')
      return
    }
    if (!authHeaders) {
      setPushError('Sign in is still loading. Try again in a moment.')
      return
    }

    setPushStatus('saving')
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      setNotificationPermission(permission)
      if (permission !== 'granted') throw new Error('Notifications were not allowed on this device.')

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const hdrs = await authHeaders()
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { ...hdrs, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_push_subscription', subscription: subscription.toJSON() }),
      })
      if (!res.ok) throw new Error(`Subscription save failed: ${res.status}`)
      setPushRegistered(true)
      setPushStatus('saved')
      updateReminders({ enabled: true })
      setTimeout(() => setPushStatus('idle'), 2000)
    } catch (err) {
      setPushStatus('error')
      setPushError(err?.message || 'Could not register this device for push reminders.')
    }
  }

  // ── Shared style helpers ───────────────────────────────────────────────────

  const card = {
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
  }

  const secTitle = {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '0.6px',
    padding: '14px 16px 6px',
  }

  const divRow = (extra = {}) => ({
    display: 'flex', alignItems: 'center',
    padding: '12px 16px', borderTop: '1px solid var(--border)',
    gap: 12, minHeight: 50, ...extra,
  })

  const rowLabel = { fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }
  const mutedVal = { fontSize: 14, color: 'var(--muted)' }

  function CheckToggle({ checked, onChange }) {
    return (
      <button
        onClick={onChange}
        style={{
          width: 24, height: 24, borderRadius: 7, border: '2px solid',
          borderColor: checked ? '#22c55e' : 'var(--border)',
          background: checked ? '#22c55e' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 6.5L5.5 10L11 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 4 }}>

      {/* ── Account ─────────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>{t('settings_account')}</div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 14px', borderTop: '1px solid var(--border)', gap: 14 }}>
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt=""
              style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: 'var(--accent)', flexShrink: 0,
            }}>
              {user?.firstName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {user?.fullName || user?.firstName || 'Athlete'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.primaryEmailAddress?.emailAddress || ''}
            </div>
          </div>
        </div>

        <div style={divRow()}>
          <span style={rowLabel}>{t('days_logged')}</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{totalDays}</span>
        </div>

        <div style={divRow()}>
          <span style={rowLabel}>{t('active_days')}</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{activeDays}</span>
        </div>

        {/* ── Partner username ── */}
        <div style={divRow({ alignItems: editingUsername ? 'flex-start' : 'center', flexDirection: editingUsername ? 'column' : 'row', gap: editingUsername ? 10 : 12 })}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={rowLabel}>Partner Username</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              How you appear in the partner search directory
            </div>
          </div>
          {editingUsername ? (
            <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, fontWeight: 700, color: 'var(--muted)', pointerEvents: 'none',
                }}>@</span>
                <input
                  autoFocus
                  value={usernameInput}
                  onChange={e => setUsernameInput(
                    e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32)
                  )}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && usernameInput.length >= 3) {
                      onSetUsername?.(usernameInput)
                      setEditingUsername(false)
                      setUsernameSaved(true)
                      setTimeout(() => setUsernameSaved(false), 2000)
                    }
                    if (e.key === 'Escape') setEditingUsername(false)
                  }}
                  placeholder="your-username"
                  maxLength={32}
                  style={{
                    width: '100%', padding: '9px 10px 9px 26px', borderRadius: 10,
                    border: '1.5px solid var(--accent)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                onClick={() => {
                  if (usernameInput.length >= 3) {
                    onSetUsername?.(usernameInput)
                    setUsernameSaved(true)
                    setTimeout(() => setUsernameSaved(false), 2000)
                  }
                  setEditingUsername(false)
                }}
                disabled={usernameInput.length < 3}
                style={{
                  padding: '9px 14px', borderRadius: 10, border: 'none',
                  background: usernameInput.length >= 3 ? 'var(--accent)' : 'var(--surface2)',
                  color: usernameInput.length >= 3 ? '#fff' : 'var(--muted)',
                  fontSize: 13, fontWeight: 700, cursor: usernameInput.length >= 3 ? 'pointer' : 'default',
                  flexShrink: 0,
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingUsername(false)}
                style={{
                  padding: '9px 10px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--muted)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
                {usernameSaved ? '✓ Saved' : `@${partnerUsername || '…'}`}
              </span>
              <button
                onClick={() => { setUsernameInput(partnerUsername || ''); setEditingUsername(true) }}
                style={{
                  padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--muted)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Partner Sharing ─────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>My Share Settings</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, padding: '10px 16px 12px', lineHeight: 1.5, borderTop: '1px solid var(--border)' }}>
          Choose what partners can see when they open your partner link.
        </p>
        {SHARE_ITEMS.map((item) => (
          <div key={item.key} style={divRow()}>
            <CheckToggle
              checked={safeSharing[item.key] !== false}
              onChange={() => onSharingChange?.(item.key, safeSharing[item.key] === false)}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
              {item.desc && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.desc}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Reminder Notifications ──────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>Reminder Notifications</div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--accent-dim)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            <strong style={{ fontSize: 14, color: 'var(--text)' }}>Daily nudges, set your way</strong>
            <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Choose workout, meal, hydration, and sleep reminders. Times sync with your account; this device can be registered for real Web Push reminders once server VAPID keys are configured.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckToggle
              checked={safeReminders.enabled}
              onChange={() => updateReminders({ enabled: !safeReminders.enabled })}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Enable reminders</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {remindersSupported
                  ? notificationPermission === 'granted' ? 'Notifications allowed on this device' : notificationPermission === 'denied' ? 'Notifications blocked in browser settings' : 'Permission needed before reminders can appear'
                  : 'This browser does not support web notifications'}
              </div>
            </div>
            {remindersSupported && notificationPermission !== 'granted' && (
              <button
                onClick={requestNotificationPermission}
                style={{
                  padding: '8px 12px', borderRadius: 10, border: 'none',
                  background: notificationPermission === 'denied' ? 'var(--surface2)' : 'var(--accent)',
                  color: notificationPermission === 'denied' ? 'var(--muted)' : '#fff',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
                }}
              >
                {notificationPermission === 'denied' ? 'Blocked' : 'Allow'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 7, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: pushRegistered ? 'rgba(34,197,94,0.18)' : 'var(--surface2)',
              color: pushRegistered ? '#22c55e' : 'var(--muted)', fontSize: 13, fontWeight: 900,
              border: '1.5px solid var(--border)',
            }}>
              {pushRegistered ? '✓' : '•'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>This device</div>
              <div style={{ fontSize: 12, color: pushError ? 'var(--error)' : 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>
                {pushError || (pushRegistered ? 'Registered for background push reminders.' : pushReady ? 'Ready to register for background push reminders.' : pushSupported ? 'Waiting for server VAPID key configuration.' : 'Web Push is not supported on this browser/device.')}
              </div>
            </div>
            <button
              onClick={registerPushDevice}
              disabled={!pushSupported || pushStatus === 'saving'}
              style={{
                padding: '8px 12px', borderRadius: 10, border: 'none',
                background: pushSupported ? 'var(--accent)' : 'var(--surface2)',
                color: pushSupported ? '#fff' : 'var(--muted)',
                fontSize: 12, fontWeight: 800, cursor: pushSupported ? 'pointer' : 'default', flexShrink: 0,
              }}
            >
              {pushStatus === 'saving' ? 'Saving…' : pushStatus === 'saved' ? 'Saved' : pushRegistered ? 'Refresh' : 'Register'}
            </button>
          </div>
        </div>

        {[
          ['workout', 'Workout', 'A morning nudge to move or log your first set.'],
          ['meals', 'Meals', 'A midday check-in to capture food while it is fresh.'],
          ['water', 'Water', 'A hydration reminder based on your water goal.'],
          ['sleep', 'Sleep wind-down', 'A night reminder to use the bed/wake voice shortcut.'],
        ].map(([key, label, desc]) => (
          <div key={key} style={divRow()}>
            <CheckToggle
              checked={safeReminders[key]?.enabled !== false}
              onChange={() => updateReminderItem(key, { enabled: safeReminders[key]?.enabled === false })}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
            </div>
            <input
              type="time"
              value={safeReminders[key]?.time || '09:00'}
              onChange={e => updateReminderItem(key, { time: e.target.value })}
              style={{
                width: 104, background: 'var(--surface2)', border: '1.5px solid var(--border)',
                borderRadius: 10, color: 'var(--text)', fontSize: 13, fontWeight: 700,
                padding: '8px 9px', outline: 'none', boxSizing: 'border-box', flexShrink: 0,
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Appearance ──────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>{t('settings_appearance')}</div>
        <div style={divRow({ justifyContent: 'space-between' })}>
          <span style={rowLabel}>{t('theme_label')}</span>
          <button onClick={onToggleTheme} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface2)', border: '1.5px solid var(--border)',
            borderRadius: 10, padding: '8px 14px',
            fontSize: 13, fontWeight: 600, color: 'var(--text)',
          }}>
            {theme === 'dark' ? t('dark') : t('light')}
          </button>
        </div>
        <div style={divRow({ justifyContent: 'space-between' })}>
          <span style={rowLabel}>{t('language_label')}</span>
          <select
            value={language}
            onChange={e => onSetLanguage(e.target.value)}
            style={{
              background: 'var(--surface2)', border: '1.5px solid var(--border)',
              borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              cursor: 'pointer', outline: 'none', appearance: 'none',
              paddingRight: 28, minWidth: 110,
            }}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Exercise Order ──────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>Exercise Tiles</div>
        <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allPlates.map(p => (
            <div key={`color-${p.id}`} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14,
              padding: 10, display: 'flex', flexDirection: 'column', gap: 9,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: p.color, boxShadow: `0 0 0 3px ${p.color}22`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>Tile color</div>
                </div>
                <input
                  type="color"
                  value={p.color}
                  onChange={e => updatePlateColor(p.id, e.target.value)}
                  aria-label={`Pick ${p.name} color`}
                  style={{ width: 44, height: 34, border: 'none', background: 'transparent', padding: 0, flexShrink: 0 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7 }}>
                {TILE_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Set ${p.name} color ${c}`}
                    onClick={() => updatePlateColor(p.id, c)}
                    style={{
                      height: 26, borderRadius: 9, background: c,
                      border: p.color.toLowerCase() === c.toLowerCase() ? '2px solid var(--text)' : '1px solid var(--border)',
                      boxShadow: p.color.toLowerCase() === c.toLowerCase() ? `0 0 0 2px ${c}33` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={divRow({ justifyContent: 'space-between' })}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Reorder Exercises</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Set the order tiles appear on the Today dashboard.</div>
          </div>
          <button
            onClick={() => setShowReorder(v => !v)}
            style={{
              border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--surface2)',
              color: 'var(--text)', fontSize: 13, fontWeight: 800, padding: '8px 12px', cursor: 'pointer',
            }}
          >
            {showReorder ? 'Done' : 'Reorder'}
          </button>
        </div>
        {showReorder && (
          <div style={{ padding: '6px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allPlates.map((p, idx) => (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 10,
                background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 12px',
              }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: p.color, boxShadow: `0 0 0 3px ${p.color}22` }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>Position {idx + 1}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={idx === 0}
                    onClick={() => movePlate(p.id, -1)}
                    aria-label={`Move ${p.name} up`}
                    style={{
                      width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontWeight: 900,
                      opacity: idx === 0 ? 0.35 : 1, cursor: idx === 0 ? 'default' : 'pointer',
                    }}
                  >↑</button>
                  <button
                    disabled={idx === allPlates.length - 1}
                    onClick={() => movePlate(p.id, 1)}
                    aria-label={`Move ${p.name} down`}
                    style={{
                      width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--surface)', color: 'var(--text)', fontWeight: 900,
                      opacity: idx === allPlates.length - 1 ? 0.35 : 1, cursor: idx === allPlates.length - 1 ? 'default' : 'pointer',
                    }}
                  >↓</button>
                </div>
              </div>
            ))}
            <button
              onClick={resetPlateOrder}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--muted)', fontSize: 13, fontWeight: 750,
              }}
            >
              Reset to default order
            </button>
          </div>
        )}
      </div>

      {/* ── Daily Goals ─────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>{t('settings_goals')}</div>
        {allPlates.map((p) => {
          const current    = goals?.[p.id] ?? DEFAULT_GOALS[p.id] ?? null
          const isEditing  = editingGoal?.id === p.id
          const isTimed    = p.type === 'timed'
          const unit       = p.id === 'steps' ? t('ex_steps') : isTimed ? 'min' : t('reps_unit')
          const displayVal = isTimed && current != null ? Math.round(current / 60) : current

          return (
            <div key={p.id} style={divRow()}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span style={rowLabel}>{p.name}</span>

              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" inputMode="numeric" autoFocus
                    value={editingGoal.val}
                    onChange={e => setEditingGoal({ id: p.id, val: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') saveGoal(p.id); if (e.key === 'Escape') setEditingGoal(null) }}
                    onBlur={() => saveGoal(p.id)}
                    onFocus={e => e.target.select()}
                    style={{
                      width: 76, textAlign: 'right', fontSize: 15, fontWeight: 700,
                      background: 'var(--surface2)', border: '1.5px solid var(--accent)',
                      borderRadius: 8, color: 'var(--text)', padding: '5px 8px',
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{unit}</span>
                  <button onClick={() => setEditingGoal(null)}
                    style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--muted)', padding: '0 2px', lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingGoal({ id: p.id, val: String(displayVal ?? '') })}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: current != null ? 'var(--text)' : 'var(--muted)' }}>
                    {displayVal != null ? displayVal.toLocaleString() : '—'}
                  </span>
                  {current != null && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{unit}</span>}
                  <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 3, fontWeight: 600 }}>{t('edit')}</span>
                </button>
              )}
            </div>
          )
        })}
        {/* Save button */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={handleSaveGoals}
            style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: 'var(--accent)', border: 'none',
              fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}
          >
            {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? t('goal_saved') : t('save_goals')}
          </button>
        </div>
      </div>

      {/* ── Custom Exercises ────────────────────────────────────────────────── */}
      {customExercises.length > 0 && (
        <div style={card}>
          <div style={secTitle}>{t('settings_custom_ex')}</div>
          {customExercises.map(e => (
            <div key={e.id} style={divRow()}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
              <span style={rowLabel}>{e.name}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px', marginRight: 6 }}>
                {e.type === 'bench' ? t('type_weight_reps') : t('reps_unit')}
              </span>

              {confirmDel === e.id ? (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { onDeleteCustom(e.id); setConfirmDel(null) }} style={{ /* Confirm delete */
                    fontSize: 12, fontWeight: 700,
                    background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)',
                    color: 'var(--error)', borderRadius: 8, padding: '4px 10px',
                  }}>
                    {t('confirm')}
                  </button>
                  <button onClick={() => setConfirmDel(null)} style={{
                    fontSize: 12, background: 'var(--surface2)',
                    border: '1px solid var(--border)', color: 'var(--muted)',
                    borderRadius: 8, padding: '4px 10px',
                  }}>
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(e.id)} style={{
                  fontSize: 12, fontWeight: 600, background: 'none', border: 'none',
                  color: 'var(--error)', cursor: 'pointer', padding: '4px 0', flexShrink: 0,
                }}>
                  {t('remove')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Sync & Data ─────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>{t('settings_sync')}</div>
        <div style={divRow()}>
          <span style={rowLabel}>{t('sync')}</span>
          <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>{t('sync_live')}</span>
        </div>
        <div style={divRow()}>
          <span style={rowLabel}>{t('storage')}</span>
          <span style={mutedVal}>Upstash Redis KV</span>
        </div>
        <div style={divRow()}>
          <span style={rowLabel}>{t('timezone')}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </span>
        </div>
      </div>

      {/* ── Sleep Tracking ──────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>Sleep Tracking</div>
        {/* Oura Ring */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #312e81, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>◎</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Oura Ring</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {ouraPAT ? 'Connected · Deep/REM/HRV synced nightly' : 'Paste your Personal Access Token to connect'}
              </div>
            </div>
            {ouraPAT && !ouraEditing && (
              <div style={{
                fontSize: 9, fontWeight: 800, color: '#7c3aed',
                background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
                borderRadius: 6, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>Active</div>
            )}
          </div>

          {ouraEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                autoFocus
                type="text"
                placeholder="Paste Oura Personal Access Token"
                value={ouraInput}
                onChange={e => setOuraInput(e.target.value.trim())}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setOuraEditing(false); setOuraInput('') }
                }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface2)', border: '1.5px solid var(--accent)',
                  borderRadius: 10, color: 'var(--text)', fontSize: 13,
                  padding: '10px 12px', outline: 'none', fontFamily: 'ui-monospace, monospace',
                  letterSpacing: '0.4px',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    if (ouraInput.length > 8) {
                      onSaveOuraPAT?.(ouraInput)
                      setOuraSaved(true)
                      setTimeout(() => setOuraSaved(false), 2000)
                    }
                    setOuraEditing(false)
                    setOuraInput('')
                  }}
                  disabled={ouraInput.length <= 8}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                    background: ouraInput.length > 8 ? '#7c3aed' : 'var(--surface2)',
                    color: ouraInput.length > 8 ? '#fff' : 'var(--muted)',
                    fontSize: 13, fontWeight: 700, cursor: ouraInput.length > 8 ? 'pointer' : 'default',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setOuraEditing(false); setOuraInput('') }}
                  style={{
                    padding: '10px 14px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                Get your token at{' '}
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>cloud.ouraring.com → Personal Access Tokens</span>
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setOuraInput(''); setOuraEditing(true) }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  border: '1.5px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {ouraSaved ? '✓ Saved' : ouraPAT ? 'Update Token' : 'Connect Oura'}
              </button>
              {ouraPAT && (
                <button
                  onClick={() => onSaveOuraPAT?.('')}
                  style={{
                    padding: '10px 14px', borderRadius: 10,
                    border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)',
                    color: 'var(--error)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
          )}
        </div>

        {/* Google Fit — auto-connected via OAuth; just show status */}
        <div style={divRow()}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#4285F420', border: '1px solid #4285F430', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            🏃
          </div>
          <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Google Fit</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Connected via Google Fit · sleep syncs automatically</div>
          </div>
        </div>
      </div>

      {/* ── Siri Shortcut ───────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>{t('settings_siri')}</div>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--accent-dim)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <strong style={{ fontSize: 14, color: 'var(--text)' }}>One voice command for workouts</strong>
            <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Say the workout in plain English. The app adds that amount to today's total.
            </span>
          </div>
          {voiceToken ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Secret header
              </span>
              <code onClick={() => setShowToken(t => !t)} style={{
                fontSize: 12, fontFamily: 'ui-monospace, monospace',
                color: 'var(--text)', background: 'var(--surface2)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '10px 12px', cursor: 'pointer',
                wordBreak: 'break-all', display: 'block',
              }}>
                {showToken ? voiceToken : voiceToken.slice(0, 14) + '…'}
              </code>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyToken} style={{
                  flex: 1, fontSize: 13, fontWeight: 600,
                  background: 'var(--surface2)', border: '1.5px solid var(--border)',
                  borderRadius: 10, padding: '10px', color: copied ? 'var(--success)' : 'var(--text)',
                }}>
                  {copied ? t('copied') : t('copy_token')}
                </button>
                <button onClick={onRegenToken} disabled={regenLoading} style={{
                  flex: 1, fontSize: 13, fontWeight: 600,
                  background: 'var(--surface2)', border: '1.5px solid var(--border)',
                  borderRadius: 10, padding: '10px', color: 'var(--muted)',
                }}>
                  {regenLoading ? '…' : t('regen')}
                </button>
              </div>

              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 4 }}>
                Shortcut URL
              </span>
              <code style={{
                fontSize: 12, fontFamily: 'ui-monospace, monospace',
                color: 'var(--text)', background: 'var(--surface2)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '10px 12px', wordBreak: 'break-all', display: 'block',
              }}>
                {voiceEndpoint}
              </code>
              <button onClick={copyVoiceEndpoint} style={{
                fontSize: 13, fontWeight: 700,
                background: 'var(--surface2)', border: '1.5px solid var(--border)',
                borderRadius: 10, padding: '10px', color: copiedVoiceUrl ? 'var(--success)' : 'var(--text)',
              }}>
                {copiedVoiceUrl ? 'Copied' : 'Copy Voice URL'}
              </button>

              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 4 }}>
                JSON body
              </span>
              <pre style={{
                margin: 0, fontSize: 12, fontFamily: 'ui-monospace, monospace',
                color: 'var(--text)', background: 'var(--surface2)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '10px 12px', whiteSpace: 'pre-wrap', lineHeight: 1.5,
              }}>{voiceJsonBody}</pre>
              <button onClick={copyVoiceBody} style={{
                fontSize: 13, fontWeight: 700,
                background: 'var(--surface2)', border: '1.5px solid var(--border)',
                borderRadius: 10, padding: '10px', color: copiedVoiceBody ? 'var(--success)' : 'var(--text)',
              }}>
                {copiedVoiceBody ? 'Copied' : 'Copy JSON Body'}
              </button>
            </>
          ) : (
            <button onClick={onRegenToken} disabled={regenLoading} style={{
              fontSize: 14, fontWeight: 600, background: 'var(--accent)',
              border: 'none', borderRadius: 12, padding: '13px', color: '#fff', width: '100%',
            }}>
              {regenLoading ? t('gen_loading') : t('gen_token')}
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Shortcut setup
            </span>
            {[
              'Add Dictate Text or Ask for Input. Prompt: What did you do?',
              'Add Get Contents of URL. Use the Voice URL above.',
              'Set Method to POST. Set Request Body to JSON.',
              'Add headers: Content-Type = application/json and x-log-secret = your token.',
              'Add JSON key text. For the value, insert the blue Provided Input variable.',
              'Optional: get Dictionary Value message, then Speak Text so Siri reads the result.',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--surface2)', color: 'var(--accent)',
                  border: '1px solid var(--border)', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>{i + 1}</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{step}</p>
              </div>
            ))}
          </div>

          <div style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Try saying</span>
            {[
              ['Log 10 pushups', null],
              ['Add 25 squats', null],
              ['I did 8 pull-ups', null],
              ['20 dips', null],
              ['Bench 185 for 5', null],
              ['Bench press 3', null],
              ['60 second plank', 'timed — value is seconds'],
              ['Plank for 2 minutes', 'timed — converted to seconds'],
              ['Dead hang 45 seconds', 'timed — value is seconds'],
              ['45 deadhang', 'timed — bare number = seconds'],
              ['Drink 2 cups of water', null],
              ['Going to bed', null],
              ['I woke up', null],
            ].map(([example, hint]) => (
              <div key={example} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <code style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--muted)', flexShrink: 0 }}>
                  {example}
                </code>
                {hint && <span style={{ fontSize: 10, color: 'var(--accent)', opacity: 0.7 }}>{hint}</span>}
              </div>
            ))}
          </div>

          <div style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Dedicated per-exercise shortcuts</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
              Create a separate shortcut for each exercise — Siri just asks for the number. Use this JSON body instead of the generic one above.
            </span>
            {[
              { label: 'Dips', body: '{\n  "exercise": "dips",\n  "value": Provided Input\n}' },
              { label: 'Bench press (reps)', body: '{\n  "exercise": "bench",\n  "value": Provided Input\n}' },
              { label: 'Plank (seconds)', body: '{\n  "exercise": "planks",\n  "value": Provided Input\n}' },
              { label: 'Dead hang (seconds)', body: '{\n  "exercise": "dead_hang",\n  "value": Provided Input\n}' },
            ].map(({ label, body }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{label}</span>
                <pre style={{
                  margin: 0, fontSize: 11, fontFamily: 'ui-monospace, monospace',
                  color: 'var(--muted)', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 7,
                  padding: '8px 10px', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                }}>{body}</pre>
              </div>
            ))}
            <span style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              Replace <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 4 }}>Provided Input</code> with the blue variable from a Dictate Text or Ask for Input step. Set the prompt to something like "How many seconds?" for timed exercises.
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            {t('siri_hint')}{' '}
            <code style={{ background: 'var(--surface2)', padding: '1px 4px', borderRadius: 4, fontSize: 10 }}>
              x-log-secret
            </code>
          </p>
        </div>
      </div>

      {/* ── Apple Health ────────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={secTitle}>{t('settings_apple')}</div>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: 'var(--accent-dim)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong style={{ fontSize: 14, color: 'var(--text)' }}>{t('apple_auto')}</strong>
              <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                {t('apple_sub')}
              </span>
            </div>
          </div>

          {/* Copyable base URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {t('url_first')}
            </span>
            <code style={{
              fontSize: 12, fontFamily: 'ui-monospace, monospace',
              color: 'var(--text)', background: 'var(--surface2)',
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '10px 12px', wordBreak: 'break-all', display: 'block', lineHeight: 1.6,
            }}>
              {window.location.origin + '/?steps='}
            </code>
            <button onClick={copyHealthUrl} style={{
              fontSize: 14, fontWeight: 700,
              background: 'var(--accent)', border: 'none',
              borderRadius: 10, padding: '12px', color: '#fff',
            }}>
              {copiedHealth ? t('copied_paste') : t('copy_url')}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {t('two_min')}
            </span>
            {[
              'On your iPhone, open this site in Safari and sign in once so Shortcuts can save to your account.',
              'Open Shortcuts, tap +, then add Get Health Quantity Sample. Choose Steps and Today.',
              'Add Open URL. Paste the URL prefix you copied above, then tap right after the = and insert the Step Count variable.',
              "Tap Run once. You should see today's steps appear here. If iOS asks for permission, allow Health and website access.",
              'To make it automatic: Shortcuts → Automation → Time of Day → choose nightly → run this shortcut.',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--surface2)', color: 'var(--accent)',
                  border: '1px solid var(--border)', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>{i + 1}</div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>{step}</p>
              </div>
            ))}
          </div>

          <div style={{
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{t('url_look')}</span>
            <code style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--muted)', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {window.location.origin + '/?steps='}
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>12345</span>
            </code>
            <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
              {t('date_optional')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Sign Out ────────────────────────────────────────────────────────── */}
      <div style={card}>
        <button onClick={() => signOut()} style={{
          width: '100%', padding: '15px 16px', textAlign: 'left',
          fontSize: 14, fontWeight: 600, color: 'var(--error)',
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          {t('settings_sign_out')}
        </button>
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
