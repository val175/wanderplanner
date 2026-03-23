import { normalizeTimeString } from './helpers';

export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function timeToMins(t) {
    const normalized = normalizeTimeString(t);
    if (!normalized) return null;
    const [h, m] = normalized.split(':').map(Number);
    return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}

function getCoords(loc) {
    if (!loc) return null;
    if (loc.coordinates && loc.coordinates.lat != null && loc.coordinates.lng != null) {
        return { lat: loc.coordinates.lat, lng: loc.coordinates.lng };
    }
    if (loc.coords && Array.isArray(loc.coords) && loc.coords.length >= 2) {
        return { lat: loc.coords[1], lng: loc.coords[0] };
    }
    if (loc.coords && loc.coords.lat != null && loc.coords.lng != null) {
        return { lat: loc.coords.lat, lng: loc.coords.lng };
    }
    return null;
}

export function calculateTransitConflict(activityA, activityB) {
    const defaultOutput = { hasConflict: false, requiredTransitMins: 0, actualGapMins: 0 };
    if (!activityA || !activityB) return defaultOutput;

    const coordsA = getCoords(activityA.location);
    const coordsB = getCoords(activityB.location);

    if (!coordsA || !coordsB) return defaultOutput;

    const distKm = haversineDistance(coordsA.lat, coordsA.lng, coordsB.lat, coordsB.lng);
    const requiredTransitMins = Math.ceil(distKm / (20 / 60)); // 20 km/h = 1/3 km per min

    const endA = timeToMins(activityA.endTime);
    const startB = timeToMins(activityB.time);

    let actualGapMins = 0;
    if (endA !== null && startB !== null) {
        actualGapMins = startB - endA;
    } else {
        return { hasConflict: false, requiredTransitMins, actualGapMins: 0 };
    }

    const hasConflict = actualGapMins >= 0 && requiredTransitMins > actualGapMins;

    return { hasConflict, requiredTransitMins, actualGapMins };
}

export function findIdeasForGap(preGapCoords, postGapCoords, gapDurationMins, discoveredIdeas) {
    if (!discoveredIdeas || !preGapCoords || !postGapCoords) return [];

    let midLat, midLng;
    if (preGapCoords.lat != null && postGapCoords.lat != null) {
        midLat = (preGapCoords.lat + postGapCoords.lat) / 2;
        midLng = (preGapCoords.lng + postGapCoords.lng) / 2;
    } else if (Array.isArray(preGapCoords) && Array.isArray(postGapCoords)) {
        midLat = (preGapCoords[1] + postGapCoords[1]) / 2;
        midLng = (preGapCoords[0] + postGapCoords[0]) / 2;
    } else {
        return [];
    }

    const filtered = discoveredIdeas.filter(idea => {
        const duration = idea.estimatedDurationMins || 60;
        return duration < gapDurationMins - 60;
    });

    const withDistance = filtered.map(idea => {
        const coords = getCoords(idea.location);
        const dist = coords ? haversineDistance(midLat, midLng, coords.lat, coords.lng) : Infinity;
        return { ...idea, _gapDist: dist };
    });

    withDistance.sort((a, b) => a._gapDist - b._gapDist);

    return withDistance.slice(0, 5).map(idea => {
        const copy = { ...idea };
        delete copy._gapDist;
        return copy;
    });
}
