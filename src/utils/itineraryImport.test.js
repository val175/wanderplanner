import { describe, it, expect } from 'vitest'
import {
  parseStructuredTextItinerary,
  normalizeImportedDays,
  mergeImportedItinerary,
} from './itineraryImport'
import { tripReducer, ACTIONS } from '../state/tripReducer'

const SAMPLE_MD = `# Mahalos Do MCR: SG & KL Itinerary

Nov 9, 2026 · @Val Bonite

## Trip at a glance

| Day | Date | City | Theme |
| --- | --- | --- | --- |
| 1 | Sat, Nov 14 | Singapore | Arrive 5 PM |

## Singapore (Nov 14 to 18)

### Day 1 · Sat, Nov 14 · Arrival

- **5:00 PM** Land at Changi. Clear immigration.
- **8:30 PM** **Juli's belated birthday dinner at LeVeL33.** Booked for 8:30 PM, window or terrace table.
- **10:00 PM** **Spectra** (Saturdays have a 10 PM show), then MRT home from Bayfront.

**Proposed order for two at LeVeL33**

| Course | Dish | Price |
| --- | --- | --- |
| Total | With service and GST | about S$255 |

### Day 2 · Sun, Nov 15 · Marina Bay classics

- **1:00 PM** Gardens by the Bay: **Cloud Forest and Flower Dome** (about S$46 each). Allow 2.5 hours.

## Kuala Lumpur (Nov 18 to 22)

### Day 5 · Wed, Nov 18 · Fly to KL, Petronas evening

- **10:00 AM** Land in KL. Firefly FY3692.
- **Evening** Back via KLCC LRT, or stay for the Lake Symphony fountain show.

### Day 7 · Fri, Nov 20 · MCR concert day

- **8:30 PM** **My Chemical Romance.**
- *Note:* Concert traffic will be heavy.

## Book before you fly

- Gardens by the Bay tickets
`

describe('parseStructuredTextItinerary', () => {
  it('parses multi-city Markdown days, times, costs, categories, and stops before trailing sections', () => {
    const days = parseStructuredTextItinerary(SAMPLE_MD, { startDate: '2026-11-14' })

    expect(days).toHaveLength(4)

    expect(days[0].dayNumber).toBe(1)
    expect(days[0].date).toBe('2026-11-14')
    expect(days[0].location).toBe('Singapore')
    expect(days[0].activities).toHaveLength(3)
    expect(days[0].activities[0]).toMatchObject({
      time: '17:00',
      category: 'flight',
      name: 'Land at Changi',
    })
    expect(days[0].activities[1]).toMatchObject({
      time: '20:30',
      category: 'food',
      name: "Juli's belated birthday dinner at LeVeL33",
      notes: 'Booked for 8:30 PM, window or terrace table.',
    })

    expect(days[1].dayNumber).toBe(2)
    expect(days[1].date).toBe('2026-11-15')
    expect(days[1].activities[0].duration).toBe(150)
    expect(days[1].activities[0].estCost).toBe('S$46')

    expect(days[2].dayNumber).toBe(5)
    expect(days[2].location).toBe('Kuala Lumpur')
    expect(days[2].activities[1].time).toBe('19:00')

    expect(days[3].dayNumber).toBe(7)
    expect(days[3].activities[0]).toMatchObject({
      time: '20:30',
      category: 'concert',
      name: 'My Chemical Romance',
    })
    expect(days[3].notes).toContain('Concert traffic will be heavy.')
  })
})

describe('mergeImportedItinerary', () => {
  const existing = [
    {
      id: 'd1',
      dayNumber: 1,
      date: '2026-11-14',
      location: 'New Location',
      emoji: '📍',
      notes: '',
      activities: [
        { id: 'a1', time: '17:00', name: 'Land at Changi', category: 'flight' },
      ],
    },
  ]

  const imported = normalizeImportedDays([
    {
      dayNumber: 1,
      date: '2026-11-14',
      location: 'Singapore',
      activities: [
        { time: '17:00', name: 'Land at Changi', category: 'flight' },
        { time: '20:30', name: 'Dinner at LeVeL33', category: 'food' },
      ],
    },
    {
      dayNumber: 2,
      date: '2026-11-15',
      location: 'Singapore',
      activities: [
        { time: '09:00', name: 'Marina Bay Walk', category: 'activity' },
      ],
    },
  ])

  it('merges into matching days, deduplicates identical stops, and fills empty location', () => {
    const merged = mergeImportedItinerary(existing, imported, 'merge', ['u1'])
    expect(merged).toHaveLength(2)
    expect(merged[0].location).toBe('Singapore')
    expect(merged[0].activities.map(a => a.name)).toEqual([
      'Land at Changi',
      'Dinner at LeVeL33',
    ])
    expect(merged[0].activities[1].participantIds).toEqual(['u1'])
    expect(merged[1].dayNumber).toBe(2)
  })

  it('replaces existing itinerary when mode is replace', () => {
    const replaced = mergeImportedItinerary(existing, imported, 'replace', ['u1'])
    expect(replaced).toHaveLength(2)
    expect(replaced[0].activities).toHaveLength(2)
  })

  it('appends after the last day when mode is append', () => {
    const appended = mergeImportedItinerary(existing, imported, 'append', ['u1'])
    expect(appended).toHaveLength(3)
    expect(appended[1].dayNumber).toBe(2)
    expect(appended[2].dayNumber).toBe(3)
  })
})

describe('itinerarySlice IMPORT_ITINERARY & RESTORE_ITINERARY', () => {
  it('imports and restores itinerary via tripReducer', () => {
    const initialState = {
      activeTripId: 't1',
      trips: {
        t1: {
          id: 't1',
          travelerIds: ['u1', 'u2'],
          itinerary: [
            { id: 'orig', dayNumber: 1, date: '2026-11-14', location: 'Singapore', activities: [] },
          ],
        },
      },
    }

    const importedDays = normalizeImportedDays([
      {
        dayNumber: 1,
        date: '2026-11-14',
        location: 'Singapore',
        activities: [{ time: '20:30', name: 'Dinner at LeVeL33', category: 'food' }],
      },
    ])

    const afterImport = tripReducer(initialState, {
      type: ACTIONS.IMPORT_ITINERARY,
      payload: { days: importedDays, mode: 'merge' },
    })

    expect(afterImport.trips.t1.itinerary[0].activities).toHaveLength(1)
    expect(afterImport.trips.t1.itinerary[0].activities[0].participantIds).toEqual(['u1', 'u2'])

    const restored = tripReducer(afterImport, {
      type: ACTIONS.RESTORE_ITINERARY,
      payload: { itinerary: initialState.trips.t1.itinerary },
    })
    expect(restored.trips.t1.itinerary[0].activities).toHaveLength(0)
  })
})
