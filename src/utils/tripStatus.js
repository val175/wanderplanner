/**
 * Determine trip status from dates
 * Returns: 'upcoming' | 'ongoing' | 'completed'
 */
export function getTripStatus(startDate, endDate) {
  if (!startDate || !endDate) return 'upcoming'

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  if (now > end) return 'completed'
  if (now >= start && now <= end) return 'ongoing'
  return 'upcoming'
}

export const STATUS_CONFIG = {
  upcoming: {
    label: 'Upcoming',
    className: 'bg-info/10 text-info',
  },
  ongoing: {
    label: 'Ongoing',
    className: 'bg-success/10 text-success',
  },
  completed: {
    label: 'Completed',
    className: 'bg-text-muted/10 text-text-muted',
  },
  archived: {
    label: 'Archived',
    className: 'bg-text-muted/10 text-text-muted',
  },
}

/**
 * Returns the effective display status, including manual archival.
 */
export function getEffectiveStatus(trip) {
  if (trip?.archivedAt) return 'archived'
  return getTripStatus(trip?.startDate, trip?.endDate)
}
