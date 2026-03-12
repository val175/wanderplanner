import { getCurrencySymbol } from '../constants/currencies'

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function formatDate(dateStr, style = 'medium') {
  if (!dateStr) return ''
  // Only append T00:00:00 for plain date strings (YYYY-MM-DD) to avoid timezone shifting.
  // Full ISO datetimes already have a time component — appending would make them invalid.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr)) ? dateStr + 'T00:00:00' : dateStr
  const date = new Date(normalized)
  if (isNaN(date.getTime())) return String(dateStr)

  switch (style) {
    case 'short':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'medium':
      const parts = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }).split(', ')
      const yearPart = parts[1]
      return `${parts[0]}, '${yearPart}`
    case 'long':
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    case 'full':
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    case 'weekday':
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    default:
      const dParts = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }).split(', ')
      const dYearPart = dParts[1]
      return `${dParts[0]}, '${dYearPart}`
  }
}

export function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return ''
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`
}

export function formatCurrency(amount, currencyCode = 'PHP', showDecimals = false) {
  if (amount == null || isNaN(amount)) return ''
  const symbol = getCurrencySymbol(currencyCode)
  const options = showDecimals
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  return `${symbol}${Number(amount).toLocaleString('en-US', options)}`
}

export function formatCurrencyRange(min, max, currencyCode = 'PHP') {
  return `${formatCurrency(min, currencyCode)} – ${formatCurrency(max, currencyCode)}`
}

export function daysBetween(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
}

export function daysUntil(targetDate) {
  if (!targetDate) return null
  const now = new Date()
  const target = new Date(targetDate + 'T00:00:00')
  const diff = target - now
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || singular + 's')
}

/** 
 * Calculate distance between two coordinate pairs in kilometers 
 * using the Haversine formula
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Module-level geocoding cache — persists across renders and trip switches.
 * Key: "City|Country" (with country hint) or "City" (without).
 * This makes switching back to a previously-viewed trip instant.
 */
const _geocodeCache = {}

/**
 * Fetch latitude/longitude for a given city using Open-Meteo Geocoding.
 * @param {string} cityStr   City name (e.g. "Santander")
 * @param {string} [countryHint]  Country name (or "Country, Region") to disambiguate (e.g. "Philippines, Cebu")
 */
export async function geocodeCity(cityStr, countryHint = null) {
  const cacheKey = countryHint ? `${cityStr}|${countryHint}` : cityStr
  if (_geocodeCache[cacheKey]) return _geocodeCache[cacheKey]

  // Parse the country hint BEFORE building the API query so we can bake the
  // region into the search term itself. Searching "San Juan La Union" returns
  // the right municipality directly, whereas "San Juan" returns the Metro Manila
  // one first — the La Union result may never appear in the top 15 hits at all.
  let targetCountry = null
  let targetRegion = null
  if (countryHint) {
    const hintParts = countryHint.split(',').map(s => s.trim())
    targetCountry = hintParts[0].toLowerCase()
    targetRegion = hintParts.length > 1 ? hintParts.slice(1).join(', ').trim().toLowerCase() : null
  }

  try {
    // Stage 1: try city+region query for best precision (e.g. "San Juan la union").
    // Stage 2: fall back to city-only with a higher count if stage 1 returns nothing.
    // The combined query can return zero hits for small municipalities, so we must
    // always have a fallback — otherwise geocodeCity returns null and the map breaks.
    let results = []

    if (targetRegion) {
      const r1 = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(`${cityStr} ${targetRegion}`)}&count=10&language=en&format=json`)
      const d1 = await r1.json()
      results = d1.results || []
    }

    if (results.length === 0) {
      // Broader fallback — more results give the filter logic a better chance
      const r2 = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityStr)}&count=20&language=en&format=json`)
      const d2 = await r2.json()
      results = d2.results || []
    }

    if (results.length > 0) {
      let matchedResult = results[0] // default to top hit

      if (targetCountry) {
        // Confirm country + region across ALL admin levels.
        // admin1 = state/region, admin2 = province/county, admin3/4 = finer divisions.
        const perfectMatch = targetRegion
          ? results.find(r => {
            if ((r.country || '').toLowerCase() !== targetCountry) return false
            const regionPool = [r.admin1, r.admin2, r.admin3, r.admin4]
              .filter(Boolean)
              .map(a => a.toLowerCase())
            return regionPool.some(a => a.includes(targetRegion) || targetRegion.includes(a))
          })
          : null

        // Country-only match as second-best fallback
        const countryMatch = results.find(r =>
          (r.country || '').toLowerCase() === targetCountry
        )

        if (perfectMatch) matchedResult = perfectMatch
        else if (countryMatch) matchedResult = countryMatch
      }

      const result = [matchedResult.longitude, matchedResult.latitude]
      _geocodeCache[cacheKey] = result
      return result
    }
  } catch (err) {
    console.error("Geocoding failed for", cityStr, err)
  }
  return null
}

/**
 * Adds minutes to a time string and returns the result in 24-hour format (HH:mm).
 * Handles both "HH:mm" and "HH:mm AM/PM" formats.
 * Handles day-wrapping (e.g., "23:30" + 60 = "00:30").
 */
export function addMinutesToTime(timeStr, minutes) {
  if (!timeStr || typeof timeStr !== 'string') return ''
  
  const trimmed = timeStr.trim().toUpperCase()
  if (!trimmed) return ''

  // Normalize time string to [hours, minutes]
  let hours, mins
  if (trimmed.includes('AM') || trimmed.includes('PM')) {
    const parts = trimmed.split(/\s+/)
    const time = parts[0]
    const modifier = parts[1] || (trimmed.endsWith('AM') ? 'AM' : 'PM')
    const [h, m] = time.split(':').map(Number)
    hours = h
    mins = m
    if (modifier === 'PM' && hours < 12) hours += 12
    if (modifier === 'AM' && hours === 12) hours = 0
  } else {
    const [h, m] = trimmed.split(':').map(Number)
    hours = h
    mins = m
  }

  const date = new Date()
  date.setHours(hours, mins + minutes, 0, 0)

  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Calculates the difference in minutes between two time strings.
 * Returns an integer. Assumes same-day or handles forward-only delta.
 */
export function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0

  const parseToMins = (str) => {
    let hours, mins
    if (str.toUpperCase().includes('AM') || str.toUpperCase().includes('PM')) {
      const [time, modifier] = str.split(' ')
      const [h, m] = time.split(':').map(Number)
      hours = h
      mins = m
      if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12
      if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0
    } else {
      const [h, m] = str.split(':').map(Number)
      hours = h
      mins = m
    }
    return hours * 60 + mins
  }

  const startTotal = parseToMins(startTime)
  let endTotal = parseToMins(endTime)

  // Handle day wrap if end is before start
  if (endTotal < startTotal) {
    endTotal += 24 * 60
  }

  return endTotal - startTotal
}
