import { useState, useMemo } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import ProgressBar from '../shared/ProgressBar'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { BOOKING_CATEGORIES, BOOKING_STATUSES } from '../../constants/tabs'
import { formatCurrency } from '../../utils/helpers'

function StatusChip({ status, onClick }) {
  const config = BOOKING_STATUSES.find(s => s.id === status) || BOOKING_STATUSES[0]
  const colors = {
    not_started: 'bg-text-muted/10 text-text-muted border-text-muted/20',
    in_progress: 'bg-warning/10 text-warning border-warning/20',
    booked: 'bg-success/10 text-success border-success/20',
  }
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded-[var(--radius-pill)] border transition-all
        hover:scale-105 active:scale-95 ${colors[status] || colors.not_started}`}
      title="Click to cycle status"
    >
      {config.label}
    </button>
  )
}

function BookingCard({ booking, currency }) {
  const { dispatch, showToast } = useTripContext()
  const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[5]

  const handleCycleStatus = () => {
    dispatch({ type: ACTIONS.CYCLE_BOOKING_STATUS, payload: booking.id })
    const statuses = ['not_started', 'in_progress', 'booked']
    const nextIndex = (statuses.indexOf(booking.status) + 1) % statuses.length
    if (statuses[nextIndex] === 'booked') {
      showToast("Booked! ✓ One less thing to worry about.")
    }
  }

  return (
    <Card hover className="animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0">{categoryConfig.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <EditableText
                value={booking.name}
                onSave={val => dispatch({ type: ACTIONS.UPDATE_BOOKING, payload: { id: booking.id, updates: { name: val } } })}
                className="font-medium text-text-primary text-sm"
              />
              {booking.priority && <span className="text-xs" title="Priority">⭐</span>}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 bg-bg-hover rounded-[var(--radius-pill)] text-text-muted">
                {categoryConfig.label}
              </span>
              <StatusChip status={booking.status} onClick={handleCycleStatus} />
            </div>
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: ACTIONS.UPDATE_BOOKING, payload: { id: booking.id, updates: { priority: !booking.priority } } })}
          className={`text-lg flex-shrink-0 transition-transform hover:scale-110 ${booking.priority ? '' : 'opacity-30 hover:opacity-60'}`}
          title="Toggle priority"
        >
          ⭐
        </button>
      </div>

      {/* Details row */}
      <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-text-muted text-xs block">Confirmation #</span>
          <EditableText
            value={booking.confirmationNumber}
            onSave={val => dispatch({ type: ACTIONS.UPDATE_BOOKING, payload: { id: booking.id, updates: { confirmationNumber: val } } })}
            className="font-mono text-text-primary text-xs"
            placeholder="—"
          />
        </div>
        <div>
          <span className="text-text-muted text-xs block">Amount Paid</span>
          <EditableText
            value={booking.amountPaid ? String(booking.amountPaid) : ''}
            onSave={val => dispatch({ type: ACTIONS.UPDATE_BOOKING, payload: { id: booking.id, updates: { amountPaid: Number(val) || 0 } } })}
            className="text-text-primary text-xs"
            placeholder={formatCurrency(0, currency)}
          />
        </div>
        <div>
          <span className="text-text-muted text-xs block">Book By</span>
          <EditableText
            value={booking.bookByDate}
            onSave={val => dispatch({ type: ACTIONS.UPDATE_BOOKING, payload: { id: booking.id, updates: { bookByDate: val } } })}
            className="text-text-primary text-xs"
            placeholder="—"
          />
        </div>
      </div>

      {/* Delete */}
      <div className="mt-2 text-right">
        <button
          onClick={() => dispatch({ type: ACTIONS.DELETE_BOOKING, payload: booking.id })}
          className="text-xs text-text-muted hover:text-danger transition-colors"
        >
          Remove
        </button>
      </div>
    </Card>
  )
}

function AddBookingForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('custom')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), category })
    setName('')
    setCategory('custom')
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-text-muted block mb-1">Booking name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Singapore Hotel"
            className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary"
          >
            {BOOKING_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="px-4 py-2 text-sm bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover">
          Add
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary">
          Cancel
        </button>
      </form>
    </Card>
  )
}

export default function BookingsTab() {
  const { activeTrip } = useTripContext()
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const { dispatch, showToast } = useTripContext()

  if (!activeTrip) return null
  const trip = activeTrip

  const confirmedCount = trip.bookings?.filter(b => b.status === 'booked').length || 0
  const totalCount = trip.bookings?.length || 0

  const filteredBookings = useMemo(() => {
    let bookings = [...(trip.bookings || [])]
    if (filter !== 'all') {
      bookings = bookings.filter(b => b.category === filter)
    }
    // Sort: unconfirmed first, then by priority
    return bookings.sort((a, b) => {
      if (a.status === 'booked' && b.status !== 'booked') return 1
      if (b.status === 'booked' && a.status !== 'booked') return -1
      if (a.priority && !b.priority) return -1
      if (b.priority && !a.priority) return 1
      return 0
    })
  }, [trip.bookings, filter])

  const filters = [
    { id: 'all', label: 'All' },
    ...BOOKING_CATEGORIES.filter(c =>
      trip.bookings?.some(b => b.category === c.id)
    ).map(c => ({ id: c.id, label: c.label })),
  ]

  const handleExport = () => {
    const text = trip.bookings?.map(b => {
      const cat = BOOKING_CATEGORIES.find(c => c.id === b.category)
      return `${cat?.emoji || '📌'} ${b.name} — ${b.status === 'booked' ? '✅ Booked' : '⏳ ' + b.status.replace('_', ' ')}${b.confirmationNumber ? ` (#${b.confirmationNumber})` : ''}`
    }).join('\n')
    navigator.clipboard.writeText(`📋 ${trip.name} — Bookings\n\n${text}`)
    showToast('Bookings copied to clipboard! 📋')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary bar */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading text-lg text-text-primary">🎫 Bookings</h2>
          <span className="text-sm text-text-muted">{confirmedCount} of {totalCount} confirmed</span>
        </div>
        <ProgressBar value={confirmedCount} max={totalCount} colorClass="bg-success" height="h-2" />
      </Card>

      {/* Filter tabs + actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-pill)] whitespace-nowrap transition-colors
                ${filter === f.id
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-muted hover:text-text-secondary border border-border'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary border border-border rounded-[var(--radius-sm)] hover:bg-bg-hover transition-colors"
          >
            📋 Export
          </button>
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 text-xs bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover transition-colors"
          >
            + Add Booking
          </button>
        </div>
      </div>

      {/* Add booking form */}
      {adding && (
        <AddBookingForm
          onAdd={data => { dispatch({ type: ACTIONS.ADD_BOOKING, payload: data }); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Booking cards */}
      <div className="space-y-4">
        {filteredBookings.map(booking => (
          <BookingCard key={booking.id} booking={booking} currency={trip.currency} />
        ))}
      </div>

      {filteredBookings.length === 0 && (
        <Card className="text-center py-8">
          <p className="text-3xl mb-2">🎫</p>
          <p className="text-text-muted text-sm">No bookings {filter !== 'all' ? 'in this category' : 'yet'}.</p>
        </Card>
      )}
    </div>
  )
}
