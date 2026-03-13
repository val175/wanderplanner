import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Card from '../shared/Card'
import ProgressBar from '../shared/ProgressBar'
import Button from '../shared/Button'
import Modal from '../shared/Modal'
import Select, { SelectItem } from '../shared/Select'
import TabHeader from '../common/TabHeader'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import { hapticImpact } from '../../utils/haptics'

import BookingsTable from './BookingsTable'
import BookingsKanban from './BookingsKanban'
import BookingDrawer from './BookingDrawer'
import SnapToAddZone from '../shared/SnapToAddZone'

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
            <Select
              value={bookingData.category}
              onValueChange={v => setBookingData(prev => ({ ...prev, category: v }))}
            >
              {BOOKING_CATEGORIES.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </SelectItem>
              ))}
            </Select>
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
  const { currentUserProfile } = useProfiles()
  const [filter, setFilter] = useState('all')
  const actorId = currentUserProfile?.uid || currentUserProfile?.id
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

  // Listen for global search highlights
  useEffect(() => {
    const handleHighlight = (e) => {
      const { id, tab } = e.detail
      if (tab === 'bookings') {
        setSelectedBookingId(id)
      }
    }
    window.addEventListener('highlight-item', handleHighlight)
    return () => window.removeEventListener('highlight-item', handleHighlight)
  }, [])

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

  const handleUpdate = (id, updates, overrideActorId = null) => {
    dispatch({ type: ACTIONS.UPDATE_BOOKING, payload: { id, updates, actorId: overrideActorId || actorId } })
  }

  const handleDelete = (id) => {
    dispatch({ type: ACTIONS.DELETE_BOOKING, payload: id })
    if (selectedBookingId === id) setSelectedBookingId(null)
  }

  const handleAdd = (data) => {
    dispatch({ type: ACTIONS.ADD_BOOKING, payload: { ...data, actorId } })
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

      {!isReadOnly && <SnapToAddZone />}

      <TabHeader
        leftSlot={
          <div className="flex items-center gap-3">
            <div className="w-20 h-1.5 rounded-[var(--radius-pill)] bg-bg-secondary overflow-hidden hidden md:block shrink-0">
              <div
                className="h-full rounded-[var(--radius-pill)] bg-accent transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (confirmedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold font-heading text-text-muted">
              {confirmedCount}/{totalCount} confirmed
            </span>
          </div>
        }
        rightSlot={
          <>
            <div className="flex-1">
              <div className="relative inline-flex">
                <Select value={filter} onValueChange={setFilter} className="min-w-[140px]">
                  {filters.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label === 'All' ? 'All Bookings' : f.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center gap-2">
              <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                  Table
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'board' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
                  Board
                </button>
              </div>

              {viewMode === 'table' && (
                <div className="relative group hidden md:block shrink-0">
                  <Button variant="secondary" size="sm">
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

              {!isReadOnly && (
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={handleExport} className="shrink-0">
                    Export
                  </Button>

                  <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="shrink-0">
                    🎫 New Booking
                  </Button>
                </div>
              )}
            </div>
          </>
        }
      />

      {/* FAB — mobile only */}
      {!isReadOnly && createPortal(
        <button
          onClick={() => { hapticImpact('medium'); setIsAddModalOpen(true) }}
          className="fixed bottom-24 right-4 z-40 block md:hidden bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          New Booking
        </button>,
        document.body
      )}

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
