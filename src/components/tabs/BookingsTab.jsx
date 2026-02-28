import { useState, useMemo, useEffect } from 'react'
import Card from '../shared/Card'
import ProgressBar from '../shared/ProgressBar'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { BOOKING_CATEGORIES } from '../../constants/tabs'

import BookingsTable from './BookingsTable'
import BookingsKanban from './BookingsKanban'
import BookingDrawer from './BookingDrawer'

const TOGGLEABLE_COLUMNS = [
  { id: 'cost', label: 'Cost' },
  { id: 'providerLink', label: 'Link' },
  { id: 'location', label: 'Location' },
]

export default function BookingsTab() {
  const { activeTrip, dispatch, showToast } = useTripContext()
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'board'

  // Local storage for view preferences
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('wanderplan_bookings_hidden')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  // Selected booking for the detail drawer
  const [selectedBookingId, setSelectedBookingId] = useState(null)

  useEffect(() => {
    try { localStorage.setItem('wanderplan_bookings_hidden', JSON.stringify(hiddenColumns)) } catch { }
  }, [hiddenColumns])

  if (!activeTrip) return null
  const trip = activeTrip

  // Count confirmed (legacy `booked` or new `confirmed`)
  const confirmedCount = trip.bookings?.filter(b => b.status === 'booked' || b.status === 'confirmed').length || 0
  const totalCount = trip.bookings?.length || 0

  const filteredBookings = useMemo(() => {
    let bookings = [...(trip.bookings || [])]
    if (filter !== 'all') {
      bookings = bookings.filter(b => b.category === filter)
    }
    // Sort chronologically by start date, then created order
    return bookings.sort((a, b) => {
      if (a.startDate && b.startDate) return new Date(a.startDate) - new Date(b.startDate)
      if (a.startDate) return -1
      if (b.startDate) return 1
      return 0
    })
  }, [trip.bookings, filter])

  const filters = [
    { id: 'all', label: 'All Categories' },
    ...BOOKING_CATEGORIES.filter(c =>
      trip.bookings?.some(b => b.category === c.id)
    ).map(c => ({ id: c.id, label: `${c.emoji} ${c.label}` })),
  ]

  const handleUpdate = (id, updates) => {
    dispatch({ type: ACTIONS.UPDATE_BOOKING, payload: { id, updates } })
  }

  const handleDelete = (id) => {
    dispatch({ type: ACTIONS.DELETE_BOOKING, payload: id })
    if (selectedBookingId === id) setSelectedBookingId(null)
  }

  const handleAdd = (data) => {
    dispatch({ type: ACTIONS.ADD_BOOKING, payload: data })
  }

  const handleExport = () => {
    const text = filteredBookings.map(b => {
      const cat = BOOKING_CATEGORIES.find(c => c.id === b.category)
      return `${cat?.emoji || '📌'} ${b.name} — ${b.status} ${b.confirmationNumber ? `(#${b.confirmationNumber})` : ''}`
    }).join('\n')
    navigator.clipboard.writeText(`📋 ${trip.name} — Bookings\n\n${text}`)
    showToast('Bookings copied to clipboard! 📋')
  }

  const toggleColumn = (colId) => {
    setHiddenColumns(prev =>
      prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
    )
  }

  const selectedBooking = useMemo(() =>
    trip.bookings?.find(b => b.id === selectedBookingId),
    [trip.bookings, selectedBookingId])

  return (
    <div className="space-y-6 animate-fade-in relative">

      {/* Drawer */}
      <BookingDrawer
        booking={selectedBooking}
        currency={trip.currency}
        onUpdate={handleUpdate}
        onClose={() => setSelectedBookingId(null)}
      />

      {/* Summary bar */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading text-lg text-text-primary">🎫 Bookings</h2>
          <span className="text-sm text-text-muted">{confirmedCount} of {totalCount} confirmed</span>
        </div>
        <ProgressBar value={confirmedCount} max={totalCount} colorClass="bg-success" height="h-2" />
      </Card>

      {/* Main Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Left: Category Filters */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
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

        {/* Right: Triggers & Views */}
        <div className="flex items-center gap-2 self-start sm:self-auto">

          {/* Column Visibility Dropdown (Only relevant in Table view) */}
          {viewMode === 'table' && (
            <div className="relative group">
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex">
                Columns ▾
              </Button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-bg-card border border-border rounded-[var(--radius-md)] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                <div className="p-2 space-y-1">
                  {TOGGLEABLE_COLUMNS.map(col => (
                    <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-bg-hover rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent"
                        checked={!hiddenColumns.includes(col.id)}
                        onChange={() => toggleColumn(col.id)}
                      />
                      <span className="text-text-secondary">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* View Toggle */}
          <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${viewMode === 'table' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              ≡ Table
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${viewMode === 'board' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              ◫ Board
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={handleExport} className="hidden sm:inline-flex">
            📋 Export
          </Button>
        </div>
      </div>

      {/* Render selected view */}
      {viewMode === 'table' ? (
        <BookingsTable
          bookings={filteredBookings}
          currency={trip.currency}
          hiddenColumns={hiddenColumns}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAdd={handleAdd}
          onRowClick={(booking) => setSelectedBookingId(booking.id)}
        />
      ) : (
        <BookingsKanban
          bookings={filteredBookings}
          currency={trip.currency}
          onUpdate={handleUpdate}
          onRowClick={(booking) => setSelectedBookingId(booking.id)}
        />
      )}

      {/* Empty States */}
      {filteredBookings.length === 0 && (
        <Card className="text-center py-8">
          <p className="text-3xl mb-2">🎫</p>
          <p className="text-text-muted text-sm tracking-wide">
            {filter !== 'all' ? `No ${filter} bookings yet.` : 'No bookings added yet. Enter one below or drop a board.'}
          </p>
        </Card>
      )}
    </div>
  )
}
