import { motion } from 'framer-motion'

export default function ProgressBar({
  value = 0,
  max = 100,
  className = '',
  colorClass = 'bg-accent',
  height = 'h-2',
  showLabel = false,
  label = '',
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5 text-sm">
          <span className="text-text-secondary">{label}</span>
          <span className="text-text-muted font-medium">{value}/{max}</span>
        </div>
      )}
      <div className={`w-full bg-border rounded-full overflow-hidden ${height}`}>
        <motion.div
          className={`${height} ${colorClass} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
        />
      </div>
    </div>
  )
}
