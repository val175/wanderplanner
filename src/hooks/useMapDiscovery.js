import { useState, useEffect, useMemo } from 'react';
import { geocodeCity, haversineDistance } from '../utils/helpers';

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

function getUniqueTripCountries(destinations) {
    return [...new Set((destinations || [])
        .map(dest => dest?.country)
        .filter(Boolean)
        .map(country => country.toString().trim()))]
}

function inferTripHint(query, day, destinations) {
    const normalizedQuery = normalizeLabel(query)
    const candidateCities = (destinations || []).filter(Boolean)

    const queryMatch = candidateCities.find(dest => {
        const city = normalizeLabel(dest.city)
        return city && normalizedQuery.includes(city)
    })

    if (queryMatch?.city && queryMatch?.country) {
        return `${queryMatch.city}, ${queryMatch.country}`
    }

    const dayLocation = normalizeLabel(day?.location)
    const dayMatch = candidateCities.find(dest => {
        const city = normalizeLabel(dest.city)
        return city && dayLocation.includes(city)
    })

    if (dayMatch?.city && dayMatch?.country) {
        return `${dayMatch.city}, ${dayMatch.country}`
    }

    const countries = getUniqueTripCountries(candidateCities)
    if (countries.length === 1) return countries[0]

    return null
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

/**
 * useMapDiscovery
 * Hook to handle spatial logic for the interactive WanderMap.
 * Filters voting room ideas based on proximity to trip destinations.
 */
export function useMapDiscovery(trip) {
    const [destCoords, setDestCoords] = useState([]); // Array of { cityId, coords: [lng, lat], city }
    const [ideaCoords, setIdeaCoords] = useState([]); // Array of { ideaId, coords: [lng, lat], idea }
    const [itineraryCoords, setItineraryCoords] = useState([]); // Array of { activityId, coords: [lng, lat], activity }
    const [isLoading, setIsLoading] = useState(false);

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
                const countryHint = getUniqueTripCountries(destinations)[0] || null;
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
                // If we already have rich location data with coordinates, use them directly
                if (activity.location?.coordinates?.lat && activity.location?.coordinates?.lng) {
                    const coords = [activity.location.coordinates.lng, activity.location.coordinates.lat];
                    debugMap('Using stored coordinates', {
                        activityId: activity.id,
                        query: getActivityQuery(activity),
                        coords,
                    })
                    return { activityId: activity.id, coords, activity };
                }

                const query = getActivityQuery(activity) || activity.name;
                const countryHint = inferTripHint(query, day, destinations);
                const coords = await geocodeCity(query, countryHint);

                if (!coords) {
                    debugMapWarn('Failed to geocode activity', {
                        activityId: activity.id,
                        dayId: day.id,
                        dayLocation: day.location,
                        query,
                        countryHint,
                    })
                } else {
                    debugMap('Geocoded activity', {
                        activityId: activity.id,
                        dayId: day.id,
                        query,
                        countryHint,
                        coords,
                    })
                }
                return { activityId: activity.id, coords, activity };
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
