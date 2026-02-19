import { useEffect, useState } from 'react'

export default function ProgressRing({
  value = 0,
  size = 64,
  strokeWidth = 5,
  className = '',
  showLabel = true,
  labelClassName = '',
  pulse = false,       // glow-pulse when true (used at 0% to signal "needs attention")
  onClick = null,      // if provided, ring becomes a clickable button
  tooltip = null,      // optional hover tooltip text
}) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedValue / 100) * circumference

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100)
    return () => clearTimeout(timer)
  }, [value])

  const getColor = (val) => {
    if (val >= 80) return 'var(--color-success)'
    if (val >= 50) return 'var(--color-accent)'
    if (val >= 25) return 'var(--color-warning)'
    return 'var(--color-text-muted)'
  }

  const inner = (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      title={tooltip || undefined}
    >
      {/* Pulse ring behind SVG for 0% state */}
      {pulse && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: 'var(--color-accent)' }}
        />
      )}
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(animatedValue)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease' }}
        />
      </svg>
      {showLabel && (
        <span
          className={`absolute text-text-primary font-semibold ${labelClassName}`}
          style={{ fontSize: size * 0.22 }}
        >
          {Math.round(animatedValue)}%
        </span>
      )}
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50
                   hover:opacity-80 active:scale-95 transition-all duration-150 cursor-pointer"
        title={tooltip || undefined}
        aria-label={tooltip || `Trip readiness: ${value}%`}
      >
        {inner}
      </button>
    )
  }

  return inner
}
