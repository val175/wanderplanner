import { getTripStatus, STATUS_CONFIG } from '../../utils/tripStatus'

export default function StatusBadge({ startDate, endDate, className = '' }) {
  const status = getTripStatus(startDate, endDate)
  const config = STATUS_CONFIG[status]

  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 text-xs font-medium
      rounded-[var(--radius-pill)] ${config.className} ${className}
    `}>
      {config.label}
    </span>
  )
}
