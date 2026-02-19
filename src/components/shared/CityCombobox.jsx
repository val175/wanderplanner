/**
 * CityCombobox — shared autocomplete input for city selection.
 * Used in: NewTripModal (Step 2), CitiesTab (Add City form)
 *
 * Renders a text input that filters CITY_DB as the user types.
 * Selecting a suggestion auto-fills city, country, and flag.
 * Free-text entry is also allowed for unlisted cities.
 *
 * Props:
 *   value     {string}   current city name (controlled)
 *   country   {string}   current country (used for blur resolution)
 *   flag      {string}   current flag emoji
 *   onChange  {fn}       called with { city, country, flag } on every change
 *   placeholder {string} input placeholder text (default: "City")
 *   className {string}   extra classes on the input element
 */

import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

// ── City dataset ─────────────────────────────────────────────────────────────
// 200+ popular travel destinations, sorted roughly by popularity.
// `iso` is the 2-letter ISO 3166-1 alpha-2 country code for flag derivation.
export const CITY_DB = [
  // Southeast Asia
  { city: 'Bangkok', country: 'Thailand', iso: 'TH' },
  { city: 'Phuket', country: 'Thailand', iso: 'TH' },
  { city: 'Chiang Mai', country: 'Thailand', iso: 'TH' },
  { city: 'Koh Samui', country: 'Thailand', iso: 'TH' },
  { city: 'Krabi', country: 'Thailand', iso: 'TH' },
  { city: 'Pattaya', country: 'Thailand', iso: 'TH' },
  { city: 'Singapore', country: 'Singapore', iso: 'SG' },
  { city: 'Bali', country: 'Indonesia', iso: 'ID' },
  { city: 'Jakarta', country: 'Indonesia', iso: 'ID' },
  { city: 'Yogyakarta', country: 'Indonesia', iso: 'ID' },
  { city: 'Lombok', country: 'Indonesia', iso: 'ID' },
  { city: 'Komodo', country: 'Indonesia', iso: 'ID' },
  { city: 'Kuala Lumpur', country: 'Malaysia', iso: 'MY' },
  { city: 'Penang', country: 'Malaysia', iso: 'MY' },
  { city: 'Langkawi', country: 'Malaysia', iso: 'MY' },
  { city: 'Kota Kinabalu', country: 'Malaysia', iso: 'MY' },
  { city: 'Ho Chi Minh City', country: 'Vietnam', iso: 'VN' },
  { city: 'Hanoi', country: 'Vietnam', iso: 'VN' },
  { city: 'Da Nang', country: 'Vietnam', iso: 'VN' },
  { city: 'Hoi An', country: 'Vietnam', iso: 'VN' },
  { city: 'Ha Long Bay', country: 'Vietnam', iso: 'VN' },
  { city: 'Siem Reap', country: 'Cambodia', iso: 'KH' },
  { city: 'Phnom Penh', country: 'Cambodia', iso: 'KH' },
  { city: 'Luang Prabang', country: 'Laos', iso: 'LA' },
  { city: 'Vientiane', country: 'Laos', iso: 'LA' },
  { city: 'Yangon', country: 'Myanmar', iso: 'MM' },
  { city: 'Mandalay', country: 'Myanmar', iso: 'MM' },
  { city: 'Manila', country: 'Philippines', iso: 'PH' },
  { city: 'Cebu', country: 'Philippines', iso: 'PH' },
  { city: 'Boracay', country: 'Philippines', iso: 'PH' },
  { city: 'Palawan', country: 'Philippines', iso: 'PH' },
  { city: 'Davao', country: 'Philippines', iso: 'PH' },
  { city: 'Siargao', country: 'Philippines', iso: 'PH' },
  // East Asia
  { city: 'Tokyo', country: 'Japan', iso: 'JP' },
  { city: 'Osaka', country: 'Japan', iso: 'JP' },
  { city: 'Kyoto', country: 'Japan', iso: 'JP' },
  { city: 'Hiroshima', country: 'Japan', iso: 'JP' },
  { city: 'Nara', country: 'Japan', iso: 'JP' },
  { city: 'Sapporo', country: 'Japan', iso: 'JP' },
  { city: 'Fukuoka', country: 'Japan', iso: 'JP' },
  { city: 'Seoul', country: 'South Korea', iso: 'KR' },
  { city: 'Busan', country: 'South Korea', iso: 'KR' },
  { city: 'Jeju', country: 'South Korea', iso: 'KR' },
  { city: 'Taipei', country: 'Taiwan', iso: 'TW' },
  { city: 'Tainan', country: 'Taiwan', iso: 'TW' },
  { city: 'Hong Kong', country: 'Hong Kong', iso: 'HK' },
  { city: 'Macau', country: 'Macau', iso: 'MO' },
  { city: 'Beijing', country: 'China', iso: 'CN' },
  { city: 'Shanghai', country: 'China', iso: 'CN' },
  { city: 'Chengdu', country: 'China', iso: 'CN' },
  { city: "Xi'an", country: 'China', iso: 'CN' },
  { city: 'Guilin', country: 'China', iso: 'CN' },
  // South Asia
  { city: 'Mumbai', country: 'India', iso: 'IN' },
  { city: 'New Delhi', country: 'India', iso: 'IN' },
  { city: 'Agra', country: 'India', iso: 'IN' },
  { city: 'Jaipur', country: 'India', iso: 'IN' },
  { city: 'Goa', country: 'India', iso: 'IN' },
  { city: 'Kerala', country: 'India', iso: 'IN' },
  { city: 'Varanasi', country: 'India', iso: 'IN' },
  { city: 'Colombo', country: 'Sri Lanka', iso: 'LK' },
  { city: 'Kandy', country: 'Sri Lanka', iso: 'LK' },
  { city: 'Kathmandu', country: 'Nepal', iso: 'NP' },
  { city: 'Pokhara', country: 'Nepal', iso: 'NP' },
  { city: 'Dhaka', country: 'Bangladesh', iso: 'BD' },
  { city: 'Maldives', country: 'Maldives', iso: 'MV' },
  // Middle East
  { city: 'Dubai', country: 'UAE', iso: 'AE' },
  { city: 'Abu Dhabi', country: 'UAE', iso: 'AE' },
  { city: 'Doha', country: 'Qatar', iso: 'QA' },
  { city: 'Istanbul', country: 'Turkey', iso: 'TR' },
  { city: 'Cappadocia', country: 'Turkey', iso: 'TR' },
  { city: 'Antalya', country: 'Turkey', iso: 'TR' },
  { city: 'Bodrum', country: 'Turkey', iso: 'TR' },
  { city: 'Tel Aviv', country: 'Israel', iso: 'IL' },
  { city: 'Jerusalem', country: 'Israel', iso: 'IL' },
  { city: 'Amman', country: 'Jordan', iso: 'JO' },
  { city: 'Petra', country: 'Jordan', iso: 'JO' },
  { city: 'Muscat', country: 'Oman', iso: 'OM' },
  { city: 'Riyadh', country: 'Saudi Arabia', iso: 'SA' },
  { city: 'Beirut', country: 'Lebanon', iso: 'LB' },
  // Europe — Western
  { city: 'Paris', country: 'France', iso: 'FR' },
  { city: 'Nice', country: 'France', iso: 'FR' },
  { city: 'Lyon', country: 'France', iso: 'FR' },
  { city: 'Marseille', country: 'France', iso: 'FR' },
  { city: 'London', country: 'UK', iso: 'GB' },
  { city: 'Edinburgh', country: 'UK', iso: 'GB' },
  { city: 'Manchester', country: 'UK', iso: 'GB' },
  { city: 'Dublin', country: 'Ireland', iso: 'IE' },
  { city: 'Amsterdam', country: 'Netherlands', iso: 'NL' },
  { city: 'Brussels', country: 'Belgium', iso: 'BE' },
  { city: 'Berlin', country: 'Germany', iso: 'DE' },
  { city: 'Munich', country: 'Germany', iso: 'DE' },
  { city: 'Hamburg', country: 'Germany', iso: 'DE' },
  { city: 'Frankfurt', country: 'Germany', iso: 'DE' },
  { city: 'Vienna', country: 'Austria', iso: 'AT' },
  { city: 'Salzburg', country: 'Austria', iso: 'AT' },
  { city: 'Zurich', country: 'Switzerland', iso: 'CH' },
  { city: 'Geneva', country: 'Switzerland', iso: 'CH' },
  { city: 'Interlaken', country: 'Switzerland', iso: 'CH' },
  { city: 'Grindelwald', country: 'Switzerland', iso: 'CH' },
  { city: 'Zermatt', country: 'Switzerland', iso: 'CH' },
  { city: 'Lucerne', country: 'Switzerland', iso: 'CH' },
  { city: 'Bern', country: 'Switzerland', iso: 'CH' },
  // Europe — Southern
  { city: 'Rome', country: 'Italy', iso: 'IT' },
  { city: 'Milan', country: 'Italy', iso: 'IT' },
  { city: 'Venice', country: 'Italy', iso: 'IT' },
  { city: 'Florence', country: 'Italy', iso: 'IT' },
  { city: 'Naples', country: 'Italy', iso: 'IT' },
  { city: 'Amalfi Coast', country: 'Italy', iso: 'IT' },
  { city: 'Sicily', country: 'Italy', iso: 'IT' },
  { city: 'Barcelona', country: 'Spain', iso: 'ES' },
  { city: 'Madrid', country: 'Spain', iso: 'ES' },
  { city: 'Seville', country: 'Spain', iso: 'ES' },
  { city: 'Valencia', country: 'Spain', iso: 'ES' },
  { city: 'Ibiza', country: 'Spain', iso: 'ES' },
  { city: 'Mallorca', country: 'Spain', iso: 'ES' },
  { city: 'Lisbon', country: 'Portugal', iso: 'PT' },
  { city: 'Porto', country: 'Portugal', iso: 'PT' },
  { city: 'Algarve', country: 'Portugal', iso: 'PT' },
  { city: 'Athens', country: 'Greece', iso: 'GR' },
  { city: 'Santorini', country: 'Greece', iso: 'GR' },
  { city: 'Mykonos', country: 'Greece', iso: 'GR' },
  { city: 'Crete', country: 'Greece', iso: 'GR' },
  { city: 'Rhodes', country: 'Greece', iso: 'GR' },
  { city: 'Corfu', country: 'Greece', iso: 'GR' },
  // Europe — Northern & Eastern
  { city: 'Copenhagen', country: 'Denmark', iso: 'DK' },
  { city: 'Stockholm', country: 'Sweden', iso: 'SE' },
  { city: 'Oslo', country: 'Norway', iso: 'NO' },
  { city: 'Helsinki', country: 'Finland', iso: 'FI' },
  { city: 'Reykjavik', country: 'Iceland', iso: 'IS' },
  { city: 'Prague', country: 'Czech Republic', iso: 'CZ' },
  { city: 'Budapest', country: 'Hungary', iso: 'HU' },
  { city: 'Warsaw', country: 'Poland', iso: 'PL' },
  { city: 'Krakow', country: 'Poland', iso: 'PL' },
  { city: 'Tallinn', country: 'Estonia', iso: 'EE' },
  { city: 'Riga', country: 'Latvia', iso: 'LV' },
  { city: 'Vilnius', country: 'Lithuania', iso: 'LT' },
  { city: 'Dubrovnik', country: 'Croatia', iso: 'HR' },
  { city: 'Split', country: 'Croatia', iso: 'HR' },
  { city: 'Zagreb', country: 'Croatia', iso: 'HR' },
  { city: 'Ljubljana', country: 'Slovenia', iso: 'SI' },
  { city: 'Bratislava', country: 'Slovakia', iso: 'SK' },
  { city: 'Bucharest', country: 'Romania', iso: 'RO' },
  { city: 'Sofia', country: 'Bulgaria', iso: 'BG' },
  { city: 'Sarajevo', country: 'Bosnia', iso: 'BA' },
  { city: 'Moscow', country: 'Russia', iso: 'RU' },
  { city: 'St. Petersburg', country: 'Russia', iso: 'RU' },
  // Americas — North
  { city: 'New York', country: 'USA', iso: 'US' },
  { city: 'Los Angeles', country: 'USA', iso: 'US' },
  { city: 'Chicago', country: 'USA', iso: 'US' },
  { city: 'San Francisco', country: 'USA', iso: 'US' },
  { city: 'Miami', country: 'USA', iso: 'US' },
  { city: 'Las Vegas', country: 'USA', iso: 'US' },
  { city: 'New Orleans', country: 'USA', iso: 'US' },
  { city: 'Washington DC', country: 'USA', iso: 'US' },
  { city: 'Boston', country: 'USA', iso: 'US' },
  { city: 'Seattle', country: 'USA', iso: 'US' },
  { city: 'Hawaii', country: 'USA', iso: 'US' },
  { city: 'Toronto', country: 'Canada', iso: 'CA' },
  { city: 'Vancouver', country: 'Canada', iso: 'CA' },
  { city: 'Montreal', country: 'Canada', iso: 'CA' },
  { city: 'Quebec City', country: 'Canada', iso: 'CA' },
  { city: 'Mexico City', country: 'Mexico', iso: 'MX' },
  { city: 'Cancún', country: 'Mexico', iso: 'MX' },
  { city: 'Tulum', country: 'Mexico', iso: 'MX' },
  { city: 'Oaxaca', country: 'Mexico', iso: 'MX' },
  { city: 'Guadalajara', country: 'Mexico', iso: 'MX' },
  // Americas — Central & Caribbean
  { city: 'Havana', country: 'Cuba', iso: 'CU' },
  { city: 'San José', country: 'Costa Rica', iso: 'CR' },
  { city: 'Cartagena', country: 'Colombia', iso: 'CO' },
  { city: 'Bogotá', country: 'Colombia', iso: 'CO' },
  { city: 'Medellín', country: 'Colombia', iso: 'CO' },
  { city: 'Panama City', country: 'Panama', iso: 'PA' },
  // Americas — South
  { city: 'Rio de Janeiro', country: 'Brazil', iso: 'BR' },
  { city: 'São Paulo', country: 'Brazil', iso: 'BR' },
  { city: 'Salvador', country: 'Brazil', iso: 'BR' },
  { city: 'Buenos Aires', country: 'Argentina', iso: 'AR' },
  { city: 'Patagonia', country: 'Argentina', iso: 'AR' },
  { city: 'Mendoza', country: 'Argentina', iso: 'AR' },
  { city: 'Lima', country: 'Peru', iso: 'PE' },
  { city: 'Cusco', country: 'Peru', iso: 'PE' },
  { city: 'Machu Picchu', country: 'Peru', iso: 'PE' },
  { city: 'Santiago', country: 'Chile', iso: 'CL' },
  { city: 'Valparaíso', country: 'Chile', iso: 'CL' },
  { city: 'Quito', country: 'Ecuador', iso: 'EC' },
  { city: 'Galápagos', country: 'Ecuador', iso: 'EC' },
  { city: 'Montevideo', country: 'Uruguay', iso: 'UY' },
  { city: 'La Paz', country: 'Bolivia', iso: 'BO' },
  // Africa
  { city: 'Cairo', country: 'Egypt', iso: 'EG' },
  { city: 'Luxor', country: 'Egypt', iso: 'EG' },
  { city: 'Sharm el-Sheikh', country: 'Egypt', iso: 'EG' },
  { city: 'Marrakech', country: 'Morocco', iso: 'MA' },
  { city: 'Casablanca', country: 'Morocco', iso: 'MA' },
  { city: 'Fes', country: 'Morocco', iso: 'MA' },
  { city: 'Cape Town', country: 'South Africa', iso: 'ZA' },
  { city: 'Johannesburg', country: 'South Africa', iso: 'ZA' },
  { city: 'Nairobi', country: 'Kenya', iso: 'KE' },
  { city: 'Zanzibar', country: 'Tanzania', iso: 'TZ' },
  { city: 'Serengeti', country: 'Tanzania', iso: 'TZ' },
  { city: 'Accra', country: 'Ghana', iso: 'GH' },
  { city: 'Lagos', country: 'Nigeria', iso: 'NG' },
  { city: 'Addis Ababa', country: 'Ethiopia', iso: 'ET' },
  // Oceania
  { city: 'Sydney', country: 'Australia', iso: 'AU' },
  { city: 'Melbourne', country: 'Australia', iso: 'AU' },
  { city: 'Brisbane', country: 'Australia', iso: 'AU' },
  { city: 'Perth', country: 'Australia', iso: 'AU' },
  { city: 'Cairns', country: 'Australia', iso: 'AU' },
  { city: 'Auckland', country: 'New Zealand', iso: 'NZ' },
  { city: 'Queenstown', country: 'New Zealand', iso: 'NZ' },
  { city: 'Christchurch', country: 'New Zealand', iso: 'NZ' },
  { city: 'Suva', country: 'Fiji', iso: 'FJ' },
  { city: 'Nadi', country: 'Fiji', iso: 'FJ' },
  { city: 'Papeete', country: 'French Polynesia', iso: 'PF' },
  { city: 'Bora Bora', country: 'French Polynesia', iso: 'PF' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert ISO 3166-1 alpha-2 code to flag emoji: "PH" → 🇵🇭 */
export function isoToFlag(iso2) {
  if (!iso2 || iso2.length !== 2) return '🌍'
  return String.fromCodePoint(
    0x1F1E6 + iso2.toUpperCase().charCodeAt(0) - 65,
    0x1F1E6 + iso2.toUpperCase().charCodeAt(1) - 65,
  )
}

/** Derive flag from a CITY_DB entry */
export function flagFromCity(cityEntry) {
  return isoToFlag(cityEntry.iso)
}

/** Lookup map: country name → flag emoji (built from CITY_DB) */
export const COUNTRY_FLAGS_MAP = Object.fromEntries(
  CITY_DB.map(e => [e.country, isoToFlag(e.iso)])
)

/**
 * Best-effort resolution: given whatever the user typed, return { city, country, flag }.
 * Priority: CITY_DB exact match → country name lookup → keep whatever we have.
 */
export function resolveCity(cityName, country, flag) {
  const cityTrimmed = cityName.trim()
  const countryTrimmed = country.trim()
  const dbMatch = CITY_DB.find(c => c.city.toLowerCase() === cityTrimmed.toLowerCase())
  if (dbMatch) {
    return { city: cityTrimmed, country: dbMatch.country, flag: isoToFlag(dbMatch.iso) }
  }
  const derivedFlag = COUNTRY_FLAGS_MAP[countryTrimmed] || flag || '🌍'
  return { city: cityTrimmed, country: countryTrimmed, flag: derivedFlag }
}

// ── CityCombobox component ────────────────────────────────────────────────────

export default function CityCombobox({
  value,
  country = '',
  flag = '',
  onChange,
  placeholder = 'City',
  className = '',
  autoFocus = false,
}) {
  // `query` is local — the uncommitted text in the input.
  // We only sync FROM parent when the parent resets (value becomes '').
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  // Position of the dropdown in viewport coords — avoids overflow-clip from ancestors
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const inputRef = useRef(null)

  // Only sync down when parent clears the field (modal/form reset)
  useEffect(() => {
    if (value === '') setQuery('')
    else if (value && value !== query) setQuery(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // useLayoutEffect fires before paint — ensures dropdown never renders at wrong position on first frame
  useLayoutEffect(() => {
    if (!open || !inputRef.current) return
    const reposition = () => {
      if (!inputRef.current) return
      const r = inputRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const prefix = CITY_DB.filter(c => c.city.toLowerCase().startsWith(q))
    const substr = CITY_DB.filter(c =>
      !c.city.toLowerCase().startsWith(q) && (
        c.city.toLowerCase().includes(q) ||
        c.country.toLowerCase().startsWith(q)
      )
    )
    return [...prefix, ...substr].slice(0, 8)
  }, [query])

  const commitSelection = (entry) => {
    const derivedFlag = flagFromCity(entry)
    setQuery(entry.city)
    setOpen(false)
    onChange({ city: entry.city, country: entry.country, flag: derivedFlag })
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    // Push free-text to parent immediately so adjacent country field stays in sync
    onChange({ city: val, country, flag })
  }

  const handleBlur = () => {
    // Delay so click on dropdown suggestion fires before blur closes it
    setTimeout(() => {
      setOpen(false)
      // On blur, attempt to resolve the typed city against CITY_DB so
      // free-typed known city names get their country + flag auto-filled
      if (query.trim()) {
        const resolved = resolveCity(query, country, flag)
        if (resolved.flag !== flag || resolved.country !== country) {
          setQuery(resolved.city)
          onChange(resolved)
        }
      }
    }, 150)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      commitSelection(suggestions[0])
    }
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => query.trim().length > 0 && setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className={`w-full px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)]
                   text-text-primary placeholder:text-text-muted text-sm
                   focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors
                   ${className}`}
      />
      {open && suggestions.length > 0 && createPortal(
        <ul
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            minWidth: '260px',
            width: 'max-content',
            maxWidth: '340px',
          }}
          className="z-[9999] bg-bg-primary border border-border rounded-[var(--radius-md)]
                     shadow-xl max-h-52 overflow-y-auto"
        >
          {suggestions.map((entry, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => commitSelection(entry)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left
                           hover:bg-bg-hover transition-colors"
              >
                <span className="text-lg flex-shrink-0 w-7 text-center">{flagFromCity(entry)}</span>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-text-primary leading-tight">{entry.city}</span>
                  <span className="text-xs text-text-muted leading-tight mt-0.5">{entry.country}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}
