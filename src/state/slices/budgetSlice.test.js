import { describe, it, expect } from 'vitest'
import { budgetCases } from './budgetSlice'

function makeState() {
  return {
    activeTripId: 't1',
    trips: {
      t1: {
        id: 't1',
        budget: [
          { id: 'b1', name: 'Flights', emoji: '✈️', min: 0, max: 1000, actual: 0 },
          { id: 'b2', name: 'Food & Drink', emoji: '🍜', min: 0, max: 500, actual: 100 },
          { id: 'b3', name: 'Hotels', emoji: '🏨', min: 0, max: 800, actual: 200 },
        ],
        spendingLog: [],
      },
    },
  }
}

describe('ADD_SPENDING', () => {
  it('appends a log entry and bumps the matching category actual', () => {
    const next = budgetCases.ADD_SPENDING(makeState(), {
      description: 'MNL→TYO', amount: 350, category: 'Flights', paidBy: 'a',
    })
    const trip = next.trips.t1
    expect(trip.spendingLog).toHaveLength(1)
    expect(trip.budget.find(b => b.name === 'Flights').actual).toBe(350)
  })

  it('resolves alias categories (e.g. "flight" → "Flights")', () => {
    const next = budgetCases.ADD_SPENDING(makeState(), {
      description: 'Airfare', amount: 200, category: 'flight',
    })
    const trip = next.trips.t1
    expect(trip.spendingLog[0].category).toBe('Flights')
    expect(trip.budget.find(b => b.name === 'Flights').actual).toBe(200)
  })

  it('resolves "hotel" alias into the Hotels category', () => {
    const next = budgetCases.ADD_SPENDING(makeState(), {
      description: 'Shibuya stay', amount: 150, category: 'hotel',
    })
    const trip = next.trips.t1
    expect(trip.spendingLog[0].category).toBe('Hotels')
    expect(trip.budget.find(b => b.name === 'Hotels').actual).toBe(350)
  })

  it('leaves unknown categories as-is without touching budget actuals', () => {
    const next = budgetCases.ADD_SPENDING(makeState(), {
      description: 'Mystery', amount: 75, category: 'Souvenirs of Doom',
    })
    const trip = next.trips.t1
    expect(trip.spendingLog).toHaveLength(1)
    expect(trip.budget.every(b => [0, 100, 200].includes(b.actual))).toBe(true)
  })
})

describe('UPDATE_SPENDING', () => {
  it('moves the amount between categories when category changes', () => {
    let state = budgetCases.ADD_SPENDING(makeState(), {
      id: 's1', description: 'Dinner', amount: 80, category: 'Food & Drink',
    })
    state = budgetCases.UPDATE_SPENDING(state, {
      id: 's1', updates: { category: 'Hotels' },
    })
    const trip = state.trips.t1
    expect(trip.budget.find(b => b.name === 'Food & Drink').actual).toBe(100) // back to base
    expect(trip.budget.find(b => b.name === 'Hotels').actual).toBe(280)        // base 200 + 80
  })

  it('adjusts the actual when only the amount changes', () => {
    let state = budgetCases.ADD_SPENDING(makeState(), {
      id: 's1', description: 'Dinner', amount: 80, category: 'Food & Drink',
    })
    state = budgetCases.UPDATE_SPENDING(state, {
      id: 's1', updates: { amount: 120 },
    })
    expect(state.trips.t1.budget.find(b => b.name === 'Food & Drink').actual).toBe(220)
  })

  it('is a no-op for unknown entry ids', () => {
    const state = makeState()
    const next = budgetCases.UPDATE_SPENDING(state, { id: 'nope', updates: { amount: 1 } })
    expect(next.trips.t1).toEqual(state.trips.t1)
  })
})

describe('DELETE_SPENDING', () => {
  it('removes the entry and decrements the category actual', () => {
    let state = budgetCases.ADD_SPENDING(makeState(), {
      id: 's1', description: 'Dinner', amount: 80, category: 'Food & Drink',
    })
    state = budgetCases.DELETE_SPENDING(state, 's1')
    const trip = state.trips.t1
    expect(trip.spendingLog).toHaveLength(0)
    expect(trip.budget.find(b => b.name === 'Food & Drink').actual).toBe(100)
  })

  it('never lets an actual go below zero', () => {
    const state = makeState()
    // Hand-craft a log entry larger than the category actual
    state.trips.t1.spendingLog = [{ id: 's9', amount: 9999, category: 'Hotels' }]
    const next = budgetCases.DELETE_SPENDING(state, 's9')
    expect(next.trips.t1.budget.find(b => b.name === 'Hotels').actual).toBe(0)
  })
})
