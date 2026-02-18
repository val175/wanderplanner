/**
 * Calculate Trip Readiness Score (0-100)
 * Weighted: Bookings 40%, Todos 35%, Packing 25%
 * Empty lists score 0 (not started) rather than 1 (complete).
 */
export function calculateReadiness(trip) {
  if (!trip) return 0

  const weights = { bookings: 0.4, todos: 0.35, packing: 0.25 }

  // Bookings score — 0 if no bookings yet
  const totalBookings = trip.bookings?.length || 0
  const confirmedBookings = trip.bookings?.filter(b => b.status === 'booked').length || 0
  const bookingScore = totalBookings > 0 ? confirmedBookings / totalBookings : 0

  // Todos score — 0 if no todos yet
  const totalTodos = trip.todos?.length || 0
  const completedTodos = trip.todos?.filter(t => t.done).length || 0
  const todoScore = totalTodos > 0 ? completedTodos / totalTodos : 0

  // Packing score — 0 if no packing items yet
  const totalPacking = trip.packingList?.length || 0
  const packedItems = trip.packingList?.filter(p => p.packed).length || 0
  const packingScore = totalPacking > 0 ? packedItems / totalPacking : 0

  const score = Math.round(
    (bookingScore * weights.bookings +
     todoScore * weights.todos +
     packingScore * weights.packing) * 100
  )

  return Math.min(100, Math.max(0, score))
}

/**
 * Get readiness breakdown for display
 */
export function getReadinessBreakdown(trip) {
  if (!trip) return { bookings: { done: 0, total: 0 }, todos: { done: 0, total: 0 }, packing: { done: 0, total: 0 } }

  return {
    bookings: {
      done: trip.bookings?.filter(b => b.status === 'booked').length || 0,
      total: trip.bookings?.length || 0,
    },
    todos: {
      done: trip.todos?.filter(t => t.done).length || 0,
      total: trip.todos?.length || 0,
    },
    packing: {
      done: trip.packingList?.filter(p => p.packed).length || 0,
      total: trip.packingList?.length || 0,
    },
  }
}
