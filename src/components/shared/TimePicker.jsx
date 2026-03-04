import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

/* ─────────────────────────────────────────────────────────────
   TimePicker — custom popover replaces <input type="time">
   - 3-column layout: Hours (1–12) | Minutes (:00 :05 … :55) | AM/PM
   - Scrollable columns — selected item centered on open
   - Returns value in 24h "HH:MM" format (matches native <input type="time">)
   - variant="inline" — bare text label used inside activity rows
   - variant="input" — styled like a form input, used in add-forms
───────────────────────────────────────────────────────────── */

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function parse24h(time) {
  if (!time) return { h: 12, m: 0, period: 'AM' }

  // Handle already-formatted 12h strings like "9:00 AM" or "09:00 AM"
  const match12h = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12h) {
    const h = parseInt(match12h[1], 10) || 12
    const m = parseInt(match12h[2], 10)
    const period = match12h[3].toUpperCase()
    return { h, m, period }
  }

  // Standard 24h "HH:MM" format
  const [hRaw, mRaw] = time.split(':').map(Number)
  if (isNaN(hRaw) || isNaN(mRaw)) return { h: 12, m: 0, period: 'AM' }
  const period = hRaw < 12 ? 'AM' : 'PM'
  const h = hRaw % 12 || 12
  return { h, m: mRaw, period }
}

function to24h(h, m, period) {
  let h24 = h % 12
  if (period === 'PM') h24 += 12
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fmt12h(time) {
  if (!time) return null
  const { h, m, period } = parse24h(time)
  return `${h}:${String(m).padStart(2, '0')} ${period}`
}

export default function TimePicker({
  value,
  onChange,
  className = '',
  placeholder = '+ time',
  variant = 'inline',   // 'inline' | 'input'
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const hourRef = useRef(null)
  const minRef = useRef(null)

  const { h: selH, m: selM, period: selPeriod } = parse24h(value)

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      // Flip up if not enough space below
      const panelH = 230
      const top = (window.innerHeight - r.bottom) >= panelH
        ? r.bottom + 6
        : r.top - panelH - 6
      const left = Math.min(r.left, window.innerWidth - 210 - 12)
      setPos({ top, left })
    }
    setOpen(o => !o)
  }

  // Scroll selected option into view when panel opens
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      hourRef.current?.querySelector('[data-sel]')?.scrollIntoView({ block: 'center', behavior: 'instant' })
      minRef.current?.querySelector('[data-sel]')?.scrollIntoView({ block: 'center', behavior: 'instant' })
    }, 30)
    return () => clearTimeout(timer)
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (!btnRef.current?.contains(e.target) && !panelRef.current?.contains(e.target))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const pick = (h, m, period) => onChange(to24h(h, m, period))
  const display = fmt12h(value)

  /* ── Trigger styles ── */
  const triggerClass = variant === 'input'
    ? [
      'w-full px-2.5 py-1.5 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border)]',
      'rounded-[var(--radius-sm)] text-left flex items-center justify-between gap-1',
      'hover:border-[var(--color-accent)] transition-colors',
      className,
    ].join(' ')
    : [
      'text-xs font-mono tabular-nums cursor-pointer select-none',
      'hover:text-[var(--color-text-secondary)] transition-colors',
      className,
    ].join(' ')

  return (
    <>
      <button ref={btnRef} type="button" onClick={handleOpen} className={triggerClass}>
        <span className={display ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>
          {display || placeholder}
        </span>
        {variant === 'input' && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-[var(--color-text-muted)] shrink-0 opacity-60">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          {/* Hours */}
          <div ref={hourRef} style={{ maxHeight: 220, overflowY: 'auto', paddingBlock: 4 }}
            className="scrollbar-hide">
            {HOURS.map(hr => (
              <button
                key={hr}
                type="button"
                data-sel={hr === selH || undefined}
                onClick={() => { pick(hr, selM, selPeriod) }}
                style={{
                  display: 'block', width: '100%', padding: '7px 20px', textAlign: 'center',
                  fontSize: 14, cursor: 'pointer',
                  color: hr === selH ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontWeight: hr === selH ? 600 : 400,
                  background: 'transparent',
                  border: 'none',
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{hr}</button>
            ))}
          </div>

          <div style={{ width: 1, background: 'var(--color-border)' }} />

          {/* Minutes */}
          <div ref={minRef} style={{ maxHeight: 220, overflowY: 'auto', paddingBlock: 4 }}
            className="scrollbar-hide">
            {MINUTES.map(mn => (
              <button
                key={mn}
                type="button"
                data-sel={mn === selM || undefined}
                onClick={() => { pick(selH, mn, selPeriod) }}
                style={{
                  display: 'block', width: '100%', padding: '7px 20px', textAlign: 'center',
                  fontSize: 14, cursor: 'pointer',
                  color: mn === selM ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontWeight: mn === selM ? 600 : 400,
                  background: 'transparent',
                  border: 'none',
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{String(mn).padStart(2, '0')}</button>
            ))}
          </div>

          <div style={{ width: 1, background: 'var(--color-border)' }} />

          {/* AM / PM */}
          <div style={{ paddingBlock: 4 }}>
            {['AM', 'PM'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { pick(selH, selM, p) }}
                style={{
                  display: 'block', width: '100%', padding: '7px 18px', textAlign: 'center',
                  fontSize: 14, cursor: 'pointer',
                  color: p === selPeriod ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontWeight: p === selPeriod ? 600 : 400,
                  background: 'transparent',
                  border: 'none',
                  transition: 'background 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{p}</button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
