import { useState, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'

/* ─────────────────────────────────────────────────────────────
   DatePicker — calendar popover with Radix Popover for correct
   viewport-aware positioning (replaces manual getBoundingClientRect).
   - Month grid with prev/next navigation
   - Today highlighted with accent ring
   - Selected day filled with accent background
   - min prop disables dates before a given ISO date (used for end-date)
   - Always returns YYYY-MM-DD strings (same format as native date input)
───────────────────────────────────────────────────────────── */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function toDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fmtDisplay(iso) {
  if (!iso) return null
  const d = toDate(iso)
  return `${SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export default function DatePicker({
  value,
  onChange,
  min,            // ISO string — dates before this are disabled
  placeholder = 'Set date',
  className = '', // applied to the trigger button
  disabled = false,
}) {
  const [open, setOpen] = useState(false)

  const today = new Date()
  const todayISO = toISO(today)
  const selected = toDate(value)
  const minDate = toDate(min)

  // Start the calendar view at: selected date → min date (e.g. startDate) → today
  const initDate = selected || minDate || today
  const [viewYear, setViewYear] = useState(initDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initDate.getMonth())

  // Keep view in sync when value or min changes externally.
  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear())
      setViewMonth(selected.getMonth())
    } else if (minDate) {
      setViewYear(minDate.getFullYear())
      setViewMonth(minDate.getMonth())
    }
  }, [value, min])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()

  const selectDay = day => {
    onChange(toISO(new Date(viewYear, viewMonth, day)))
    setOpen(false)
  }

  const dayStyle = (iso, isDisabled) => {
    const isSel = iso === value
    const isTod = iso === todayISO
    return {
      aspectRatio: '1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: isSel ? 600 : isTod ? 500 : 400,
      borderRadius: 'var(--radius-sm)',
      border: isTod && !isSel ? '1px solid var(--color-accent)' : 'none',
      background: isSel ? 'var(--color-accent)' : 'transparent',
      color: isSel ? '#fff' : isDisabled ? 'var(--color-text-muted)' : isTod ? 'var(--color-accent)' : 'var(--color-text-primary)',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      opacity: isDisabled ? 0.35 : 1,
      transition: 'background 100ms',
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`flex items-center justify-between gap-2 text-left transition-colors ${className} ${disabled ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
          disabled={disabled}
        >
          <span className={`text-sm ${value ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            {fmtDisplay(value) || placeholder}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-[var(--color-text-muted)] shrink-0 opacity-70">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          avoidCollisions
          className="z-[9999] animate-scale-in focus:outline-none"
          onOpenAutoFocus={e => e.preventDefault()}
          style={{
            width: 292,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 14px 12px',
          }}
        >
          {/* Month / year nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" onClick={prevMonth} style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent',
              color: 'var(--color-text-muted)', fontSize: 18, cursor: 'pointer', transition: 'background 100ms',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >‹</button>

            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>

            <button type="button" onClick={nextMonth} style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent',
              color: 'var(--color-text-muted)', fontSize: 18, cursor: 'pointer', transition: 'background 100ms',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >›</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DOW.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 10, fontWeight: 600,
                color: 'var(--color-text-muted)', textTransform: 'uppercase',
                letterSpacing: '0.06em', padding: '4px 0',
              }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const iso = toISO(new Date(viewYear, viewMonth, day))
              const isDisabled = !!(minDate && new Date(viewYear, viewMonth, day) < minDate)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => !isDisabled && selectDay(day)}
                  disabled={isDisabled}
                  style={dayStyle(iso, isDisabled)}
                  onMouseEnter={e => {
                    if (!isDisabled && iso !== value)
                      e.currentTarget.style.background = 'var(--color-bg-hover)'
                  }}
                  onMouseLeave={e => {
                    if (iso !== value)
                      e.currentTarget.style.background = 'transparent'
                  }}
                >{day}</button>
              )
            })}
          </div>

          {/* Clear link */}
          {value && (
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <button type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                style={{
                  fontSize: 11, color: 'var(--color-text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', transition: 'color 100ms',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
              >Clear date</button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
