export default function Toast({ message, type = 'success', visible }) {
  if (!message) return null

  const colors = {
    success: 'bg-success/10 text-success border-success/20',
    error: 'bg-danger/10 text-danger border-danger/20',
    info: 'bg-info/10 text-info border-info/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
  }

  return (
    <div className={`
      fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]
      px-5 py-3 rounded-[var(--radius-lg)] border
      font-medium text-sm
      ${colors[type] || colors.success}
      ${visible ? 'animate-toast-in' : 'animate-toast-out pointer-events-none'}
    `}>
      {message}
    </div>
  )
}
