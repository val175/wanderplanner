import { useState, useMemo, useEffect } from 'react'
import Card from '../shared/Card'
import ProgressBar from '../shared/ProgressBar'
import Button from '../shared/Button'
import Modal from '../shared/Modal'
import TabHeader from '../common/TabHeader'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { BOOKING_CATEGORIES } from '../../constants/tabs'

import BookingsTable from './BookingsTable'
import BookingsKanban from './BookingsKanban'
import BookingDrawer from './BookingDrawer'

function AddBookingModal({ isOpen, onClose, onAdd }) {
  const [bookingData, setBookingData] = useState({
    name: '',
    category: BOOKING_CATEGORIES[0].id,
    estimatedCost: 0
  })

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!bookingData.name.trim()) return
    onAdd({
      name: bookingData.name.trim(),
      category: bookingData.category,
      amountPaid: Number(bookingData.estimatedCost) || 0,
      status: 'to_book',
      confirmationNumber: '',
      providerLink: '',
      location: '',
    })
    setBookingData({ name: '', category: BOOKING_CATEGORIES[0].id, estimatedCost: 0 })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🎫 Add New Booking">
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Booking Name</label>
          <input
            value={bookingData.name}
            onChange={e => setBookingData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Flight to Tokyo"
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Category</label>
            <select
              value={bookingData.category}
              onChange={e => setBookingData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            >
              {BOOKING_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Est. Cost</label>
            <input
              type="number"
              value={bookingData.estimatedCost}
              onChange={e => setBookingData(prev => ({ ...prev, estimatedCost: e.target.value }))}
              placeholder="0.00"
              className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!bookingData.name.trim()}>
            Add Booking
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const TOGGLEABLE_COLUMNS = [
  { id: 'cost', label: 'Cost' },
  { id: 'providerLink', label: 'Link' },
  { id: 'location', label: 'Location' },
]

export default function BookingsTab() {
  const { activeTrip, dispatch, showToast, isReadOnly } = useTripContext()
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'board'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

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
        isReadOnly={isReadOnly}
      />

      <AddBookingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAdd}
      />

      {/* ── Layer 1: Header ── */}
      <TabHeader
        title={<span>🎫 Bookings</span>}
        subtitle="Manage flights, accommodations, and reservations."
        rightSlot={
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end min-w-[120px]">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  {confirmedCount} of {totalCount} confirmed
                </span>
                <div className="w-32">
                  <ProgressBar value={confirmedCount} max={totalCount} colorClass="bg-success" height="h-1.5" />
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExport} className="hidden sm:inline-flex">
                📋 Export
              </Button>
            </div>
            {!isReadOnly && (
              <Button onClick={() => setIsAddModalOpen(true)}>
                + New Booking
              </Button>
            )}
          </div>
        }
      />

      {/* ── Layer 2: The Toolbar (Unified Filters & Actions) ── */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
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

        {/* Right: Toggles & View Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Column Visibility Dropdown (Only relevant in Table view) */}
          {viewMode === 'table' && (
            <div className="relative group">
              <Button variant="secondary" size="sm" className="hidden sm:inline-flex">
                Columns ▾
              </Button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-bg-card border border-border rounded-[var(--radius-md)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
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
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              Table
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'board' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
              Board
            </button>
          </div>
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
          onAdd={isReadOnly ? null : handleAdd}
          onRowClick={(booking) => setSelectedBookingId(booking.id)}
          isReadOnly={isReadOnly}
        />
      ) : (
        <BookingsKanban
          bookings={filteredBookings}
          currency={trip.currency}
          onUpdate={handleUpdate}
          onRowClick={(booking) => setSelectedBookingId(booking.id)}
          isReadOnly={isReadOnly}
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
