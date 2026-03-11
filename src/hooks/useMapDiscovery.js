import { useState, useEffect, useMemo } from 'react';
import { geocodeCity, haversineDistance } from '../utils/helpers';

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

    const destinations = trip?.destinations || [];
    const ideas = trip?.ideas || [];
    const itinerary = trip?.itinerary || [];

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
                const countryHint = destinations[0]?.country || null;
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
                (day.activities || []).filter(a => a && (a.location || a.name))
            );

            if (allActivities.length === 0) {
                if (active) setItineraryCoords([]);
                return;
            }

            const promises = allActivities.map(async (activity) => {
                // If we already have rich location data with coordinates, use them directly
                if (activity.location?.coordinates?.lat && activity.location?.coordinates?.lng) {
                    const coords = [activity.location.coordinates.lng, activity.location.coordinates.lat];
                    return { activityId: activity.id, coords, activity };
                }

                const query = typeof activity.location === 'string' ? activity.location : activity.name;
                const countryHint = destinations[0]?.country || null;
                const coords = await geocodeCity(query, countryHint);
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
