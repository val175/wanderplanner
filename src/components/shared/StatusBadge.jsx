import { getTripStatus, STATUS_CONFIG } from '../../utils/tripStatus'
import Badge from './Badge'

export default function StatusBadge({ startDate, endDate, className = '' }) {
  const status = getTripStatus(startDate, endDate)
  const config = STATUS_CONFIG[status]
  const toneMap = {
    upcoming: 'info',
    ongoing: 'success',
    completed: 'neutral',
    archived: 'neutral',
  }

  return (
    <Badge className={className} tone={toneMap[status] || 'neutral'}>
      {config.label}
    </Badge>
  )
}
