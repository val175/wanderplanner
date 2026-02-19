import { useState, useMemo, useRef, useEffect } from 'react'
import Modal from '../shared/Modal'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TRIP_EMOJIS } from '../../constants/emojis'
import { CURRENCIES } from '../../constants/currencies'
import { createEmptyTrip } from '../../data/defaultTrip'
import { formatDate } from '../../utils/helpers'

const TOTAL_STEPS = 4

const DEFAULT_BUDGET_CATEGORIES = [
  { name: 'Flights', emoji: '✈️' },
  { name: 'Accommodation', emoji: '🏨' },
  { name: 'Food & Dining', emoji: '🍜' },
  { name: 'Activities', emoji: '🎯' },
  { name: 'Transport', emoji: '🚕' },
  { name: 'Shopping', emoji: '🛍️' },
  { name: 'Other', emoji: '📌' },
]

// Derives a flag emoji from a 2-letter ISO 3166-1 alpha-2 country code.
// Works by converting each letter to a Unicode Regional Indicator Symbol.
// e.g. "PH" → 🇵🇭, "JP" → 🇯🇵
function isoToFlag(iso2) {
  if (!iso2 || iso2.length !== 2) return '🌍'
  return String.fromCodePoint(
    0x1F1E6 + iso2.toUpperCase().charCodeAt(0) - 65,
    0x1F1E6 + iso2.toUpperCase().charCodeAt(1) - 65,
  )
}

// City dataset: { city, country, iso } — iso is 2-letter country code for flag derivation.
// 200+ popular travel destinations worldwide, sorted roughly by popularity.
const CITY_DB = [
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
  { city: 'Xi\'an', country: 'China', iso: 'CN' },
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
  { city: 'Colombo', country: 'Sri Lanka', iso: 'LK' },
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

// Derive flag from ISO code (works for any country, not just hardcoded ones)
function flagFromCity(cityEntry) {
  return isoToFlag(cityEntry.iso)
}

// Fallback map for when country name is typed manually (no ISO code available)
const COUNTRY_FLAGS_MAP = Object.fromEntries(
  CITY_DB.map(e => [e.country, isoToFlag(e.iso)])
)

/* ─────────────────── Step Indicator ─────────────────── */
function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1
        const isActive = step === currentStep
        const isCompleted = step < currentStep
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div className={`w-8 h-[2px] rounded-full transition-colors duration-300 ${isCompleted ? 'bg-accent' : 'bg-border'}`} />
            )}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300
              ${isActive ? 'bg-accent text-text-inverse ring-4 ring-accent/20'
                : isCompleted ? 'bg-accent text-text-inverse'
                : 'bg-bg-secondary text-text-muted border border-border'}`}
            >
              {isCompleted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : step}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────── Step 1: Basics ─────────────────── */
function StepBasics({ form, setForm }) {
  const [customEmoji, setCustomEmoji] = useState('')

  const handleCustomEmoji = (val) => {
    // Grab the first emoji character from the input
    const match = val.match(/\p{Emoji}/u)
    if (match) {
      setForm(f => ({ ...f, emoji: match[0] }))
      setCustomEmoji(match[0])
    } else {
      setCustomEmoji(val)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Name your adventure</h2>
        <p className="text-sm text-text-muted">What should we call this trip?</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Summer in Europe"
          className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)]
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          autoFocus
        />
      </div>

      {/* Emoji Picker — grid + free-type input */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip Emoji</label>
        <div className="grid grid-cols-10 gap-1.5 mb-2">
          {TRIP_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { setForm(f => ({ ...f, emoji })); setCustomEmoji('') }}
              className={`w-9 h-9 flex items-center justify-center text-lg rounded-[var(--radius-sm)] transition-all duration-150
                ${form.emoji === emoji && !customEmoji
                  ? 'bg-accent/15 ring-2 ring-accent scale-110'
                  : 'bg-bg-secondary hover:bg-bg-hover'
                }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        {/* Custom emoji input */}
        <div className="flex items-center gap-2">
          <span className="text-2xl w-9 h-9 flex items-center justify-center border border-border rounded-[var(--radius-sm)] bg-bg-secondary">
            {form.emoji}
          </span>
          <input
            type="text"
            value={customEmoji}
            onChange={e => handleCustomEmoji(e.target.value)}
            placeholder="Or type any emoji…"
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)]
                       text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>
      </div>

      {/* Travelers */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Travelers</label>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => setForm(f => ({ ...f, travelers: Math.max(1, f.travelers - 1) }))}
            disabled={form.travelers <= 1}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] bg-bg-secondary border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg font-medium"
          >-</button>
          <span className="w-10 text-center text-lg font-heading font-bold text-text-primary">{form.travelers}</span>
          <button type="button"
            onClick={() => setForm(f => ({ ...f, travelers: Math.min(20, f.travelers + 1) }))}
            disabled={form.travelers >= 20}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] bg-bg-secondary border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg font-medium"
          >+</button>
          <span className="text-sm text-text-muted">{form.travelers === 1 ? 'traveler' : 'travelers'}</span>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Start Date</label>
          <input type="date" value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">End Date</label>
          <input type="date" value={form.endDate} min={form.startDate || undefined}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors" />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Step 2: Destinations ─────────────────── */

