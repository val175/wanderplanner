import { useState, useRef, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'

/* ─────────────────────────────────────────────────────────────
   TimePicker — custom popover with Radix Popover for correct
   viewport-aware positioning (replaces manual getBoundingClientRect).
   - 3-column layout: Hours (1–12) | Minutes (:00 :05 … :55) | AM/PM
   - Scrollable columns — selected item centered on open
   - Returns value in 24h "HH:MM" format (matches native <input type="time">)
   - variant="inline" — bare text label used inside activity rows
   - variant="input" — styled like a form input, used in add-forms
─────────── ─────────── ─────────── ─────────── ─────────── ─ */

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function parse24h(time) {
  if (!time) return { h: 12, m: 0, period: 'AM' }
  const match12h = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12h) {
    const h = parseInt(match12h[1], 10) || 12
    const m = parseInt(match12h[2], 10)
    const period = match12h[3].toUpperCase()
    return { h, m, period }
  }
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
  disabled = false,
  minTime = null,      // "HH:mm" format
}) {
  const [open, setOpen] = useState(false)
  const hourRef = useRef(null)
  const minRef = useRef(null)

  const { h: selH, m: selM, period: selPeriod } = parse24h(value)

  // Scroll selected option into view when panel opens
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      hourRef.current?.querySelector('[data-sel]')?.scrollIntoView({ block: 'center', behavior: 'instant' })
      minRef.current?.querySelector('[data-sel]')?.scrollIntoView({ block: 'center', behavior: 'instant' })
    }, 30)
    return () => clearTimeout(timer)
  }, [open])

  const pick = (h, m, period) => {
    const val = to24h(h, m, period)
    if (minTime && val < minTime) return
    onChange(val)
  }
  const display = fmt12h(value)

  const handleWheel = (ref) => (e) => {
    e.preventDefault()
    if (ref.current) ref.current.scrollTop += e.deltaY
  }

  const triggerClass = variant === 'input'
    ? `w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-left flex items-center justify-between gap-1 hover:border-accent transition-colors ${className}`
    : `text-xs font-mono tabular-nums cursor-pointer select-none hover:text-text-secondary transition-colors touch-target ${className}`


  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen} modal={false}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`${triggerClass} ${disabled ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
          disabled={disabled}
        >
          <span className={display ? 'text-text-primary' : 'text-text-muted'}>
            {display || placeholder}
          </span>
          {variant === 'input' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-text-muted shrink-0 opacity-70">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          avoidCollisions
          className="z-[9999] animate-scale-in focus:outline-none flex overflow-hidden pointer-events-auto"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            width: 210,
          }}
        >
          {/* Hours */}
          <div 
            ref={hourRef} 
            className="flex-1 touch-pan-y scrollbar-hide"
            style={{ maxHeight: 220, overflowY: 'auto', paddingBlock: 4, scrollSnapType: 'y mandatory' }}
            onWheel={handleWheel(hourRef)}
          >

            {HOURS.map(hr => {
              const isDimmed = minTime && to24h(hr, selM, selPeriod) < minTime
              return (
                <button
                  key={hr}
                  type="button"
                  data-sel={hr === selH || undefined}
                  onClick={() => pick(hr, selM, selPeriod)}
                  style={{
                    display: 'block', width: '100%', padding: '7px 0', textAlign: 'center',
                    fontSize: 14, cursor: isDimmed ? 'default' : 'pointer',
                    color: hr === selH ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontWeight: hr === selH ? 600 : 400,
                    background: 'transparent', border: 'none', transition: 'background 100ms',
                    scrollSnapAlign: 'center',
                    opacity: isDimmed ? 0.3 : 1,
                    pointerEvents: isDimmed ? 'none' : 'auto',
                  }}

                  className="hover:bg-bg-hover"
                >{hr}</button>
              )
            })}
          </div>

          <div style={{ width: 1, background: 'var(--color-border)' }} />

          {/* Minutes */}
          <div 
            ref={minRef} 
            className="flex-1 touch-pan-y scrollbar-hide"
            style={{ maxHeight: 220, overflowY: 'auto', paddingBlock: 4, scrollSnapType: 'y mandatory' }}
            onWheel={handleWheel(minRef)}
          >

            {MINUTES.map(mn => {
              const isDimmed = minTime && to24h(selH, mn, selPeriod) < minTime
              return (
                <button
                  key={mn}
                  type="button"
                  data-sel={mn === selM || undefined}
                  onClick={() => pick(selH, mn, selPeriod)}
                  style={{
                    display: 'block', width: '100%', padding: '7px 0', textAlign: 'center',
                    fontSize: 14, cursor: isDimmed ? 'default' : 'pointer',
                    color: mn === selM ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontWeight: mn === selM ? 600 : 400,
                    background: 'transparent', border: 'none', transition: 'background 100ms',
                    scrollSnapAlign: 'center',
                    opacity: isDimmed ? 0.3 : 1,
                    pointerEvents: isDimmed ? 'none' : 'auto',
                  }}

                  className="hover:bg-bg-hover"
                >{String(mn).padStart(2, '0')}</button>
              )
            })}
          </div>

          <div style={{ width: 1, background: 'var(--color-border)' }} />

          {/* AM / PM */}
          <div style={{ paddingBlock: 4 }} className="flex-1">
            {['AM', 'PM'].map(p => {
              const isDimmed = minTime && to24h(selH, selM, p) < minTime
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => pick(selH, selM, p)}
                  style={{
                    display: 'block', width: '100%', padding: '7px 0', textAlign: 'center',
                    fontSize: 14, cursor: isDimmed ? 'default' : 'pointer',
                    color: p === selPeriod ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontWeight: p === selPeriod ? 600 : 400,
                    background: 'transparent', border: 'none', transition: 'background 100ms',
                    opacity: isDimmed ? 0.3 : 1,
                    pointerEvents: isDimmed ? 'none' : 'auto',
                  }}
                  className="hover:bg-bg-hover"
                >{p}</button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
