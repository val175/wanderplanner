import * as RadixSelect from '@radix-ui/react-select'

/* ─────────────────────────────────────────────────────────────
   Select — Radix-powered dropdown replacing native <select>.
   Matches the project's input styling and supports keyboard nav.

   Props:
   - value / onValueChange: controlled state
   - placeholder: shown when no value selected
   - size: 'sm' | 'md' | 'lg' (default 'md')
   - className: applied to the trigger button
   - disabled
───────────────────────────────────────────────────────────── */

const sizeClasses = {
  sm: 'px-2 py-1.5',
  md: 'px-3 py-2',
  lg: 'px-3 py-2.5',
}

const baseTriggerCls = `
  w-full flex items-center justify-between gap-2
  text-sm bg-bg-input border border-border rounded-[var(--radius-md)]
  text-text-primary
  focus:border-accent focus:outline-none
  transition-colors cursor-pointer
  disabled:opacity-60 disabled:cursor-default
`

export default function Select({
  value,
  onValueChange,
  placeholder,
  children,
  size = 'md',
  className = '',
  disabled = false,
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger className={`${baseTriggerCls} ${sizeClasses[size]} ${className}`}>
        <RadixSelect.Value placeholder={placeholder ?? <span className="text-text-muted">Select…</span>} />
        <RadixSelect.Icon asChild>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-text-muted opacity-70 shrink-0">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          avoidCollisions
          className="z-[9999] min-w-[var(--radix-select-trigger-width)] max-h-72 bg-bg-input border border-border rounded-[var(--radius-md)] overflow-hidden animate-scale-in"
        >
          <RadixSelect.ScrollUpButton className="flex items-center justify-center h-6 bg-bg-input text-text-muted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="p-1">
            {children}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex items-center justify-center h-6 bg-bg-input text-text-muted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}

export function SelectItem({ value, children }) {
  return (
    <RadixSelect.Item
      value={value}
      className="
        flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none outline-none
        rounded-[var(--radius-sm)] text-text-secondary
        data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary
        data-[state=checked]:text-text-primary
      "
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="ml-auto shrink-0">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
}