/**
 * CityCombobox — custom combobox that filters CITY_DB as the user types.
 * Selecting a suggestion auto-fills city, country, and flag.
 * Free-text entry is also allowed for unlisted cities.
 */
function CityCombobox({ value, country, flag, onChange, index }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Sync external value changes (e.g., clearing the form)
  useEffect(() => { setQuery(value) }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 1) return []
    const q = query.toLowerCase()
    return CITY_DB.filter(c =>
      c.city.toLowerCase().startsWith(q) ||
      c.city.toLowerCase().includes(q) ||
      c.country.toLowerCase().startsWith(q)
    ).slice(0, 8)
  }, [query])

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    // Pass free-text city update (no country/flag change for unmatched input)
    onChange({ city: val, country, flag })
  }

  const handleSelect = (entry) => {
    const derivedFlag = flagFromCity(entry)
    setQuery(entry.city)
    setOpen(false)
    onChange({ city: entry.city, country: entry.country, flag: derivedFlag })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      handleSelect(suggestions[0])
    }
  }

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => query.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="City"
        autoComplete="off"
        className="w-full px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)]
                   text-text-primary placeholder:text-text-muted text-sm
                   focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 z-50
                        bg-bg-primary border border-border rounded-[var(--radius-md)]
                        overflow-hidden shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((entry, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(entry) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left
                           hover:bg-bg-hover transition-colors"
              >
                <span className="text-base w-6 text-center flex-shrink-0">{flagFromCity(entry)}</span>
                <span className="text-text-primary font-medium">{entry.city}</span>
                <span className="text-text-muted text-xs ml-auto flex-shrink-0">{entry.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StepDestinations({ form, setForm }) {
  const handleAdd = () => {
    setForm(f => ({ ...f, destinations: [...f.destinations, { city: '', country: '', flag: '' }] }))
  }

  const handleDestChange = (index, updates) => {
    setForm(f => {
      const updated = [...f.destinations]
      updated[index] = { ...updated[index], ...updates }
      return { ...f, destinations: updated }
    })
  }

  const handleCountryChange = (index, country) => {
    const flag = COUNTRY_FLAGS_MAP[country.trim()] || form.destinations[index].flag || '🌍'
    handleDestChange(index, { country, flag })
  }

  const handleRemove = (index) => {
    if (form.destinations.length <= 1) return
    setForm(f => ({ ...f, destinations: f.destinations.filter((_, i) => i !== index) }))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Where are you going?</h2>
        <p className="text-sm text-text-muted">Add your destinations in order of visit.</p>
      </div>

      <div className="space-y-3">
        {form.destinations.map((dest, index) => (
          <div key={index} className="flex items-start gap-2 p-3 bg-bg-secondary border border-border rounded-[var(--radius-md)]">
            {/* Step number */}
            <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-semibold shrink-0 mt-2">
              {index + 1}
            </div>

            {/* Flag preview */}
            <span className="text-xl flex-shrink-0 mt-1.5 w-7 text-center">
              {dest.flag || <span className="text-text-muted text-sm">📍</span>}
            </span>

            {/* City combobox */}
            <CityCombobox
              value={dest.city}
              country={dest.country}
              flag={dest.flag}
              onChange={updates => handleDestChange(index, updates)}
              index={index}
            />

            {/* Country text input */}
            <input
              type="text"
              value={dest.country}
              onChange={e => handleCountryChange(index, e.target.value)}
              placeholder="Country"
              className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)]
                         text-text-primary placeholder:text-text-muted text-sm
                         focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
            />

            {/* Remove */}
            <button type="button" onClick={() => handleRemove(index)}
              disabled={form.destinations.length <= 1}
              className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-0 disabled:pointer-events-none transition-all shrink-0 mt-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border-strong rounded-[var(--radius-md)] text-sm text-text-muted font-medium hover:text-accent hover:border-accent/40 hover:bg-accent-muted/20 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Destination
      </button>
    </div>
  )
}

/* ─────────────────── Step 3: Budget ─────────────────── */
function StepBudget({ form, setForm }) {
  const handleCategoryUpdate = (index, field, value) => {
    setForm(f => {
      const updated = [...f.budgetCategories]
      updated[index] = { ...updated[index], [field]: Number(value) || 0 }
      return { ...f, budgetCategories: updated }
    })
  }

  const totalMin = form.budgetCategories.reduce((s, c) => s + (c.min || 0), 0)
  const totalMax = form.budgetCategories.reduce((s, c) => s + (c.max || 0), 0)
  const currencyObj = CURRENCIES.find(c => c.code === form.currency)
  const symbol = currencyObj ? currencyObj.symbol : form.currency

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Set your budget</h2>
        <p className="text-sm text-text-muted">Optional. You can always add this later.</p>
      </div>

      {/* Currency */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Currency</label>
        <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
          className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors appearance-none cursor-pointer"
        >
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
        </select>
      </div>

      {/* Budget Categories — responsive: stacked on mobile */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Budget Categories</label>
        <div className="space-y-2">
          {form.budgetCategories.map((cat, i) => (
            <div key={i} className="p-2.5 bg-bg-secondary border border-border rounded-[var(--radius-sm)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base w-6 text-center">{cat.emoji}</span>
                <span className="text-sm text-text-secondary font-medium">{cat.name}</span>
              </div>
              {/* Min/Max inputs — stack on mobile, inline on sm+ */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{symbol}</span>
                  <input type="number" min="0" value={cat.min || ''}
                    onChange={e => handleCategoryUpdate(i, 'min', e.target.value)}
                    placeholder="Min"
                    className="w-full pl-7 pr-2 py-1.5 bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary text-sm text-right focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{symbol}</span>
                  <input type="number" min="0" value={cat.max || ''}
                    onChange={e => handleCategoryUpdate(i, 'max', e.target.value)}
                    placeholder="Max"
                    className="w-full pl-7 pr-2 py-1.5 bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary text-sm text-right focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
                  />
                </div>
                {/* Range slider for quick adjustment (optional visual) */}
                {(cat.max > 0) && (
                  <div className="col-span-2 sm:flex-1">
                    <input type="range" min="0" max={Math.max(cat.max * 2, 100000)} step="1000"
                      value={cat.max}
                      onChange={e => handleCategoryUpdate(i, 'max', e.target.value)}
                      className="w-full accent-[var(--color-accent)] h-1.5 rounded-full cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(totalMin > 0 || totalMax > 0) && (
        <div className="flex justify-between items-center px-3 py-2.5 bg-accent-muted/30 rounded-[var(--radius-md)] border border-accent/10">
          <span className="text-sm font-medium text-text-secondary">Estimated Total</span>
          <span className="text-sm font-heading font-semibold text-accent">
            {symbol}{totalMin.toLocaleString()} – {symbol}{totalMax.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}

/* ─────────────────── Step 4: Review ─────────────────── */
function StepReview({ form }) {
  const currencyObj = CURRENCIES.find(c => c.code === form.currency)
  const symbol = currencyObj ? currencyObj.symbol : form.currency
  const totalMin = form.budgetCategories.reduce((s, c) => s + (c.min || 0), 0)
  const totalMax = form.budgetCategories.reduce((s, c) => s + (c.max || 0), 0)
  const validDests = form.destinations.filter(d => d.city.trim())

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Review your trip</h2>
        <p className="text-sm text-text-muted">Everything look good? You can edit details later.</p>
      </div>
      <div className="bg-bg-secondary border border-border rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{form.emoji}</span>
            <div>
              <h3 className="font-heading text-lg font-bold text-text-primary">{form.name || 'Untitled Trip'}</h3>
              <p className="text-sm text-text-muted">{form.travelers} {form.travelers === 1 ? 'traveler' : 'travelers'}</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          {(form.startDate || form.endDate) && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">Dates</p>
              <p className="text-sm text-text-primary">
                {form.startDate ? formatDate(form.startDate) : 'TBD'} &mdash; {form.endDate ? formatDate(form.endDate) : 'TBD'}
              </p>
            </div>
          )}
          {validDests.length > 0 && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1.5">Destinations</p>
              <div className="flex flex-wrap gap-1.5">
                {validDests.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-bg-hover rounded-[var(--radius-pill)] text-text-secondary">
                    {d.flag || '📍'} {d.city}{d.country ? `, ${d.country}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(totalMin > 0 || totalMax > 0) && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">Budget</p>
              <p className="text-sm text-text-primary">{symbol}{totalMin.toLocaleString()} – {symbol}{totalMax.toLocaleString()} {form.currency}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Main Modal Component ─────────────────── */
export default function NewTripModal({ isOpen, onClose }) {
  const { dispatch, showToast } = useTripContext()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => getInitialForm())

  function getInitialForm() {
    return {
      name: '',
      emoji: '✈️',
      travelers: 1,
      startDate: '',
      endDate: '',
      destinations: [{ city: '', country: '', flag: '' }],
      currency: 'PHP',
      budgetCategories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, min: 0, max: 0 })),
    }
  }

  const handleClose = () => { setStep(1); setForm(getInitialForm()); onClose() }

  const canProceed = useMemo(() => {
    if (step === 1) return form.name.trim().length > 0
    if (step === 2) return form.destinations.some(d => d.city.trim().length > 0)
    return true
  }, [step, form])

  const handleCreate = () => {
    const destinations = form.destinations
      .filter(d => d.city.trim())
      .map(d => ({
        city: d.city.trim(),
        country: d.country.trim(),
        flag: d.flag || COUNTRY_FLAGS_MAP[d.country.trim()] || '🌍',
      }))

    // Mirror destinations into CitiesTab city cards (deduplicated by city name)
    const seen = new Map()
    destinations.forEach(d => {
      const key = d.city.toLowerCase()
      if (!seen.has(key)) {
        seen.set(key, {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + seen.size,
          city: d.city,
          country: d.country,
          flag: d.flag || '🌍',
          highlights: '',
          mustDo: '',
          weather: '',
          currencyTip: '',
          notes: '',
        })
      }
    })
    const cities = Array.from(seen.values())

    const budgetItems = form.budgetCategories
      .filter(c => c.min > 0 || c.max > 0)
      .map(c => ({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: c.name, emoji: c.emoji, min: c.min, max: c.max, actual: 0,
      }))

    const newTrip = createEmptyTrip({
      name: form.name.trim() || 'New Trip',
      emoji: form.emoji,
      travelers: form.travelers,
      startDate: form.startDate,
      endDate: form.endDate,
      destinations,
      cities,
      currency: form.currency,
      budget: budgetItems,
    })

    dispatch({ type: ACTIONS.ADD_TRIP, payload: newTrip })
    showToast(`"${newTrip.name}" created! Let's plan this trip. 🗺️`)
    handleClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="max-w-lg">
      <div className="px-6 pt-6 pb-2">
        <button type="button" onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors z-10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <StepIndicator currentStep={step} />

        <div className="min-h-[320px]">
          {step === 1 && <StepBasics form={form} setForm={setForm} />}
          {step === 2 && <StepDestinations form={form} setForm={setForm} />}
          {step === 3 && <StepBudget form={form} setForm={setForm} />}
          {step === 4 && <StepReview form={form} />}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-border mt-2">
        <div>
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-[var(--radius-md)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step === 3 && (
            <button type="button"
              onClick={() => { setForm(f => ({ ...f, budgetCategories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, min: 0, max: 0 })) })); setStep(4) }}
              className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-secondary hover:bg-bg-hover rounded-[var(--radius-md)] transition-colors"
            >Skip</button>
          )}
          {step < TOTAL_STEPS ? (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canProceed}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <button type="button" onClick={handleCreate}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] transition-all duration-200 active:scale-[0.98]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Trip
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
