import { normalizeTimeString } from './helpers';
import { CITY_DB } from '../components/shared/CityCombobox'

const COUNTRY_CODE_LOOKUP = new Map(
  CITY_DB.map(entry => [entry.country.trim().toLowerCase(), entry.iso])
)

export function normalizeCountryCode(country) {
  if (!country) return null
  const trimmed = country.toString().trim()
  if (!trimmed) return null
  if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase()
  return COUNTRY_CODE_LOOKUP.get(trimmed.toLowerCase()) || null
}

export function buildTripCountryCodes(trip) {
  const sourceEntries = [
    ...(trip?.cities || []),
    ...(trip?.destinations || []),
  ]
  return [...new Set(sourceEntries
    .map(entry => normalizeCountryCode(entry?.iso || entry?.countryCode || entry?.country))
    .filter(Boolean))]
}

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

/** Returns the best matching city for a day, based on day.location string. */
function resolveDayCity(day, cities) {
  if (!day?.location || !cities?.length) return null
  const loc = day.location.toLowerCase()
  const matches = cities.filter(c => c.city && loc.includes(c.city.toLowerCase()))
  if (!matches.length) return null
  // For transit days ("Cebu → Singapore"), prefer the last matching city (arrival)
  return matches[matches.length - 1]
}

/**
 * Returns a Map<dayId, { dayNumber, date, city, country, flag, label, isTransit }>
 * for all days in the trip, keyed by day.id for O(1) lookup.
 */
export function getDayLocationMap(trip) {
  const result = new Map()
  const itinerary = trip?.itinerary || []
  const cities = trip?.cities || []
  for (const day of itinerary) {
    const resolved = resolveDayCity(day, cities)
    result.set(day.id, {
      dayNumber: day.dayNumber,
      date: day.date,
      city: resolved?.city || null,
      country: resolved?.country || null,
      flag: resolved?.flag || '',
      label: resolved ? `${resolved.city}, ${resolved.country}` : (day.location || 'Unknown'),
      isTransit: (day.location || '').includes('→'),
    })
  }
  return result
}

/** Extracts a likely city name from a geocoder address string (comma-split, second-to-last token). */
function extractCityFromAddress(address) {
  if (!address) return null
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null
}

/**
 * Returns a conflict object if the activity's location doesn't match the day's expected city.
 * Returns null if no conflict (or not enough data to determine).
 */
export function detectLocationConflict(activityLocation, expectedDayEntry) {
  if (!activityLocation || !expectedDayEntry?.city) return null
  const locationText = activityLocation?.placeName
    || activityLocation?.address
    || (typeof activityLocation === 'string' ? activityLocation : '')
  if (!locationText) return null

  const lc = locationText.toLowerCase()
  if (lc.includes(expectedDayEntry.city.toLowerCase())) return null
  if (expectedDayEntry.country && lc.includes(expectedDayEntry.country.toLowerCase())) return null

  return {
    expectedCity: expectedDayEntry.city,
    expectedCountry: expectedDayEntry.country,
    detectedCity: extractCityFromAddress(locationText) || locationText,
    isTransit: expectedDayEntry.isTransit,
  }
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
