// src/components/shared/LocationAutocomplete.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Search, MapPin, X, Loader2 } from 'lucide-react'
import { auth } from '../../firebase/config'

const mapboxPrefix = "pk.eyJ"
const mapboxToken = import.meta.env.VITE_MAPBOX_PART2 ? `${mapboxPrefix}${import.meta.env.VITE_MAPBOX_PART2}` : null
const VERCEL_API = 'https://wanderplan-rust.vercel.app'

function isLocationDebugEnabled() {
    if (typeof window === 'undefined') return false
    try {
        const params = new URLSearchParams(window.location.search)
        return params.get('debugLocation') === '1'
            || window.localStorage.getItem('wanderplan:debug-location') === '1'
            || window.__WANDERPLAN_DEBUG_LOCATION__ === true
    } catch {
        return false
    }
}

function debugLocation(...args) {
    if (!isLocationDebugEnabled()) return
    console.log('[LocationAutocomplete]', ...args)
}

function debugLocationError(...args) {
    if (!isLocationDebugEnabled()) return
    console.error('[LocationAutocomplete]', ...args)
}

/**
 * LocationAutocomplete
 * Simple search interface for Mapbox locations.
 */
export default function LocationAutocomplete({ onSelect, proximity = '', initialValue = '', cityHint = '', enrichOnSelect = true }) {
    const initialQuery = typeof initialValue === 'string' ? initialValue : (initialValue?.placeName || '')
    const [query, setQuery] = useState(initialQuery)
    const [suggestions, setSuggestions] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSelecting, setIsSelecting] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        const nextQuery = typeof initialValue === 'string' ? initialValue : (initialValue?.placeName || '')
        setQuery(nextQuery)
    }, [initialValue])

    useEffect(() => {
        if (!query || query.length < 2 || !mapboxToken) {
            setSuggestions([])
            if (query && query.length >= 2 && !mapboxToken) {
                debugLocation('Mapbox token missing, skipping suggestions', { queryLength: query.length })
            }
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
                    types: 'place,locality,neighborhood,address,poi',
                    proximity: proximity || 'ip'
                })
                const requestUrl = `${endpoint}?${params.toString()}`
                debugLocation('Fetching suggestions', {
                    query,
                    proximity: proximity || 'ip',
                    cityHint,
                    requestUrl: requestUrl.replace(mapboxToken || '', '[redacted-token]'),
                })

                const res = await fetch(requestUrl)
                const text = await res.text()
                if (!res.ok) {
                    debugLocationError('Suggestions request failed', {
                        status: res.status,
                        statusText: res.statusText,
                        response: text.slice(0, 1000),
                    })
                    return
                }

                const data = text ? JSON.parse(text) : {}
                const nextSuggestions = data.features || []
                debugLocation('Suggestions response', {
                    count: nextSuggestions.length,
                    first: nextSuggestions[0]?.properties?.name || nextSuggestions[0]?.place_name || null,
                })
                setSuggestions(nextSuggestions)
                setShowSuggestions(true)
            } catch (e) {
                debugLocationError('Suggestions fetch failed', e)
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [query, proximity])

    const handleSelect = async (feature) => {
        const [lng, lat] = feature.geometry.coordinates
        const placeName = feature.properties.name || feature.properties.full_address || ''
        debugLocation('Selected feature', {
            placeName,
            featureId: feature.id,
            mapboxId: feature.properties.mapbox_id || null,
            coordinates: { lat, lng },
            cityHint,
            enrichOnSelect,
        })
        const baseLocation = {
            placeName,
            coordinates: { lat, lng },
            placeId: feature.properties.mapbox_id || feature.id || null,
            photoUrl: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+cc402e(${lng},${lat})/${lng},${lat},14/120x120@2x?access_token=${mapboxToken}`,
            mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
            verified: true
        }

        let nextLocation = baseLocation

        if (enrichOnSelect && auth.currentUser) {
            try {
                setIsSelecting(true)
                const token = await auth.currentUser.getIdToken()
                const requestUrl = `${VERCEL_API}/api/resolve-location`
                debugLocation('Enrichment request', {
                    requestUrl,
                    query: placeName || query,
                    cityHint,
                    hasAuthToken: Boolean(token),
                })

                const res = await fetch(requestUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': `Bearer ${token}` }),
                    },
                    body: JSON.stringify({
                        query: placeName || query,
                        cityHint,
                    }),
                })

                if (res.ok) {
                    const enriched = await res.json()
                    debugLocation('Enrichment response', enriched)
                    nextLocation = { ...baseLocation, ...enriched }
                } else {
                    const body = await res.text()
                    debugLocationError('Enrichment request failed', {
                        status: res.status,
                        statusText: res.statusText,
                        body: body.slice(0, 1000),
                    })
                }
            } catch (error) {
                debugLocationError('Location enrichment failed:', error)
            } finally {
                setIsSelecting(false)
            }
        }

        onSelect(nextLocation)
        setQuery(nextLocation.placeName || placeName)
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
                {isLoading || isSelecting ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-accent animate-spin" size={16} />
                ) : query && (
                    <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                        <X size={16} />
                    </button>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-border rounded-[var(--radius-md)] z-50 overflow-hidden">
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
