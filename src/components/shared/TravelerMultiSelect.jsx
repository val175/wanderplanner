import AvatarCircle from './AvatarCircle'

export default function TravelerMultiSelect({
  travelers = [],
  selectedIds = [],
  onChange,
  label = 'Travelers',
  helperText = 'Leave empty to apply to the whole trip.',
  allowClear = true,
  disabled = false,
  className = '',
}) {
  const selectedSet = new Set(selectedIds || [])
  const allIds = travelers.map(t => t.id).filter(Boolean)
  const allSelected = allIds.length > 0 && allIds.every(id => selectedSet.has(id))

  const toggle = (id) => {
    if (!onChange || disabled) return
    const next = selectedSet.has(id)
      ? selectedIds.filter(currentId => currentId !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  const selectAll = () => { if (!disabled) onChange?.([...allIds]) }
  const clear = () => { if (!disabled) onChange?.([]) }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          {label}
        </label>
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
