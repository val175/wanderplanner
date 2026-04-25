import { useState } from 'react'
import AvatarCircle from './AvatarCircle'

export default function TravelerMultiSelect({
  travelers = [],
  selectedIds = [],
  onChange,
  label = 'Travelers',
  helperText = 'Select everyone who is part of this activity.',
  allowClear = true,
  disabled = false,
  collapsible = false,
  className = '',
}) {
  const [expanded, setExpanded] = useState(false)

  const selectedSet = new Set(selectedIds || [])
  const allIds = travelers.map(t => t.id).filter(Boolean)
  const allSelected = allIds.length > 0 && allIds.every(id => selectedSet.has(id))
  const selectedTravelers = travelers.filter(t => selectedSet.has(t.id))

  const toggle = (id) => {
    if (!onChange || disabled) return
    const next = selectedSet.has(id)
      ? selectedIds.filter(currentId => currentId !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  const selectAll = () => { if (!disabled) onChange?.([...allIds]) }
  const clear = () => { if (!disabled) onChange?.([]) }

  if (collapsible && !expanded) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          disabled={disabled}
          className="w-full flex items-center justify-between gap-3 group"
        >
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer">
            {label}
          </label>
          <div className="flex items-center gap-1.5">
            {selectedTravelers.length > 0 ? (
              <>
                <div className="flex items-center">
                  {selectedTravelers.slice(0, 4).map((t, i) => (
                    <div key={t.id} className={i === 0 ? '' : '-ml-1.5'}>
                      <AvatarCircle profile={t} size={20} />
                    </div>
                  ))}
                  {selectedTravelers.length > 4 && (
                    <span className="-ml-1.5 text-[10px] font-bold text-text-muted bg-bg-secondary border border-border rounded-full w-5 h-5 flex items-center justify-center">
                      +{selectedTravelers.length - 4}
                    </span>
                  )}
                </div>
                <span className="text-xs text-text-muted">{selectedTravelers.length} of {travelers.length}</span>
              </>
            ) : (
              <span className="text-xs text-text-muted italic">None selected</span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className="text-text-muted/60 group-hover:text-text-muted transition-colors ml-0.5 shrink-0">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            {label}
          </label>
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-text-muted/50 hover:text-text-muted transition-colors"
              aria-label="Collapse"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled}
            className={`transition-colors ${disabled ? 'cursor-default opacity-50' : allSelected ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
          >
            Select all
          </button>
          {allowClear && (
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              className={`transition-colors ${disabled ? 'cursor-default opacity-50' : 'text-text-muted hover:text-text-primary'}`}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-text-muted mb-2">{helperText}</p>

      <div className="space-y-1.5 rounded-[var(--radius-md)] border border-border bg-bg-secondary/30 p-2 max-h-56 overflow-y-auto">
        {travelers.length === 0 ? (
          <p className="text-xs text-text-muted px-1 py-1.5">No travelers available yet.</p>
        ) : travelers.map(traveler => {
          const checked = selectedSet.has(traveler.id)
          return (
            <label
              key={traveler.id}
              className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 cursor-pointer transition-colors ${
                checked ? 'bg-accent/10' : 'hover:bg-bg-hover'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(traveler.id)}
                disabled={disabled}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent shrink-0"
              />
              <AvatarCircle profile={traveler} size={22} />
              <span className="min-w-0 flex-1 text-sm text-text-primary font-medium truncate">
                {traveler.name || 'Traveler'}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
