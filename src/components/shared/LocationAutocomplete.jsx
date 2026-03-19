// src/components/shared/LocationAutocomplete.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, MapPin, X, Loader2 } from 'lucide-react'
import { auth } from '../../firebase/config'
import { useTripContext } from '../../context/TripContext'
import { CITY_DB } from './CityCombobox'

const mapboxPrefix = "pk.eyJ"
const mapboxToken = import.meta.env.VITE_MAPBOX_PART2 ? `${mapboxPrefix}${import.meta.env.VITE_MAPBOX_PART2}` : null
const VERCEL_API = 'https://wanderplan-rust.vercel.app'
const MAPBOX_SUGGEST_ENDPOINT = 'https://api.mapbox.com/search/searchbox/v1/suggest'
const MAPBOX_RETRIEVE_ENDPOINT = 'https://api.mapbox.com/search/searchbox/v1/retrieve'
const groundedSuggestionCache = new Map()

function makeSessionToken() {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID()
        }
    } catch {
        // fall through
    }
    return `wanderplan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

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

function devLocationLog(...args) {
    if (import.meta.env.PROD) return
    console.log('[LocationAutocomplete]', ...args)
}

const COUNTRY_CODE_LOOKUP = new Map(
    CITY_DB.map(entry => [entry.country.trim().toLowerCase(), entry.iso])
)

const COUNTRY_NAME_LOOKUP = new Map(
    CITY_DB.map(entry => [entry.iso, entry.country])
)

function getSuggestionLabel(suggestion, fallback = '') {
    return suggestion?.name
        || suggestion?.properties?.name
        || suggestion?.place_name
        || suggestion?.place_formatted
        || suggestion?.full_address
        || suggestion?.properties?.full_address
        || suggestion?.text
        || fallback
}

function getQuerySearchTypes(query) {
    const normalized = (query || '').trim().toLowerCase()
    const localityHints = [
        /(^|[\s,])(city|town|village|prefecture|province|state|country|district|region|municipality|county)([\s,]|$)/i,
        /,\s*[a-z]/i,
    ]

    if (localityHints.some(pattern => pattern.test(normalized))) {
        return ['place,locality,neighborhood,address,poi', 'poi,address']
    }

    return ['poi,address', 'place,locality,neighborhood,address,poi']
}

function normalizeCountryCode(country) {
    if (!country) return null
    const trimmed = country.toString().trim()
    if (!trimmed) return null
    if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase()
    return COUNTRY_CODE_LOOKUP.get(trimmed.toLowerCase()) || null
}

function getTripSearchScopes(activeTrip) {
    const sourceEntries = [
        ...(activeTrip?.cities || []),
        ...(activeTrip?.destinations || []),
    ]

    const scopes = new Map()

    for (const entry of sourceEntries) {
        const countryCode = normalizeCountryCode(entry?.iso || entry?.countryCode || entry?.country)
        if (!countryCode) continue

        const countryName = COUNTRY_NAME_LOOKUP.get(countryCode) || entry?.country || countryCode
        const cityName = (entry?.city || '').trim()

        if (!scopes.has(countryCode)) {
            scopes.set(countryCode, {
                countryCode,
                countryName,
                cityNames: new Set(),
            })
        }

        const scope = scopes.get(countryCode)
        if (cityName) scope.cityNames.add(cityName)
    }

    return [...scopes.values()].map(scope => ({
        countryCode: scope.countryCode,
        countryName: scope.countryName,
        cityNames: [...scope.cityNames],
    }))
}

function scoreSuggestion(query, suggestion) {
    if (suggestion?.__groundedLocation) return 1000
    const label = `${suggestion?.name || ''} ${suggestion?.properties?.name || ''} ${suggestion?.place_name || ''} ${suggestion?.place_formatted || ''} ${suggestion?.full_address || ''} ${suggestion?.properties?.full_address || ''}`.toLowerCase()
    const q = (query || '').trim().toLowerCase()
    if (!q) return 0

    let score = 0
    if (label.includes(q)) score += 100

    const tokens = q.split(/[\s,]+/).filter(Boolean)
    for (const token of tokens) {
        if (label.includes(token)) score += 8
    }

    if ((suggestion?.properties?.name || '').toLowerCase().includes(q)) score += 50
    if ((suggestion?.properties?.full_address || '').toLowerCase().includes(q)) score += 5
    return score
}

function isValidCoordinates(coords) {
    return Boolean(
        coords
        && Number.isFinite(coords.lat)
        && Number.isFinite(coords.lng)
        && !(coords.lat === 0 && coords.lng === 0)
    )
}

function dedupeSuggestions(list) {
    const seen = new Set()
    const result = []

    for (const suggestion of list || []) {
        const key = suggestion?.mapbox_id
            || suggestion?.properties?.mapbox_id
            || suggestion?.id
            || `${getSuggestionLabel(suggestion, '').toLowerCase()}|${(suggestion?.properties?.full_address || suggestion?.place_formatted || '').toLowerCase()}`

        if (seen.has(key)) continue
        seen.add(key)
        result.push(suggestion)
    }

    return result
}

function normalizeSearchKey(value) {
    return (value || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
}

function tokenizeQuery(query) {
    return normalizeSearchKey(query)
        .split(/[\s,]+/)
        .filter(Boolean)
}

function scoreSuggestionMatch(query, suggestion) {
    const label = getSuggestionLabel(suggestion, '').toLowerCase()
    const tokens = tokenizeQuery(query)
    if (!label || tokens.length === 0) return 0
    return tokens.reduce((score, token) => score + (label.includes(token) ? 1 : 0), 0)
}

function hasStrongExactMatch(query, suggestions) {
    const tokens = tokenizeQuery(query)
    if (tokens.length === 0) return false
    return (suggestions || []).some(suggestion => scoreSuggestionMatch(query, suggestion) >= Math.max(2, Math.ceil(tokens.length * 0.8)))
}

function hasStrongLocationMatch(query, locationData) {
    const tokens = tokenizeQuery(query)
    if (tokens.length === 0) return false
    const label = `${locationData?.placeName || ''} ${locationData?.address || ''} ${locationData?.summary || ''}`.toLowerCase()
    if (!label.trim()) return false
    const matches = tokens.filter(token => label.includes(token)).length
    return matches >= Math.min(2, tokens.length)
}

function buildGroundedSuggestion(locationData, fallbackQuery, cityHint) {
    const coords = locationData?.coordinates
    const lat = coords?.lat
    const lng = coords?.lng
    const hasCoords = isValidCoordinates(coords)
    const placeName = locationData?.placeName || fallbackQuery
    const fullAddress = locationData?.address || locationData?.summary || placeName

    return {
        id: `grounded:${normalizeSearchKey(fallbackQuery)}:${normalizeSearchKey(cityHint)}`,
        mapbox_id: locationData?.placeId || null,
        name: placeName,
        place_name: fullAddress,
        place_formatted: fullAddress,
        full_address: fullAddress,
        geometry: hasCoords
            ? { type: 'Point', coordinates: [lng, lat] }
            : null,
        properties: {
            name: placeName,
            full_address: fullAddress,
            mapbox_id: locationData?.placeId || null,
            source: 'grounding',
        },
        __groundedLocation: locationData,
    }
}

async function fetchGroundedSuggestion(query, cityHint, countryCodes = []) {
    if (!auth.currentUser || !query) return null

    const cacheKey = `${normalizeSearchKey(query)}||${normalizeSearchKey(cityHint)}||${[...new Set((countryCodes || []).map(code => (code || '').toString().trim().toUpperCase()).filter(Boolean))].sort().join(',')}`
    const cached = groundedSuggestionCache.get(cacheKey)
    if (cached) return cached

    try {
        const token = await auth.currentUser.getIdToken()
        const requestUrl = `${VERCEL_API}/api/resolve-location`
        debugLocation('Grounding fallback request', {
            requestUrl,
            query,
            cityHint,
        })

        const res = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
            },
            body: JSON.stringify({ query, cityHint, countryCodes }),
        })

        if (!res.ok) {
            const body = await res.text()
            debugLocationError('Grounding fallback failed', {
                status: res.status,
                statusText: res.statusText,
                body: body.slice(0, 1000),
            })
            groundedSuggestionCache.set(cacheKey, null)
            return null
        }

        const locationData = await res.json()
        if (!isValidCoordinates(locationData?.coordinates)) {
            debugLocationError('Grounding fallback returned invalid coordinates', locationData)
            groundedSuggestionCache.set(cacheKey, null)
            return null
        }
        if (!hasStrongLocationMatch(query, locationData)) {
            debugLocation('Grounding fallback rejected weak match', {
                query,
                placeName: locationData?.placeName,
                address: locationData?.address,
            })
            groundedSuggestionCache.set(cacheKey, null)
            return null
        }
        const groundedSuggestion = buildGroundedSuggestion(locationData, query, cityHint)
        groundedSuggestionCache.set(cacheKey, groundedSuggestion)
        debugLocation('Grounding fallback response', groundedSuggestion)
        return groundedSuggestion
    } catch (error) {
        debugLocationError('Grounding fallback error', error)
        groundedSuggestionCache.set(cacheKey, null)
        return null
    }
}

/**
 * LocationAutocomplete
 * Simple search interface for Mapbox locations.
 */
export default function LocationAutocomplete({ onSelect, proximity = '', initialValue = '', cityHint = '', enrichOnSelect = true }) {
    const { activeTrip } = useTripContext()
    const initialQuery = typeof initialValue === 'string' ? initialValue : (initialValue?.placeName || '')
    const [query, setQuery] = useState(initialQuery)
    const [suggestions, setSuggestions] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSelecting, setIsSelecting] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const containerRef = useRef(null)
    const [sessionToken, setSessionToken] = useState(() => makeSessionToken())
    const tripSearchScopes = useMemo(() => getTripSearchScopes(activeTrip), [activeTrip])
    const tripCountryCodes = useMemo(
        () => tripSearchScopes.map(scope => scope.countryCode),
        [tripSearchScopes]
    )
    const countryFilter = tripCountryCodes.join(',')

    useEffect(() => {
        const nextQuery = typeof initialValue === 'string' ? initialValue : (initialValue?.placeName || '')
        setQuery(nextQuery)
    }, [initialValue])

    useEffect(() => {
        if (!query) {
            setSessionToken(makeSessionToken())
        }
    }, [query])

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
                const typesToTry = getQuerySearchTypes(query)
                let nextSuggestions = []
                const countryScopes = tripSearchScopes.length > 0
                    ? tripSearchScopes
                    : [{ countryCode: null, countryName: null, cityNames: [] }]

                for (let index = 0; index < typesToTry.length; index += 1) {
                    const types = typesToTry[index]
                    const scopedResults = []

                    for (const scope of countryScopes) {
                        const scopeCountry = scope.countryCode
                        const params = new URLSearchParams({
                            q: query,
                            access_token: mapboxToken,
                            limit: '10',
                            types,
                            proximity: proximity || 'ip',
                            session_token: sessionToken,
                        })

                        if (scopeCountry) {
                            params.set('country', scopeCountry)
                        }

                        const requestUrl = `${MAPBOX_SUGGEST_ENDPOINT}?${params.toString()}`
                        devLocationLog('Country scope', {
                            tripCountryCodes,
                            countryFilter: countryFilter || null,
                            scopeCountry,
                            sessionToken,
                        })
                        debugLocation('Fetching suggestions', {
                            attempt: index + 1,
                            query,
                            proximity: proximity || 'ip',
                            cityHint,
                            tripCountryCodes,
                            countryFilter: countryFilter || null,
                            scopeCountry,
                            sessionToken,
                            types,
                            requestUrl: requestUrl.replace(mapboxToken || '', '[redacted-token]'),
                        })

                        const res = await fetch(requestUrl)
                        const text = await res.text()
                        if (!res.ok) {
                            debugLocationError('Suggestions request failed', {
                                attempt: index + 1,
                                scopeCountry,
                                status: res.status,
                                statusText: res.statusText,
                                response: text.slice(0, 1000),
                            })
                            continue
                        }

                        const data = text ? JSON.parse(text) : {}
                        scopedResults.push(...(data.suggestions || data.features || []))
                    }

                nextSuggestions = dedupeSuggestions(scopedResults)
                    .sort((a, b) => scoreSuggestion(query, b) - scoreSuggestion(query, a))

                    if (query.trim().split(/\s+/).length >= 3) {
                        const groundedSuggestion = await fetchGroundedSuggestion(query, cityHint, tripCountryCodes)
                        if (groundedSuggestion) {
                            nextSuggestions = dedupeSuggestions([groundedSuggestion, ...nextSuggestions])
                                .sort((a, b) => scoreSuggestion(query, b) - scoreSuggestion(query, a))
                        }
                    }

                    debugLocation('Suggestions response', {
                        attempt: index + 1,
                        count: nextSuggestions.length,
                        first: getSuggestionLabel(nextSuggestions[0], null),
                    })

                    if (nextSuggestions.length > 0) break
                }

                setSuggestions(nextSuggestions)
                setShowSuggestions(nextSuggestions.length > 0)
            } catch (e) {
                debugLocationError('Suggestions fetch failed', e)
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [query, proximity, cityHint, countryFilter, sessionToken, tripSearchScopes])

    const handleSelect = async (feature) => {
        if (feature?.__groundedLocation) {
            const locationData = feature.__groundedLocation
            const placeName = locationData?.placeName || getSuggestionLabel(feature, '')
            const baseLocation = {
                placeName,
                coordinates: isValidCoordinates(locationData?.coordinates) ? locationData.coordinates : null,
                placeId: locationData?.placeId || feature?.mapbox_id || feature?.id || null,
                photoUrl: locationData?.photoUrl || '',
                mapUrl: locationData?.mapUrl || (isValidCoordinates(locationData?.coordinates)
                    ? `https://www.google.com/maps/search/?api=1&query=${locationData.coordinates.lat},${locationData.coordinates.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`),
                verified: isValidCoordinates(locationData?.coordinates),
                rating: locationData?.rating ?? null,
                reviewCount: locationData?.reviewCount ?? null,
                openingHours: locationData?.openingHours || '',
                isOpenNow: typeof locationData?.isOpenNow === 'boolean' ? locationData.isOpenNow : null,
                website: locationData?.website || '',
                phone: locationData?.phone || '',
                summary: locationData?.summary || '',
                sourceLinks: locationData?.sourceLinks || [],
                groundedAt: locationData?.groundedAt || '',
                groundedModel: locationData?.groundedModel || '',
            }
            debugLocation('Selected grounded feature', baseLocation)
            onSelect(baseLocation)
            setQuery(baseLocation.placeName || placeName)
            setShowSuggestions(false)
            return
        }

        const mapboxId = feature?.mapbox_id || feature?.properties?.mapbox_id || feature?.id || null
        const requestLabel = getSuggestionLabel(feature, '')
        debugLocation('Selected feature', {
            placeName: requestLabel,
            featureId: feature?.id || null,
            mapboxId,
            cityHint,
            enrichOnSelect,
        })

        let resolvedFeature = feature
        if (mapboxId) {
            try {
                const params = new URLSearchParams({
                    access_token: mapboxToken || '',
                    session_token: sessionToken,
                })
                const requestUrl = `${MAPBOX_RETRIEVE_ENDPOINT}/${encodeURIComponent(mapboxId)}?${params.toString()}`
                debugLocation('Retrieving selected feature', {
                    mapboxId,
                    sessionToken,
                    requestUrl: requestUrl.replace(mapboxToken || '', '[redacted-token]'),
                })
                const res = await fetch(requestUrl)
                if (res.ok) {
                    const data = await res.json()
                    const retrievedFeature = data.features?.[0]
                    if (retrievedFeature) {
                        resolvedFeature = retrievedFeature
                        debugLocation('Retrieved feature', retrievedFeature)
                    }
                } else {
                    const body = await res.text()
                    debugLocationError('Retrieve request failed', {
                        status: res.status,
                        statusText: res.statusText,
                        body: body.slice(0, 1000),
                    })
                }
            } catch (error) {
                debugLocationError('Retrieve request error', error)
            }
        }

        const resolvedCoords = resolvedFeature?.geometry?.coordinates
        const [lng, lat] = Array.isArray(resolvedCoords) ? resolvedCoords : [null, null]
        const placeName = resolvedFeature?.properties?.name
            || resolvedFeature?.name
            || resolvedFeature?.properties?.full_address
            || resolvedFeature?.full_address
            || requestLabel

        const baseLocation = {
            placeName,
            coordinates: isValidCoordinates({ lat, lng }) ? { lat, lng } : null,
            placeId: mapboxId,
            photoUrl: isValidCoordinates({ lat, lng })
                ? `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+cc402e(${lng},${lat})/${lng},${lat},14/120x120@2x?access_token=${mapboxToken}`
                : '',
            mapUrl: isValidCoordinates({ lat, lng })
                ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName || requestLabel)}`,
            verified: isValidCoordinates({ lat, lng })
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
                        countryCodes: tripCountryCodes,
                    }),
                })

                if (res.ok) {
                    const enriched = await res.json()
                    debugLocation('Enrichment response', enriched)
                    nextLocation = {
                        ...baseLocation,
                        ...enriched,
                        coordinates: isValidCoordinates(enriched?.coordinates)
                            ? enriched.coordinates
                            : baseLocation.coordinates,
                    }
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
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.id || suggestion.properties?.mapbox_id || `${getSuggestionLabel(suggestion, 'suggestion')}-${index}`}
                            onClick={() => handleSelect(suggestion)}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-hover text-left transition-colors border-b border-border/50 last:border-0"
                        >
                            <MapPin size={16} className="mt-0.5 text-accent shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-text-primary truncate">
                                    {getSuggestionLabel(suggestion, 'Unknown place')}
                                </p>
                                <p className="text-xs text-text-muted truncate">
                                    {suggestion.properties?.full_address || suggestion.place_formatted || suggestion.properties?.name || ''}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
