import { useCallback, useMemo } from 'react'
import { useTripContext } from '../context/TripContext'
import { ACTIONS } from '../state/tripReducer'

export function useNotifications(myUid) {
  const { activeTrip, dispatch } = useTripContext()

  const notifications = useMemo(() => {
    if (!activeTrip || !myUid) return []
    const items = []

    activeTrip.itinerary?.forEach(day => {
      day.activities?.forEach(act => {
        act.comments?.forEach(c => {
          if (c.mentions?.includes(myUid) && c.authorId !== myUid) {
            items.push({
              id: c.id,
              type: 'activity',
              itemId: act.id,
              dayId: day.id,
              itemName: act.name || 'Activity',
              itemEmoji: act.emoji || '📍',
              authorId: c.authorId,
              text: c.text,
              timestamp: c.timestamp,
            })
          }
        })
      })
    })

    activeTrip.bookings?.forEach(b => {
      b.comments?.forEach(c => {
        if (c.mentions?.includes(myUid) && c.authorId !== myUid) {
          items.push({
            id: c.id,
            type: 'booking',
            itemId: b.id,
            itemName: b.name || 'Booking',
            itemEmoji: b.emoji || '🏨',
            authorId: c.authorId,
            text: c.text,
            timestamp: c.timestamp,
          })
        }
      })
    })

    activeTrip.todos?.forEach(t => {
      t.comments?.forEach(c => {
        if (c.mentions?.includes(myUid) && c.authorId !== myUid) {
          items.push({
            id: c.id,
            type: 'todo',
            itemId: t.id,
            itemName: t.text || 'Task',
            itemEmoji: '✅',
            authorId: c.authorId,
            text: c.text,
            timestamp: c.timestamp,
          })
        }
      })
    })

    return items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [activeTrip, myUid])

  const readTimestamp = activeTrip?.notificationsReadAt?.[myUid] || null

  const unreadCount = useMemo(
    () => notifications.filter(n => !readTimestamp || new Date(n.timestamp) > new Date(readTimestamp)).length,
    [notifications, readTimestamp]
  )

  const markRead = useCallback(() => {
    if (!activeTrip || !myUid || unreadCount === 0) return
    dispatch({
      type: ACTIONS.UPDATE_TRIP,
      payload: {
        id: activeTrip.id,
        updates: {
          notificationsReadAt: {
            ...(activeTrip.notificationsReadAt || {}),
            [myUid]: new Date().toISOString(),
          },
        },
      },
    })
  }, [activeTrip, myUid, unreadCount, dispatch])

  return { notifications, unreadCount, markRead, readTimestamp }
}
