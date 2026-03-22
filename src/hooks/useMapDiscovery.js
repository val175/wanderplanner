import { useState, useEffect, useMemo, useRef } from 'react';
import { geocodeCity, haversineDistance, addMinutesToTime } from '../utils/helpers';
import { CITY_DB } from '../components/shared/CityCombobox'
import { ACTIONS } from '../state/tripReducer'

function normalizeLabel(label) {
    return (label || '').toString().trim().toLowerCase()
}

function isMapDebugEnabled() {
    if (typeof window === 'undefined') return false
    try {
        const params = new URLSearchParams(window.location.search)
        return params.get('debugMap') === '1'
            || window.localStorage.getItem('wanderplan:debug-map') === '1'
            || window.__WANDERPLAN_DEBUG_MAP__ === true
    } catch {
        return false
    }
}

function debugMap(...args) {
    if (!isMapDebugEnabled()) return
    console.log('[useMapDiscovery]', ...args)
}

function debugMapWarn(...args) {
    if (!isMapDebugEnabled()) return
    console.warn('[useMapDiscovery]', ...args)
}

const MAPBOX_PREFIX = 'pk.eyJ'
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PART2 ? `${MAPBOX_PREFIX}${import.meta.env.VITE_MAPBOX_PART2}` : null

const COUNTRY_CODE_LOOKUP = new Map(
    CITY_DB.map(entry => [entry.country.trim().toLowerCase(), entry.iso])
)

function normalizeCountryCode(country) {
    if (!country) return null
    const trimmed = country.toString().trim()
    if (!trimmed) return null
    if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase()
    return COUNTRY_CODE_LOOKUP.get(trimmed.toLowerCase()) || null
}

function getUniqueTripCountryNames(destinations) {
    return [...new Set((destinations || [])
        .map(dest => dest?.country)
        .filter(Boolean)
        .map(country => country.toString().trim()))]
}

function getUniqueTripCountryCodes(destinations) {
    return [...new Set((destinations || [])
        .map(dest => normalizeCountryCode(dest?.iso || dest?.countryCode || dest?.country))
        .filter(Boolean))]
}

function inferTripContext(query, day, destinations) {
    const normalizedQuery = normalizeLabel(query)
    const candidateCities = (destinations || []).filter(Boolean)

    const queryMatch = candidateCities.find(dest => {
        const city = normalizeLabel(dest.city)
        return city && normalizedQuery.includes(city)
    })

    if (queryMatch?.city && queryMatch?.country) {
        return {
            geocodeHint: queryMatch.country,
            countryCodes: [normalizeCountryCode(queryMatch.iso || queryMatch.countryCode || queryMatch.country)].filter(Boolean),
        }
    }

    const dayLocation = normalizeLabel(day?.location)
    const dayMatch = candidateCities.find(dest => {
        const city = normalizeLabel(dest.city)
        return city && dayLocation.includes(city)
    })

    if (dayMatch?.city && dayMatch?.country) {
        return {
            geocodeHint: dayMatch.country,
            countryCodes: [normalizeCountryCode(dayMatch.iso || dayMatch.countryCode || dayMatch.country)].filter(Boolean),
        }
    }

    const countryNames = getUniqueTripCountryNames(candidateCities)
    const countryCodes = getUniqueTripCountryCodes(candidateCities)
    if (countryNames.length === 1) {
        return {
            geocodeHint: countryNames[0],
            countryCodes,
        }
    }

    return {
        geocodeHint: null,
        countryCodes,
    }
}

function getActivityQuery(activity) {
    if (!activity) return ''

    if (typeof activity.location === 'string') {
        return activity.location.trim()
    }

    if (activity.location && typeof activity.location === 'object') {
        return (
            activity.location.placeName
            || activity.location.address
            || activity.location.searchQuery
            || activity.location.summary
            || ''
        ).trim()
    }

    return (activity.name || '').trim()
}

