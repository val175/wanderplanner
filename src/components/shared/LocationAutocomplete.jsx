// src/components/shared/LocationAutocomplete.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Search, MapPin, X, Loader2 } from 'lucide-react'

const mapboxPrefix = "pk.eyJ"
const mapboxToken = import.meta.env.VITE_MAPBOX_PART2 ? `${mapboxPrefix}${import.meta.env.VITE_MAPBOX_PART2}` : null

/**
 * LocationAutocomplete
 * Simple search interface for Mapbox locations.
 */
export default function LocationAutocomplete({ onSelect, proximity = '', initialValue = '' }) {
    const [query, setQuery] = useState(initialValue)
    const [suggestions, setSuggestions] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        if (!query || query.length < 2 || !mapboxToken) {
            setSuggestions([])
            return
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsLoading(true)
            try {
                // Use Searchbox API (forward) for better POI/restaurant results
                const endpoint = `https://api.mapbox.com/search/searchbox/v1/forward`
                const params = new URLSearchParams({
                    q: query,
                    access_token: mapboxToken,
                    limit: '10',
                    types: 'poi,address',
                    proximity: proximity || 'ip'
                })
                
                const res = await fetch(`${endpoint}?${params.toString()}`)
                if (res.ok) {
                    const data = await res.json()
                    setSuggestions(data.features || [])
                    setShowSuggestions(true)
                }
            } catch (e) {
                console.error('Suggestions fetch failed', e)
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [query, proximity])

    const handleSelect = (feature) => {
        const [lng, lat] = feature.geometry.coordinates
        const placeName = feature.properties.name || feature.properties.full_address

        onSelect({
            placeName,
            coordinates: { lat, lng },
            placeId: feature.id,
            photoUrl: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+cc402e(${lng},${lat})/${lng},${lat},14/120x120@2x?access_token=${mapboxToken}`,
            mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
            verified: true
        })
        setQuery(placeName)
        setShowSuggestions(false)
    }

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setShowSuggestions(suggestions.length > 0)}
                    placeholder="Search for a place..."
                    className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary pl-10 pr-10 py-2.5 focus:outline-none focus:border-accent transition-all"
                    autoFocus
                />
                {isLoading ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-accent animate-spin" size={16} />
                ) : query && (
                    <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                        <X size={16} />
                    </button>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-[var(--radius-md)] z-50 overflow-hidden shadow-none">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion.id}
                            onClick={() => handleSelect(suggestion)}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-hover text-left transition-colors border-b border-border/50 last:border-0"
                        >
                            <MapPin size={16} className="mt-0.5 text-accent shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-text-primary truncate">
                                    {suggestion.properties.name}
                                </p>
                                <p className="text-xs text-text-muted truncate">
                                    {suggestion.properties.full_address}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
