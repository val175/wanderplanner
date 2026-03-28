import { useState, useMemo, useEffect } from 'react'
import Modal from '../../shared/Modal'
import Button from '../../shared/Button'
import TimePicker from '../../shared/TimePicker'
import Select, { SelectItem } from '../../shared/Select'
import { addMinutesToTime, formatDate } from '../../../utils/helpers'
import { GLOBAL_CATEGORIES } from '../../../constants/categories'
import { getConflicts } from './itineraryUtils'

export default function AddActivityModal({ isOpen, onClose, itinerary, onAdd }) {
  const [activityData, setActivityData] = useState({ name: '', time: '', dayId: '', duration: 60, endTime: '' })

  useEffect(() => {
    if (activityData.time && activityData.duration) {
      const newEndTime = addMinutesToTime(activityData.time, activityData.duration)
      if (newEndTime !== activityData.endTime) {
        setActivityData(prev => ({ ...prev, endTime: newEndTime }))
      }
    }
  }, [activityData.time, activityData.duration, activityData.endTime])

  useEffect(() => {
    if (isOpen) {
      setActivityData({ name: '', time: '', dayId: itinerary[0]?.id || '', duration: 60, endTime: '' })
    }
  }, [isOpen, itinerary])

  const conflicts = useMemo(() => {
    if (!activityData.dayId || !activityData.time || !activityData.endTime) return []
    const day = itinerary.find(d => d.id === activityData.dayId)
    return getConflicts(day?.activities || [], activityData.time, activityData.endTime)
  }, [activityData.dayId, activityData.time, activityData.endTime, itinerary])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!activityData.name.trim() || !activityData.dayId) return
    onAdd({
      dayId: activityData.dayId,
      activity: {
        name: activityData.name.trim(),
        time: activityData.time,
        duration: activityData.duration,
        endTime: activityData.endTime,
        category: activityData.category || 'other',
      },
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📅 Add New Activity">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Target Day</label>
          <Select
            value={activityData.dayId}
            onValueChange={v => setActivityData(prev => ({ ...prev, dayId: v }))}
          >
            {itinerary.map(day => (
              <SelectItem key={day.id} value={day.id}>
                Day {day.dayNumber}: {day.location || 'Untitled Location'} ({day.date ? formatDate(day.date, 'short') : 'No date'})
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Activity Name</label>
          <input
            value={activityData.name}
            onChange={e => setActivityData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Dinner at 7-Eleven"
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Category</label>
          <Select
            value={activityData.category || 'other'}
            onValueChange={val => setActivityData(prev => ({ ...prev, category: val }))}
          >
            {GLOBAL_CATEGORIES.map(c => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span>{c.emoji}</span>
                  <span>{c.label}</span>
                </span>
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Start Time</label>
            <TimePicker
              variant="input"
              value={activityData.time}
              onChange={time => setActivityData(prev => ({ ...prev, time }))}
              placeholder="Start"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">End Time</label>
            <TimePicker
              variant="input"
              value={activityData.endTime}
              onChange={endTime => setActivityData(prev => ({ ...prev, endTime }))}
              minTime={activityData.time}
              placeholder="End"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Duration (minutes)</label>
          <input
            type="number"
            value={activityData.duration}
            onChange={e => setActivityData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-warning/10 border border-warning/20 text-warning text-xs">
            <span className="mt-0.5">⚠️</span>
            <span>
              <span className="font-semibold">Time overlap</span> with{' '}
              {conflicts.map(c => c.name).join(', ')} — you can still add it.
            </span>
          </div>
        )}

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={!activityData.name.trim() || !activityData.dayId}>
            Add Activity
          </Button>
        </div>
      </form>
    </Modal>
  )
}
