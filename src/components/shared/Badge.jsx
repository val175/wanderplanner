export default function Badge({
  children,
  className = '',
  tone = 'neutral',
}) {
  const tones = {
    neutral: 'bg-bg-secondary text-text-muted border-border',
    accent: 'bg-accent/10 text-accent border-accent/20',
    success: 'bg-success/10 text-success border-success/20',
    info: 'bg-info/10 text-info border-info/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold
        rounded-[var(--radius-pill)] border ${tones[tone] || tones.neutral}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
