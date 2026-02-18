import { useEffect, useState } from 'react'

export default function ProgressRing({
  value = 0,
  size = 64,
  strokeWidth = 5,
  className = '',
  showLabel = true,
  labelClassName = '',
}) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (animatedValue / 100) * circumference

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100)
    return () => clearTimeout(timer)
  }, [value])

  // Color based on progress
  const getColor = (val) => {
    if (val >= 80) return 'var(--color-success)'
    if (val >= 50) return 'var(--color-accent)'
    if (val >= 25) return 'var(--color-warning)'
    return 'var(--color-text-muted)'
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
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
          style={{
            transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s ease',
          }}
        />
      </svg>
      {showLabel && (
        <span className={`absolute text-text-primary font-semibold ${labelClassName}`} style={{ fontSize: size * 0.22 }}>
          {Math.round(animatedValue)}%
        </span>
      )}
    </div>
  )
}
