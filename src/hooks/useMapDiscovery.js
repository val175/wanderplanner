import { useState, useEffect, useMemo } from 'react';
import { geocodeCity, haversineDistance } from '../utils/helpers';

/**
 * useMapDiscovery
 * Hook to handle spatial logic for the interactive WanderMap.
 * Filters voting room ideas based on proximity to trip destinations.
 */
export function useMapDiscovery(trip) {
    const [destCoords, setDestCoords] = useState([]); // Array of { cityId, coords: [lng, lat] }
    const [ideaCoords, setIdeaCoords] = useState([]); // Array of { ideaId, coords: [lng, lat] }
    const [isLoading, setIsLoading] = useState(false);

    const destinations = trip?.destinations || [];
    const ideas = trip?.ideas || [];

    // 1. Geocode all destinations
    useEffect(() => {
        let active = true;
        async function loadDestinations() {
            setIsLoading(true);
            const validDests = destinations.filter(d => d && d.city);
            const promises = validDests.map(async (d) => {
                const coords = await geocodeCity(d.city, d.country);
                return { cityId: d.id, coords, city: d.city };
            });

            const results = await Promise.all(promises);
            if (!active) return;
            setDestCoords(results.filter(r => r.coords));
            setIsLoading(false);
        }
        loadDestinations();
        return () => { active = false; };
    }, [destinations]);

    // 2. Geocode all ideas from voting room
    // Optimization: Only geocode if they have a 'location' or 'title' that looks like a place
    useEffect(() => {
        let active = true;
        async function loadIdeas() {
            const validIdeas = ideas.filter(i => i && i.title);
            const promises = validIdeas.map(async (idea) => {
                // Use title as search term for ideas (often a specific place name)
                // Pass the first destination's country as a hint to narrow down search
                const countryHint = destinations[0]?.country || null;
                const coords = await geocodeCity(idea.title, countryHint);
                return { ideaId: idea.id, coords, idea };
            });

            const results = await Promise.all(promises);
            if (!active) return;
            setIdeaCoords(results.filter(r => r.coords));
        }
        if (ideas.length > 0) loadIdeas();
        else setIdeaCoords([]);
        return () => { active = false; };
    }, [ideas, destinations]);

    // 3. Proximity Filter
    // Find ideas within X km of ANY destination stop
    const discoveredIdeas = useMemo(() => {
        const PROXIMITY_THRESHOLD_KM = 50; // Show ideas within 50km of the route stops

        return ideaCoords.filter(ic => {
            return destCoords.some(dc => {
                const dist = haversineDistance(
                    dc.coords[1], dc.coords[0],
                    ic.coords[1], ic.coords[0]
                );
                return dist <= PROXIMITY_THRESHOLD_KM;
            });
        });
    }, [destCoords, ideaCoords]);

    return {
        destCoords,
        ideaCoords,
        discoveredIdeas,
        isLoading
    };
}
