import { generateId } from '../../utils/helpers'
import { addMinutesToTime, normalizeTimeString, calculateDuration } from '../../utils/helpers'
import { updateTrip, parseToMins, sortActivities, sortItineraryDays } from '../reducerUtils'

export const itineraryCases = {
  ADD_DAY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: sortItineraryDays([...trip.itinerary, {
        id: generateId(),
        date: payload.date || '',
        dayNumber: trip.itinerary.length + 1,
        location: payload.location || '',
        emoji: payload.emoji || '📍',
        activities: payload.activities || [],
        notes: payload.notes || '',
      }]),
    }))
  },

  REMOVE_DAY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary
        .filter(d => d.id !== payload)
        .map((d, i) => ({ ...d, dayNumber: i + 1 })),
    }))
  },

  UPDATE_DAY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary.map(d =>
        d.id === payload.dayId ? { ...d, ...payload.updates } : d
      ),
    }))
  },

  // payload: { fromIndex, toIndex }
  REORDER_DAYS: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const itinerary = [...trip.itinerary]
      const [moved] = itinerary.splice(payload.fromIndex, 1)
      itinerary.splice(payload.toIndex, 0, moved)
      return { ...trip, itinerary: itinerary.map((d, i) => ({ ...d, dayNumber: i + 1 })) }
    })
  },

  ADD_ACTIVITY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary.map(d => {
        if (d.id !== payload.dayId) return d
        const newActivity = {
          id: `act-${Date.now()}`,
          time: '09:00 AM',
          duration: 60,
          endTime: '10:00 AM',
          category: 'other',
          name: 'New Activity',
          location: '',
          notes: '',
          ...(payload.activity || {}),
        }
        if (!newActivity.endTime && newActivity.time) {
          newActivity.endTime = addMinutesToTime(newActivity.time, newActivity.duration || 60)
        }
        const newActivities = [...(d.activities || [])]
        if (typeof payload.index === 'number') {
          newActivities.splice(payload.index, 0, newActivity)
        } else {
          newActivities.push(newActivity)
        }
        sortActivities(newActivities)
        return { ...d, activities: newActivities }
      }),
    }))
  },

  UPDATE_ACTIVITY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary.map(d =>
        d.id === payload.dayId
          ? {
            ...d,
            activities: d.activities.map(a => {
              if (a.id !== payload.activityId) return a
              const updates = { ...payload.updates }
              const curr = { ...a, ...updates }
              const startTime = curr.time
              const duration = curr.duration !== undefined ? curr.duration : (a.duration || 60)

              if (payload.updates.time !== undefined && payload.updates.time !== '') {
                updates.endTime = addMinutesToTime(payload.updates.time, duration)
              } else if (payload.updates.duration !== undefined) {
                if (startTime) {
                  updates.endTime = addMinutesToTime(startTime, payload.updates.duration)
                }
              } else if (payload.updates.endTime !== undefined && payload.updates.endTime !== '') {
                if (startTime) {
                  updates.duration = calculateDuration(startTime, payload.updates.endTime)
                }
              }

              return { ...a, ...updates }
            }),
          }
          : d
      ),
    }))
  },

  DELETE_ACTIVITY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary.map(d =>
        d.id === payload.dayId
          ? { ...d, activities: d.activities.filter(a => a.id !== payload.activityId) }
          : d
      ),
    }))
  },

  // payload: { dayId, fromIndex, toIndex }
  REORDER_ACTIVITIES: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary.map(d => {
        if (d.id !== payload.dayId) return d
        const before = [...d.activities]
        const slotTimes = before.map(a => normalizeTimeString(a.time) || a.time || '')
        const activities = [...before]
        const [moved] = activities.splice(payload.fromIndex, 1)
        activities.splice(payload.toIndex, 0, moved)
        const cascaded = activities.map((act, i) => {
          const newTime = slotTimes[i]
          const newEndTime = newTime ? addMinutesToTime(newTime, act.duration ?? 60) : act.endTime
          return { ...act, time: newTime, endTime: newEndTime || act.endTime }
        })
        return { ...d, activities: cascaded }
      }),
    }))
  },

  // payload: { fromDayId, toDayId, activityId, toIndex }
  MOVE_ACTIVITY_BETWEEN_DAYS: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      let movedActivity = null

      const srcItin = trip.itinerary.map(d => {
        if (d.id === payload.fromDayId) {
          movedActivity = d.activities.find(a => a.id === payload.activityId)
          return { ...d, activities: d.activities.filter(a => a.id !== payload.activityId) }
        }
        return d
      })

      if (!movedActivity) return trip

      const finalItin = srcItin.map(d => {
        if (d.id === payload.toDayId) {
          const nextActivities = [...d.activities]
          if (payload.toIndex !== undefined) {
            nextActivities.splice(payload.toIndex, 0, movedActivity)
          } else {
            nextActivities.push(movedActivity)
          }
          return { ...d, activities: nextActivities }
        }
        return d
      })

      return {
        ...trip,
        itinerary: finalItin,
        destinations: (trip.destinations || []).map((d, i) => {
          if (i === payload.index) {
            return {
              ...d,
              city: payload.city,
              country: payload.country,
              flag: payload.flag,
              lat: payload.lat,
              lng: payload.lng,
            }
          }
          return d
        }),
      }
    })
  },

  BATCH_ADD_ACTIVITIES: (state, payload) => {
    const activeTripId = state.activeTripId
    const { dayNumber, location, activities } = payload

    const processActivities = (activitiesArray) => {
      let processed = activitiesArray.map(a => {
        let act = { ...a }
        if (!act.id) act.id = generateId()
        act.time = normalizeTimeString(act.time) || act.time || ''
        act.endTime = normalizeTimeString(act.endTime) || act.endTime || ''
        if (!act.endTime && act.time) {
          act.endTime = addMinutesToTime(act.time, act.duration || 60)
        }
        if (!act.time && act.endTime && act.duration) {
          const endMins = parseToMins(act.endTime)
          const startMins = endMins === null ? null : endMins - (act.duration || 60)
          if (Number.isFinite(startMins) && startMins >= 0) {
            const h = String(Math.floor(startMins / 60)).padStart(2, '0')
            const m = String(startMins % 60).padStart(2, '0')
            act.time = `${h}:${m}`
          }
        }
        return act
      })
      return sortActivities(processed)
    }

    return updateTrip(state, activeTripId, trip => {
      const itinerary = trip.itinerary || []
      const dayExists = itinerary.some(d => d.dayNumber === dayNumber)
      if (dayExists) {
        return {
          ...trip,
          itinerary: sortItineraryDays(itinerary.map(day =>
            day.dayNumber !== dayNumber ? day : {
              ...day,
              activities: processActivities([...(day.activities || []), ...activities]),
            }
          )),
        }
      }
      return {
        ...trip,
        itinerary: sortItineraryDays([
          ...itinerary,
          {
            id: generateId(),
            dayNumber,
            date: '',
            location: location || '',
            emoji: '📍',
            activities: processActivities(activities),
            notes: '',
          },
        ]),
      }
    })
  },

  ADD_ACTIVITY_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary.map(d =>
        d.id !== payload.dayId ? d : {
          ...d,
          activities: d.activities.map(a => {
            if (a.id !== payload.activityId) return a
            if (!payload.text?.trim()) return a
            const comment = {
              id: generateId(),
              authorId: payload.actorId || null,
              text: payload.text.trim(),
              timestamp: new Date().toISOString(),
            }
            return { ...a, comments: [...(a.comments || []), comment] }
          }),
        }
      ),
    }))
  },

  UPDATE_ACTIVITY_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary.map(d =>
        d.id !== payload.dayId ? d : {
          ...d,
          activities: d.activities.map(a =>
            a.id !== payload.activityId ? a : {
              ...a,
              comments: (a.comments || []).map(c =>
                c.id === payload.commentId ? { ...c, text: payload.text?.trim() || c.text } : c
              ),
            }
          ),
        }
      ),
    }))
  },

  DELETE_ACTIVITY_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      itinerary: trip.itinerary.map(d =>
        d.id !== payload.dayId ? d : {
          ...d,
          activities: d.activities.map(a =>
            a.id !== payload.activityId ? a : {
              ...a,
              comments: (a.comments || []).filter(c => c.id !== payload.commentId),
            }
          ),
        }
      ),
    }))
  },
}
