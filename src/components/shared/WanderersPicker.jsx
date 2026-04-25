import { useEffect, useRef, useState } from 'react'
import AvatarCircle from './AvatarCircle'

export default function WanderersPicker({ travelers = [], selectedIds = [], onChange, disabled = false }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const isWholeGroup = !selectedIds?.length
  const selectedTravelers = travelers.filter(t => selectedIds?.includes(t.id))

  const toggle = (id) => {
    if (disabled) return
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id]
    onChange?.(next)
  }

  const resetToWholeGroup = () => {
    onChange?.([])
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative">

      {isWholeGroup ? (
        <button
          type="button"
          onClick={() => !disabled && setOpen(o => !o)}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 text-xs font-medium text-text-muted rounded-[var(--radius-sm)] px-2 py-1 transition-colors
            ${disabled ? 'cursor-default' : 'hover:bg-bg-hover hover:text-text-primary'}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Whole group
          {!disabled && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedTravelers.map(t => (
            <div key={t.id} className="inline-flex items-center gap-1 bg-bg-secondary border border-border rounded-full pl-0.5 pr-2 py-0.5">
              <AvatarCircle profile={t} size={18} />
              <span className="text-xs font-medium text-text-secondary">{t.name?.split(' ')[0]}</span>
            </div>
          ))}
          {!disabled && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="text-xs text-text-muted hover:text-text-primary px-1.5 py-0.5 rounded-[var(--radius-sm)] hover:bg-bg-hover transition-colors"
            >
              Edit
            </button>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={resetToWholeGroup}
              title="Reset to whole group"
              className="text-xs text-text-muted hover:text-danger transition-colors px-1 py-0.5 leading-none"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-bg-card border border-border rounded-[var(--radius-lg)] shadow-xl min-w-[200px] py-1.5 overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-3 pb-1.5 border-b border-border/50">
            Select wanderers
          </p>
          <div className="space-y-0.5 px-1.5 pt-1.5">
            {travelers.map(t => {
              const checked = selectedIds?.includes(t.id)
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 cursor-pointer transition-colors
                    ${checked ? 'bg-accent/10' : 'hover:bg-bg-hover'}`}
                >
                  <input
                    type="checkbox"
                    checked={!!checked}
                    onChange={() => toggle(t.id)}
                    className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent shrink-0"
                  />
                  <AvatarCircle profile={t} size={20} />
                  <span className="text-sm text-text-primary font-medium">{t.name}</span>
                </label>
              )
            })}
          </div>
          <div className="px-3 pt-1.5 mt-1 border-t border-border/50">
            <button
              type="button"
              onClick={resetToWholeGroup}
              className="text-xs text-text-muted hover:text-text-primary w-full text-left py-1 transition-colors"
            >
              ↩ Reset to whole group
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
