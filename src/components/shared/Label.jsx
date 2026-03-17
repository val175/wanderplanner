export default function Label({ children, className = '' }) {
  return (
    <span className={`text-xs font-semibold text-text-muted uppercase tracking-wider ${className}`}>
      {children}
    </span>
  )
}