async function geocodePlaceWithMapbox(query, countryCodes = []) {
    if (!MAPBOX_TOKEN || !query) return null

    const endpoint = 'https://api.mapbox.com/search/searchbox/v1/forward'
    const params = new URLSearchParams({
        q: query,
        access_token: MAPBOX_TOKEN,
        limit: '5',
        types: 'poi,address,place,locality,neighborhood',
        proximity: 'ip',
    })

    const codes = [...new Set((Array.isArray(countryCodes) ? countryCodes : [countryCodes])
        .map(normalizeCountryCode)
        .filter(Boolean))]

    if (codes.length > 0) {
        params.set('country', codes.join(','))
    }

    try {
        const res = await fetch(`${endpoint}?${params.toString()}`)
        if (!res.ok) return null
        const data = await res.json()
        const feature = data.features?.[0]
        const coords = feature?.geometry?.coordinates
        if (!coords || coords.length < 2) return null
        return [coords[0], coords[1]]
    } catch (error) {
        debugMapWarn('Mapbox place geocode failed', { query, countryCodes: codes, error: error.message })
        return null
    }
}

/**
 * useMapDiscovery
 * Hook to handle spatial logic for the interactive WanderMap.
 * Filters voting room ideas based on proximity to trip destinations.
 * Enriches itinerary coords with day context, category, confidence, and time windows.
 * Persists freshly-geocoded coordinates back to TripContext via optional dispatch.
 */
