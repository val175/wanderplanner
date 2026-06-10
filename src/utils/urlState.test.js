import { describe, it, expect } from 'vitest'
import { parseTripPath, buildTripPath } from './urlState'

describe('parseTripPath', () => {
  it('parses /trips/:id as overview', () => {
    expect(parseTripPath('/trips/abc123')).toEqual({ tripId: 'abc123', tab: 'overview' })
    expect(parseTripPath('/trips/abc123/')).toEqual({ tripId: 'abc123', tab: 'overview' })
  })

  it('parses /trips/:id/:tab for known tabs', () => {
    expect(parseTripPath('/trips/abc/budget')).toEqual({ tripId: 'abc', tab: 'budget' })
    expect(parseTripPath('/trips/abc/wandermap')).toEqual({ tripId: 'abc', tab: 'wandermap' })
    expect(parseTripPath('/trips/abc/wrap-up')).toEqual({ tripId: 'abc', tab: 'wrap-up' })
  })

  it('falls back to overview for unknown tabs', () => {
    expect(parseTripPath('/trips/abc/not-a-tab')).toEqual({ tripId: 'abc', tab: 'overview' })
  })

  it('returns null for non-trip paths', () => {
    expect(parseTripPath('/')).toBeNull()
    expect(parseTripPath('/trips')).toBeNull()
    expect(parseTripPath('/trips/')).toBeNull()
    expect(parseTripPath('/settings/profile/extra/deep')).toBeNull()
  })

  it('decodes encoded trip ids', () => {
    expect(parseTripPath('/trips/a%20b/budget')).toEqual({ tripId: 'a b', tab: 'budget' })
  })
})

describe('buildTripPath', () => {
  it('omits the tab segment for overview', () => {
    expect(buildTripPath('abc', 'overview')).toBe('/trips/abc')
    expect(buildTripPath('abc', null)).toBe('/trips/abc')
  })

  it('appends non-overview tabs', () => {
    expect(buildTripPath('abc', 'budget')).toBe('/trips/abc/budget')
  })

  it('round-trips through parseTripPath', () => {
    for (const tab of ['overview', 'budget', 'itinerary', 'wrap-up']) {
      const path = buildTripPath('trip-1', tab)
      expect(parseTripPath(path)).toEqual({ tripId: 'trip-1', tab })
    }
  })

  it('encodes awkward trip ids', () => {
    const path = buildTripPath('a b', 'budget')
    expect(path).toBe('/trips/a%20b/budget')
    expect(parseTripPath(path)).toEqual({ tripId: 'a b', tab: 'budget' })
  })
})
