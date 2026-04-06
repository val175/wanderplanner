import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { searchAirports } from '../../data/airports'

/**
 * AirportAutocomplete
 * Instant airport search using a bundled registry — no API calls.
 * Returns { iata, placeName, city, country, coords: [lon, lat] } on select.
 */
export default function AirportAutocomplete({ value, onSelect, autoFocus = false }) {
  const initialLabel = value?.placeName || ''
  const [query, setQuery] = useState(initialLabel)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    setQuery(value?.placeName || '')
  }, [value?.placeName])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) { setResults([]); setOpen(false); return }
    const hits = searchAirports(q)
    setResults(hits)
    setOpen(hits.length > 0)
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (airport) => {
    setQuery(`${airport.iata} — ${airport.name}`)
    setOpen(false)
    onSelect({
      iata: airport.iata,
      placeName: airport.name,
      city: airport.city,
      country: airport.country,
      coords: airport.coords,
    })
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={15} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search airport or city…"
          className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary pl-9 pr-8 py-2 focus:outline-none focus:border-accent transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus() }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-[var(--radius-md)] z-50 overflow-hidden shadow-lg">
          {results.map(airport => (
            <button
              key={airport.iata}
              onMouseDown={e => { e.preventDefault(); handleSelect(airport) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-hover text-left transition-colors border-b border-border/40 last:border-0"
            >
              <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0 w-[38px] text-center">
                {airport.iata}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{airport.name}</p>
                <p className="text-[11px] text-text-muted">{airport.city} · {airport.country}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