export function useMapDiscovery(trip, dispatch) {
    const [destCoords, setDestCoords] = useState([]); // Array of { cityId, coords: [lng, lat], city }
    const [ideaCoords, setIdeaCoords] = useState([]); // Array of { ideaId, coords: [lng, lat], idea }
    const [itineraryCoords, setItineraryCoords] = useState([]); // Array of enriched spatial insight objects
    const [isLoading, setIsLoading] = useState(false);

    // Track which activityIds have had coords persisted this session to prevent double-dispatch
    const persistedIdsRef = useRef(new Set());

    // Memoize derived arrays so `|| []` doesn't create a new reference on every render,
    // which would cause the useEffects below to fire in an infinite loop.
    const destinations = useMemo(() => trip?.destinations || [], [trip]);
    const ideas = useMemo(() => trip?.ideas || [], [trip]);
    const itinerary = useMemo(() => trip?.itinerary || [], [trip]);

    // 1. Geocode all destinations (Macro markers)
    useEffect(() => {
        let active = true;
        async function loadDestinations() {
            setIsLoading(true);
            const validDests = destinations.filter(d => d && d.city);
            const promises = validDests.map(async (d) => {
                // Use persisted coordinates if available
                if (d.lat !== undefined && d.lng !== undefined) {
                    return { cityId: d.id || d.city, coords: [d.lng, d.lat], city: d.city };
                }
                const coords = await geocodeCity(d.city, d.country);
                return { cityId: d.id || d.city, coords, city: d.city };
            });

            const results = await Promise.all(promises);
            if (!active) return;
            setDestCoords(results.filter(r => r.coords));
            setIsLoading(false);
        }
        loadDestinations();
        return () => { active = false; };
    }, [destinations]);

    // 2. Geocode all ideas from voting room (Discovery pins)
    useEffect(() => {
        let active = true;
        async function loadIdeas() {
            const validIdeas = ideas.filter(i => i && i.title);
            const promises = validIdeas.map(async (idea) => {
                const countryHint = getUniqueTripCountryNames(destinations)[0] || null;
                const coords = await geocodeCity(idea.title, countryHint);
                return { ideaId: idea.id, coords, idea };
            });

            const results = await Promise.all(promises);
            if (!active) return;
            setIdeaCoords(results.filter(r => r.coords));
        }
        if (ideas.length > 0) loadIdeas();
        else if (active) setIdeaCoords([]);
        return () => { active = false; };
    }, [ideas, destinations]);

    // 3. Geocode Itinerary Activities (Micro markers)
    useEffect(() => {
        let active = true;
        async function loadActivities() {
            const allActivities = itinerary.flatMap(day =>
                (day.activities || [])
                    .filter(a => a && (a.location || a.name))
                    .map(activity => ({ activity, day }))
            );

            if (allActivities.length === 0) {
                if (active) setItineraryCoords([]);
                return;
            }

            debugMap('Loading itinerary activities', {
                activityCount: allActivities.length,
                dayCount: itinerary.length,
            })

            const promises = allActivities.map(async ({ activity, day }) => {
                const timeStart = activity.time || '';
                const timeEnd = activity.endTime || (timeStart && activity.duration
                    ? addMinutesToTime(timeStart, activity.duration)
                    : '');
                const enrichBase = {
                    activityId: activity.id,
                    activity,
                    dayId: day.id,
                    dayNumber: day.dayNumber,
                    dayDate: day.date || '',
                    category: activity.category || 'other',
                    timeStart,
                    timeEnd,
                };

                // If we already have rich location data with coordinates, use them directly
                if (activity.location?.coordinates?.lat && activity.location?.coordinates?.lng) {
                    const coords = [activity.location.coordinates.lng, activity.location.coordinates.lat];
                    debugMap('Using stored coordinates', {
                        activityId: activity.id,
                        query: getActivityQuery(activity),
                        coords,
                    })
                    return { ...enrichBase, coords, confidence: 'verified' };
                }

                const query = getActivityQuery(activity) || activity.name;
                const tripContext = inferTripContext(query, day, destinations);
                const mapboxCoords = await geocodePlaceWithMapbox(query, tripContext.countryCodes);
                const coords = mapboxCoords || await geocodeCity(query, tripContext.geocodeHint);
                const confidence = mapboxCoords ? 'geocoded' : 'name-only';

                if (!coords) {
                    debugMapWarn('Failed to geocode activity', {
                        activityId: activity.id,
                        dayId: day.id,
                        dayLocation: day.location,
                        query,
                        geocodeHint: tripContext.geocodeHint,
                        countryCodes: tripContext.countryCodes,
                    })
                } else {
                    debugMap('Geocoded activity', {
                        activityId: activity.id,
                        dayId: day.id,
                        query,
                        geocodeHint: tripContext.geocodeHint,
                        countryCodes: tripContext.countryCodes,
                        source: mapboxCoords ? 'mapbox' : 'open-meteo',
                        coords,
                        confidence,
                    })

                    // Persist freshly-geocoded coords back to state so future map loads are instant
                    if (dispatch && active && !persistedIdsRef.current.has(activity.id)) {
                        persistedIdsRef.current.add(activity.id);
                        dispatch({
                            type: ACTIONS.UPDATE_ACTIVITY,
                            payload: {
                                dayId: day.id,
                                activityId: activity.id,
                                updates: {
                                    location: {
                                        ...(typeof activity.location === 'object' ? activity.location : { placeName: activity.location || activity.name }),
                                        coordinates: { lat: coords[1], lng: coords[0] },
                                    },
                                },
                            },
                        });
                    }
                }
                return { ...enrichBase, coords, confidence };
            });

            const results = await Promise.all(promises);
            if (!active) return;
            setItineraryCoords(results.filter(r => r.coords));
        }
        loadActivities();
        return () => { active = false; };
    }, [itinerary, destinations]);

    // 4. Proximity Filter for Ideas
    const discoveredIdeas = useMemo(() => {
        const PROXIMITY_THRESHOLD_KM = 30; // Slightly tighter for micro-level discovery

        return ideaCoords.filter(ic => {
            // Check proximity to city destinations
            const nearCity = destCoords.some(dc => {
                const dist = haversineDistance(
                    dc.coords[1], dc.coords[0],
                    ic.coords[1], ic.coords[0]
                );
                return dist <= PROXIMITY_THRESHOLD_KM;
            });

            // Check proximity to specific itinerary activities
            const nearActivity = itineraryCoords.some(ac => {
                const dist = haversineDistance(
                    ac.coords[1], ac.coords[0],
                    ic.coords[1], ic.coords[0]
                );
                return dist <= 10; // Very close to an activity
            });

            return nearCity || nearActivity;
        });
    }, [destCoords, ideaCoords, itineraryCoords]);

    return {
        destCoords,
        ideaCoords,
        itineraryCoords,
        discoveredIdeas,
        isLoading
    };
}
