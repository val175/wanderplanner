import { CITY_DB } from '../components/shared/CityCombobox'

const COUNTRY_CODE_LOOKUP = new Map(
  CITY_DB.map(entry => [entry.country.trim().toLowerCase(), entry.iso])
)

export function normalizeCountryCode(country) {
  if (!country) return null
  const trimmed = country.toString().trim()
  if (!trimmed) return null
  if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase()
  return COUNTRY_CODE_LOOKUP.get(trimmed.toLowerCase()) || null
}

export function buildTripCountryCodes(trip) {
  const sourceEntries = [
    ...(trip?.cities || []),
    ...(trip?.destinations || []),
  ]

  return [...new Set(sourceEntries
    .map(entry => normalizeCountryCode(entry?.iso || entry?.countryCode || entry?.country))
    .filter(Boolean))]
}

/** Returns the best matching city for a day, based on day.location string. */
function resolveDayCity(day, cities) {
  if (!day?.location || !cities?.length) return null
  const loc = day.location.toLowerCase()
  const matches = cities.filter(c => c.city && loc.includes(c.city.toLowerCase()))
  if (!matches.length) return null
  // For transit days ("Cebu → Singapore"), prefer the last matching city (arrival)
  return matches[matches.length - 1]
}

/**
 * Returns a Map<dayId, { dayNumber, date, city, country, flag, label, isTransit }>
 * for all days in the trip, keyed by day.id for O(1) lookup.
 */
export function getDayLocationMap(trip) {
  const result = new Map()
  const itinerary = trip?.itinerary || []
  const cities = trip?.cities || []
  for (const day of itinerary) {
    const resolved = resolveDayCity(day, cities)
    result.set(day.id, {
      dayNumber: day.dayNumber,
      date: day.date,
      city: resolved?.city || null,
      country: resolved?.country || null,
      flag: resolved?.flag || '',
      label: resolved ? `${resolved.city}, ${resolved.country}` : (day.location || 'Unknown'),
      isTransit: (day.location || '').includes('→'),
    })
  }
  return result
}

/** Extracts a likely city name from a geocoder address string (comma-split, second-to-last token). */
function extractCityFromAddress(address) {
  if (!address) return null
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null
}

/**
 * Returns a conflict object if the activity's location doesn't match the day's expected city.
 * Returns null if no conflict (or not enough data to determine).
 */
export function detectLocationConflict(activityLocation, expectedDayEntry) {
  if (!activityLocation || !expectedDayEntry?.city) return null
  const locationText = activityLocation?.placeName
    || activityLocation?.address
    || (typeof activityLocation === 'string' ? activityLocation : '')
  if (!locationText) return null

  const lc = locationText.toLowerCase()
  if (lc.includes(expectedDayEntry.city.toLowerCase())) return null
  if (expectedDayEntry.country && lc.includes(expectedDayEntry.country.toLowerCase())) return null

  return {
    expectedCity: expectedDayEntry.city,
    expectedCountry: expectedDayEntry.country,
    detectedCity: extractCityFromAddress(locationText) || locationText,
    isTransit: expectedDayEntry.isTransit,
  }
}
