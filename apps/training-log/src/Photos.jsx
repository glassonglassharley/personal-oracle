import { useState, useRef, useEffect } from 'react'

const STORAGE_KEY = 'training-log-photos'
const API = import.meta.env.VITE_API_URL || ''

function loadLocalPhotos() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function compressImage(file, maxW = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale  = Math.min(1, maxW / img.width)
      const w      = Math.round(img.width  * scale)
      const h      = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load failed')) }
    img.src = url
  })
}

export default function Photos({ authHeaders }) {
  const [photos,          setPhotos]          = useState([])
  const [loaded,          setLoaded]          = useState(false)
  const [cloudEnabled,    setCloudEnabled]    = useState(false)
  const [viewing,         setViewing]         = useState(null)
  const [compareMode,     setCompareMode]     = useState(false)
  const [compareSelected, setCompareSelected] = useState([])
  const [comparing,       setComparing]       = useState(null)
  const [deletePending,   setDeletePending]   = useState(null)
  const [adding,          setAdding]          = useState(false)
  const fileInputRef   = useRef(null)
  const longPressTimer = useRef(null)
  const didLongPress   = useRef(false)
  const migratedRef    = useRef(false)

  // ── Load photos ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authHeaders) {
      setPhotos(loadLocalPhotos())
      setLoaded(true)
      return
    }

    async function load() {
      try {
        const hdrs = await authHeaders()
        const res  = await fetch(`${API}/api/photos?action=list`, { headers: hdrs })
        if (!res.ok) throw new Error(`${res.status}`)
        const cloud = await res.json()
        setCloudEnabled(true)

        if (cloud.length === 0 && !migratedRef.current) {
          migratedRef.current = true
          const local = loadLocalPhotos()
          if (local.length > 0) {
            setPhotos(local.map(p => ({ ...p, migrating: true })))
            const uploaded = []
            for (const photo of local) {
              try {
                const mhdrs = await authHeaders()
                const r = await fetch(`${API}/api/photos?action=upload&date=${photo.date}`, {
                  method: 'POST',
                  headers: { ...mhdrs, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dataUrl: photo.dataUrl, date: photo.date }),
                })
                if (r.ok) {
                  const { url } = await r.json()
                  uploaded.push({ url, date: photo.date })
                }
              } catch {}
            }
            if (uploaded.length > 0) {
              setPhotos(uploaded)
              localStorage.removeItem(STORAGE_KEY)
            } else {
              setPhotos(local)
            }
          }
        } else {
          migratedRef.current = true
          setPhotos(cloud)
        }
      } catch {
        setPhotos(loadLocalPhotos())
      } finally {
        setLoaded(true)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Add photo ────────────────────────────────────────────────────────────────

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAdding(true)
    try {
      const dataUrl = await compressImage(file)
      const date    = todayStr()

      if (cloudEnabled && authHeaders) {
        const hdrs = await authHeaders()
        const res  = await fetch(`${API}/api/photos?action=upload&date=${date}`, {
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      }
    } catch (err) {
      console.error('Photo upload failed', err)
    }
    setAdding(false)
    e.target.value = ''
  }

  // ── Delete photo ─────────────────────────────────────────────────────────────

  async function handleDelete(i) {
    const photo = photos[i]
    if (cloudEnabled && authHeaders && photo.url) {
      try {
        const hdrs = await authHeaders()
        await fetch(`${API}/api/photos?action=delete&url=${encodeURIComponent(photo.url)}`, {
          method: 'DELETE',
          headers: hdrs,
        })
      } catch {}
    }
    const updated = photos.filter((_, idx) => idx !== i)
    setPhotos(updated)
    if (!cloudEnabled) localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setDeletePending(null)
  }

  // ── Long-press + tap handlers ─────────────────────────────────────────────

  function handlePressStart(i) {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setDeletePending(i)
    }, 600)
  }

  function handlePressEnd() {
    clearTimeout(longPressTimer.current)
  }

  function handlePhotoClick(i) {
    if (didLongPress.current) { didLongPress.current = false; return }
    if (deletePending !== null) { setDeletePending(null); return }

    if (compareMode) {
      const next = compareSelected.includes(i)
        ? compareSelected.filter(x => x !== i)
        : [...compareSelected, i].slice(-2)

      if (next.length === 2) {
        setComparing([next[0], next[1]])
        setCompareMode(false)
        setCompareSelected([])
      } else {
        setCompareSelected(next)
      }
    } else {
      setViewing(i)
    }
  }

  const photoSrc = p => p.url || p.dataUrl || ''

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="photos-section">
      <div className="photos-section-header">
        <span className="photos-section-title">Progress Photos</span>
        <span className="photos-note">
          {cloudEnabled ? 'Synced across devices' : 'Stored on this device only.'}
        </span>
      </div>

      <div className="photos-toolbar">
        <button
          className="btn-add-photo"
          onClick={() => fileInputRef.current?.click()}
          disabled={adding}
        >
          {adding ? 'Uploading…' : '+ Add Photo'}
        </button>
        {photos.length >= 2 && (
          <button
            className={`btn-compare ${compareMode ? 'active' : ''}`}
            onClick={() => { setCompareMode(m => !m); setCompareSelected([]) }}
          >
            {compareMode ? 'Cancel' : 'Compare'}
          </button>
        )}
      </div>

      {compareMode && (
        <p className="compare-hint">Tap two photos to compare side by side</p>
      )}

      {!loaded ? (
        <div className="photos-empty">
          <p style={{ color: 'var(--muted)' }}>Loading photos…</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="photos-empty">
          <p>No progress photos yet.</p>
          <p className="muted">Tap "Add Photo" to get started.</p>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo, i) => (
            <div
              key={photo.url || photo.dataUrl || i}
              className={[
                'photo-cell',
                compareSelected.includes(i) ? 'compare-sel' : '',
                deletePending === i         ? 'delete-pend' : '',
              ].filter(Boolean).join(' ')}
              onPointerDown={() => handlePressStart(i)}
              onPointerUp={handlePressEnd}
              onPointerLeave={handlePressEnd}
              onPointerCancel={handlePressEnd}
              onClick={() => handlePhotoClick(i)}
              onContextMenu={e => e.preventDefault()}
            >
              <img src={photoSrc(photo)} alt={photo.date} className="photo-thumb" draggable={false} />
              <span className="photo-date-label">{photo.date}</span>

              {compareSelected.includes(i) && (
                <span className="compare-num">{compareSelected.indexOf(i) + 1}</span>
              )}

              {deletePending === i && (
                <div
                  className="delete-overlay"
                  onClick={e => { e.stopPropagation(); handleDelete(i) }}
                >
                  Delete
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Fullscreen single photo ── */}
      {viewing !== null && photos[viewing] && (
        <div className="photo-overlay" onClick={() => setViewing(null)}>
          <img src={photoSrc(photos[viewing])} alt="" className="photo-fs" />
          <span className="overlay-date">{photos[viewing].date}</span>
          <button className="overlay-close" onClick={() => setViewing(null)}>×</button>
        </div>
      )}

      {/* ── Side-by-side compare ── */}
      {comparing && photos[comparing[0]] && photos[comparing[1]] && (
        <div className="photo-overlay compare-overlay" onClick={() => setComparing(null)}>
          <div className="compare-pair">
            <div className="compare-side">
              <img src={photoSrc(photos[comparing[0]])} alt="" />
              <span className="compare-date">{photos[comparing[0]].date}</span>
            </div>
            <div className="compare-divider" />
            <div className="compare-side">
              <img src={photoSrc(photos[comparing[1]])} alt="" />
              <span className="compare-date">{photos[comparing[1]].date}</span>
            </div>
          </div>
          <button className="overlay-close" onClick={() => setComparing(null)}>×</button>
        </div>
      )}
    </div>
  )
}
