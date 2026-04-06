import { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import TabHeader from '../common/TabHeader'
import Button from '../shared/Button'
import Modal from '../shared/Modal'
import EmptyState from '../shared/EmptyState'
import ActivityDrawer from './ActivityDrawer'
import LocationAutocomplete from '../shared/LocationAutocomplete'
import AddActivityModal from './itinerary/AddActivityModal'
import DayGroupTable from './itinerary/DayGroupTable'
import KanbanColumn from './itinerary/KanbanColumn'
import CalendarView from './itinerary/CalendarView'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { triggerHaptic, hapticImpact } from '../../utils/haptics'
import { wandaRuntime, setWandaRuntime } from '../../utils/wandaRuntime'
import { useDrag } from '@use-gesture/react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useSmartLocation } from '../../hooks/useSmartLocation'

// ── Shared utilities only needed by the main component ─────────────────────
function sortItineraryDays(days) {
  return [...(days || [])].sort((a, b) => Number(a?.dayNumber || 0) - Number(b?.dayNumber || 0))
}

function normalizeText(value) {
  return (value || '').toString().trim().toLowerCase()
}

function buildMapPointForActivity(day, activity) {
  if (!day || !activity) return null
  return {
    type: 'activity',
    dayId: day.id,
    activityId: activity.id,
    dayLocation: day.location || '',
    city: day.location || '',
    coords: activity.location?.coordinates?.lng != null && activity.location?.coordinates?.lat != null
      ? [activity.location.coordinates.lng, activity.location.coordinates.lat]
      : null,
    activity,
    queryLabel: activity.location?.placeName || activity.location?.address || activity.name || '',
  }
}

function buildMapPointForDay(day, trip) {
  if (!day) return null
  const matchedCity = trip?.cities?.find(city => {
    const location = normalizeText(day.location)
    return city?.city && location.includes(normalizeText(city.city))
  })
  return {
    type: 'dest',
    dayId: day.id,
    city: matchedCity?.city || trip?.cities?.[0]?.city || day.location || '',
    country: matchedCity?.country || trip?.cities?.[0]?.country || '',
    cityId: matchedCity?.id || matchedCity?.city || trip?.cities?.[0]?.id || trip?.cities?.[0]?.city || '',
    dayLocation: day.location || '',
    coords: null,
  }
}

function findDayForMapPoint(point, itinerary) {
  if (!point || !Array.isArray(itinerary)) return null
  if (point.dayId) {
    const direct = itinerary.find(day => day.id === point.dayId)
    if (direct) return direct
  }
  if (point.type === 'activity' && point.activityId) {
    return itinerary.find(day => day.activities?.some(activity => activity.id === point.activityId)) || null
  }
  if (point.type === 'dest') {
    const pointCity = normalizeText(point.city)
    const pointCountry = normalizeText(point.country)
    return itinerary.find(day => {
      const location = normalizeText(day.location)
      return (pointCity && location.includes(pointCity)) || (pointCountry && location.includes(pointCountry))
    }) || null
  }
  return null
}

// ── Main Itinerary Tab ─────────────────────────────────────────────────────
export default function ItineraryTab() {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [viewMode, setViewMode] = useState('table')
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [activeSearchActivity, setActiveSearchActivity] = useState(null)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const { resolveLocation, isResolving } = useSmartLocation()

  if (!activeTrip) return null
  const trip = activeTrip
  const itinerary = useMemo(() => sortItineraryDays(trip.itinerary || []), [trip.itinerary])

  const maxDays = useMemo(() => {
    if (!trip.startDate || !trip.endDate) return null
    const [sy, sm, sd] = trip.startDate.split('-').map(Number)
    const [ey, em, ed] = trip.endDate.split('-').map(Number)
    const start = new Date(sy, sm - 1, sd)
    const end = new Date(ey, em - 1, ed)
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
    return diff > 0 ? diff : null
  }, [trip.startDate, trip.endDate])

  const atDayLimit = maxDays !== null && itinerary.length >= maxDays

  const handleOpenMapPoint = useCallback((day, activity) => {
    const point = activity ? buildMapPointForActivity(day, activity) : buildMapPointForDay(day, trip)
    if (!point) return
    hapticImpact('medium')
    setWandaRuntime({
      activeTab: 'wandermap',
      selectedMapPoint: point,
      pendingMapFocus: point,
      pendingItineraryFocus: null,
      uiContext: `Itinerary requested map view for ${activity?.name || day?.location || 'selected day'}`,
    })
    dispatch({ type: ACTIONS.SET_TAB, payload: 'wandermap' })
  }, [dispatch, trip])

  useEffect(() => {
    const pending = wandaRuntime.pendingItineraryFocus
    if (!pending) return
    const targetDay = findDayForMapPoint(pending, itinerary)
    if (!targetDay) return
    const targetIndex = itinerary.findIndex(day => day.id === targetDay.id)
    if (isMobile && targetIndex >= 0) setActiveDayIndex(targetIndex)
    setWandaRuntime({
      pendingItineraryFocus: null,
      selectedMapPoint: pending,
      activeTab: 'itinerary',
      uiContext: `Itinerary focused on ${pending?.activity?.name || pending?.city || targetDay.location || 'selected point'}`,
    })
    window.dispatchEvent(new CustomEvent('highlight-item', {
      detail: { id: pending.activityId || targetDay.id, tab: 'itinerary', dayId: targetDay.id, source: pending.source || 'map' },
    }))
  }, [itinerary, isMobile])

  const bind = useDrag(({ swipe: [swipeX], active }) => {
    if (!active && swipeX !== 0) {
      if (swipeX === -1 && activeDayIndex < itinerary.length - 1) { setActiveDayIndex(prev => prev + 1); triggerHaptic('light') }
      else if (swipeX === 1 && activeDayIndex > 0) { setActiveDayIndex(prev => prev - 1); triggerHaptic('light') }
    }
  }, { axis: 'x', filterTaps: true })

  const handleAddDay = () => {
    if (atDayLimit) return
    const lastDay = itinerary[itinerary.length - 1]
    let nextDate = ''
    if (lastDay?.date) {
      const [year, month, day] = lastDay.date.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      d.setDate(d.getDate() + 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      nextDate = `${y}-${m}-${dd}`
    }
    dispatch({ type: ACTIONS.ADD_DAY, payload: { date: nextDate, location: 'New Location', emoji: '📍' } })
  }

  const sharedDayProps = {
    trip,
    resolveLocation,
    isResolving,
    setActiveSearchActivity,
    onOpenDrawer: setSelectedActivity,
    onViewOnMap: handleOpenMapPoint,
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24 flex flex-col h-full min-h-[calc(100vh-120px)]">

      <TabHeader
        leftSlot={
          <span className="text-xs font-semibold text-text-muted tabular-nums">
            {itinerary?.reduce((acc, d) => acc + (d.activities?.length || 0), 0) || 0} activities · {itinerary?.length || 0} days
          </span>
        }
        rightSlot={
          <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center justify-end gap-2">
            <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0 h-9">
              <button onClick={() => setViewMode('table')} className={`px-3 text-sm font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                Table
              </button>
              <button onClick={() => setViewMode('kanban')} className={`px-3 text-sm font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'kanban' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
                Board
              </button>
              <button onClick={() => setViewMode('calendar')} className={`px-3 text-sm font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Calendar
              </button>
            </div>
            {!isReadOnly && (
              <div className="hidden md:flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="shrink-0">📍 New Activity</Button>
                <span title={atDayLimit ? `Day limit reached (${itinerary.length}/${maxDays} days)` : undefined} className="shrink-0">
                  <Button size="sm" onClick={handleAddDay} disabled={atDayLimit} className="shrink-0">✨ New Day</Button>
                </span>
              </div>
            )}
          </div>
        }
      />

      <AddActivityModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        itinerary={itinerary}
        onAdd={({ dayId, activity }) => {
          dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId, activity } })
        }}
      />

      <Modal isOpen={!!activeSearchActivity} onClose={() => setActiveSearchActivity(null)} title="📍 Update Location">
        <div className="p-6 min-h-[380px]">
          <p className="text-sm text-text-secondary mb-4">Search for a specific place to get accurate map data and photos.</p>
          {(() => {
            const currentDay = itinerary.find(d => d.id === activeSearchActivity?.dayId)
            const cityContext = currentDay ? trip.cities.find(c =>
              currentDay.location && c.city && currentDay.location.toLowerCase().includes(c.city.toLowerCase())
            ) || (trip.cities?.length > 0 ? trip.cities[0] : null) : null
            const proximity = cityContext?.lat && cityContext?.lng ? `${cityContext.lng},${cityContext.lat}` : ''
            return (
              <LocationAutocomplete
                initialValue={activeSearchActivity?.initialValue || ''}
                proximity={proximity}
                cityHint={currentDay?.location || cityContext?.city || ''}
                onSelect={(locationData) => {
                  dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: activeSearchActivity.dayId, activityId: activeSearchActivity.activityId, updates: { location: locationData } } })
                  setActiveSearchActivity(null)
                  triggerHaptic('medium')
                }}
              />
            )
          })()}
        </div>
      </Modal>

      {/* FABs — mobile only */}
      {!isReadOnly && createPortal(
        <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2 md:hidden">
          <button onClick={() => { hapticImpact('medium'); setIsAddModalOpen(true) }} className="bg-bg-card border border-border text-text-primary rounded-full px-4 py-3 font-semibold flex items-center gap-2 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Activity
          </button>
          <div className="animate-tab-enter stagger-2">
            <button
              onClick={() => { if (!atDayLimit) { hapticImpact('medium'); handleAddDay() } }}
              disabled={atDayLimit}
              title={atDayLimit ? `Day limit reached (${itinerary.length}/${maxDays} days)` : undefined}
              className={`rounded-full px-4 py-3 font-semibold flex items-center gap-2 text-sm transition-opacity ${atDayLimit ? 'bg-bg-card border border-border text-text-muted opacity-50 cursor-not-allowed' : 'bg-accent text-white'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              New Day
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Activity Drawer */}
      {selectedActivity && (() => {
        const liveActivity = itinerary
          .find(d => d.id === selectedActivity.dayId)
          ?.activities?.find(a => a.id === selectedActivity.activityId)
        return liveActivity ? (
          <ActivityDrawer
            activity={liveActivity}
            dayId={selectedActivity.dayId}
            onClose={() => setSelectedActivity(null)}
            onViewOnMap={handleOpenMapPoint}
          />
        ) : null
      })()}

      {/* Content Area */}
      {itinerary.length > 0 ? (
        <div className="flex-1 w-full relative animate-tab-enter stagger-3">
          {viewMode === 'table' ? (
            <div className="w-full pb-20">
              {isMobile ? (
                <div {...bind()} className="touch-none select-none">
                  {itinerary[activeDayIndex] && (
                    <DayGroupTable
                      key={itinerary[activeDayIndex].id}
                      day={itinerary[activeDayIndex]}
                      itinerary={itinerary}
                      onReorderDay={(from, to) => dispatch({ type: ACTIONS.REORDER_DAYS, payload: { fromIndex: from, toIndex: to } })}
                      {...sharedDayProps}
                    />
                  )}
                  <div className="flex justify-center gap-1.5 mt-4">
                    {itinerary.map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeDayIndex ? 'bg-accent w-4' : 'bg-border'}`} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {itinerary.map((day) => (
                    <DayGroupTable
                      key={day.id}
                      day={day}
                      itinerary={itinerary}
                      onReorderDay={(from, to) => dispatch({ type: ACTIONS.REORDER_DAYS, payload: { fromIndex: from, toIndex: to } })}
                      {...sharedDayProps}
                    />
                  ))}
                  {!isReadOnly && (
                    <button onClick={handleAddDay} className="w-full py-3 rounded-[var(--radius-md)] border border-dashed border-border text-text-muted hover:text-text-secondary hover:border-border-strong transition-colors text-sm font-medium">
                      + Add another day group
                    </button>
                  )}
                </>
              )}
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="absolute inset-0 right-[-24px] pr-6 pb-6 overflow-x-auto overflow-y-hidden custom-scrollbar">
              <div className="flex gap-4 min-fit-content h-full items-start">
                {itinerary.map(day => (
                  <KanbanColumn key={day.id} day={day} {...sharedDayProps} />
                ))}
                {!isReadOnly && (
                  <button onClick={handleAddDay} className="w-72 shrink-0 h-[100px] rounded-[var(--radius-lg)] border-2 border-dashed border-border/40 bg-transparent text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors text-sm font-medium flex items-center justify-center flex-col gap-2">
                    <span className="text-xl">➕</span>
                    Add Day
                  </button>
                )}
              </div>
            </div>
          ) : (
            <CalendarView
              trip={trip}
              itinerary={itinerary}
              isMobile={isMobile}
              activeDayIndex={activeDayIndex}
              onOpenDrawer={setSelectedActivity}
              onDayChange={setActiveDayIndex}
            />
          )}
        </div>
      ) : (
        <EmptyState
          emoji="🗺️"
          title="Build your perfect trip"
          subtitle="Start outlining your days and dragging activities around until your schedule is air-tight."
          wandaPrompt={`Plan Day 1 of my trip to ${trip.cities?.map(c => c.city).join(', ') || 'my destinations'} — use the generate_day_itinerary tool to create a schedule I can add.\n\n[INSTRUCTION]:\nLook at our itinerary and find the next day that has few or no activities. Call the "generate_day_itinerary" tool to plan it with 4-5 time-slotted activities appropriate for our destination and budget.`}
          action={!isReadOnly && <Button variant="primary" size="sm" onClick={handleAddDay}>+ Add First Day</Button>}
        />
      )}
    </div>
  )
}
