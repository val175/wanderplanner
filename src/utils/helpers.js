import { getCurrencySymbol } from '../constants/currencies'

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function formatDate(dateStr, style = 'medium') {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return dateStr

  switch (style) {
    case 'short':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'medium':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    case 'long':
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    case 'full':
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    case 'weekday':
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    default:
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

export function formatCurrency(amount, currencyCode = 'PHP') {
  if (amount == null || isNaN(amount)) return ''
  const symbol = getCurrencySymbol(currencyCode)
  return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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
 * @param {string} [countryHint]  Country name to disambiguate (e.g. "Philippines")
 *   Without a hint, "Santander" → Santander, Spain.
 *   With hint "Philippines" → searches "Santander Philippines" first.
 */
export async function geocodeCity(cityStr, countryHint = null) {
  const cacheKey = countryHint ? `${cityStr}|${countryHint}` : cityStr
  if (_geocodeCache[cacheKey]) return _geocodeCache[cacheKey]

  try {
    // First attempt: city + country for accurate disambiguation
    if (countryHint) {
      const q = encodeURIComponent(`${cityStr} ${countryHint}`)
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=3&language=en&format=json`)
      const data = await res.json()
      if (data.results?.length > 0) {
        const result = [data.results[0].longitude, data.results[0].latitude]
        _geocodeCache[cacheKey] = result
        return result
      }
    }
    // Fallback: city name only
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityStr)}&count=1&language=en&format=json`)
    const data = await res.json()
    if (data.results?.length > 0) {
      const result = [data.results[0].longitude, data.results[0].latitude]
      _geocodeCache[cacheKey] = result
      return result
    }
  } catch (err) {
    console.error("Geocoding failed for", cityStr, err)
  }
  return null
}
