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

