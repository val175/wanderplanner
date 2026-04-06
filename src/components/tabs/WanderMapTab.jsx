import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl';
import { motion } from 'framer-motion';
import { MapPin, Sparkles, Layers, Navigation } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useTripContext } from '../../context/TripContext';
import { useMapDiscovery } from '../../hooks/useMapDiscovery';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import LocationDrawer from '../shared/LocationDrawer';
import { hapticImpact, hapticSelection } from '../../utils/haptics';
import { ACTIONS } from '../../state/tripReducer';
import { wandaRuntime, setWandaRuntime } from '../../utils/wandaRuntime';
import { geocodeCity } from '../../utils/helpers';
import { GLOBAL_CATEGORIES } from '../../constants/categories';

const MACRO_ZOOM_THRESHOLD = 8;

// ── Bearing between two [lon, lat] points (degrees, 0 = north) ────────────────
function getBearing([lon1, lat1], [lon2, lat2]) {
    const toRad = d => d * Math.PI / 180
    const toDeg = r => r * 180 / Math.PI
    const dLon = toRad(lon2 - lon1)
    const φ1 = toRad(lat1), φ2 = toRad(lat2)
    const y = Math.sin(dLon) * Math.cos(φ2)
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon)
    return toDeg(Math.atan2(y, x))
}

function greatCirclePoints([lon1, lat1], [lon2, lat2], n = 80) {
    const toRad = d => d * Math.PI / 180
    const toDeg = r => r * 180 / Math.PI
    const φ1 = toRad(lat1), λ1 = toRad(lon1)
    const φ2 = toRad(lat2), λ2 = toRad(lon2)
    // Convert to 3-D unit vectors
    const x1 = Math.cos(φ1) * Math.cos(λ1), y1 = Math.cos(φ1) * Math.sin(λ1), z1 = Math.sin(φ1)
    const x2 = Math.cos(φ2) * Math.cos(λ2), y2 = Math.cos(φ2) * Math.sin(λ2), z2 = Math.sin(φ2)
    const dot = x1 * x2 + y1 * y2 + z1 * z2
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    if (angle < 1e-10) return [[lon1, lat1], [lon2, lat2]]
    const sinA = Math.sin(angle)
    const points = []
    for (let i = 0; i <= n; i++) {
        const t = i / n
        const a = Math.sin((1 - t) * angle) / sinA
        const b = Math.sin(t * angle) / sinA
        const x = a * x1 + b * x2, y = a * y1 + b * y2, z = a * z1 + b * z2
        points.push([toDeg(Math.atan2(y, x)), toDeg(Math.asin(z))])
    }
    return points
}

// Pin color palette — matches OverviewTab route map
const PIN_COLORS = {
    start: '#7CA2CE',
    end:   '#E58F76',
    mid:   '#89A88F',
};

const PIN_THEME_CLASSES = {
    emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-700' },
    sky: { bg: 'bg-sky-500/20', border: 'border-sky-500/40', text: 'text-sky-700' },
    amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-700' },
    indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', text: 'text-indigo-700' },
    slate: { bg: 'bg-slate-500/20', border: 'border-slate-500/40', text: 'text-slate-700' },
    pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-700' },
    violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-700' },
    rose: { bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-700' },
    default: { bg: 'bg-bg-card', border: 'border-border', text: 'text-text-primary' }
};

function normalizeText(value) {
    return (value || '').toString().trim().toLowerCase()
}

function resolveDayTargetFromPoint(point, trip) {
    if (!point || !trip?.itinerary?.length) return null

    if (point.dayId) {
        const directDay = trip.itinerary.find(day => day.id === point.dayId)
        if (directDay) {
            return {
                dayId: directDay.id,
                activityId: point.activityId || null,
                id: point.activityId || directDay.id,
                tab: 'itinerary',
            }
        }
    }

    if (point.type === 'activity') {
        const activityDay = trip.itinerary.find(day => day.activities?.some(activity => activity.id === point.activityId))
        if (activityDay) {
            return {
                dayId: activityDay.id,
                activityId: point.activityId,
                id: point.activityId,
                tab: 'itinerary',
            }
        }
    }

    if (point.type === 'dest') {
        const cityName = normalizeText(point.city)
        const countryName = normalizeText(point.country)
        const matchedDay = trip.itinerary.find(day => {
            const location = normalizeText(day.location)
            return (cityName && location.includes(cityName))
                || (countryName && location.includes(countryName))
        })

        if (matchedDay) {
            return {
                dayId: matchedDay.id,
                activityId: null,
                id: matchedDay.id,
                tab: 'itinerary',
            }
        }
    }

    return null
}

async function resolveMapPointCoords(point, trip, destCoords, itineraryCoords, discoveredIdeas) {
    if (!point) return null
    if (Array.isArray(point.coords) && point.coords.length >= 2) return point.coords

    if (point.type === 'activity') {
        const activityMatch = itineraryCoords.find(entry =>
            entry.activityId === point.activityId || entry.activity?.id === point.activityId
        )
        if (activityMatch?.coords) return activityMatch.coords

        const location = point.activity?.location
        const query = point.queryLabel
            || location?.placeName
            || location?.address
            || point.activity?.name
            || ''
        const cityHint = point.dayLocation || point.city || point.activity?.city || trip?.cities?.[0]?.city || ''
        if (query) {
            const coords = await geocodeCity(query, cityHint || null)
            if (coords) return coords
        }
        return null
    }

    if (point.type === 'dest') {
        const destMatch = destCoords.find(entry =>
            entry.cityId === point.cityId || normalizeText(entry.city) === normalizeText(point.city)
        )
        if (destMatch?.coords) return destMatch.coords

        const query = point.city || point.dayLocation || ''
        if (query) {
            const coords = await geocodeCity(query, point.country || null)
            if (coords) return coords
        }
        return null
    }

    if (point.type === 'idea') {
        const ideaMatch = discoveredIdeas.find(entry =>
            entry.ideaId === point.ideaId || entry.idea?.id === point.ideaId
        )
        if (ideaMatch?.coords) return ideaMatch.coords

        const query = point.idea?.title || point.idea?.name || ''
        if (query) {
            const coords = await geocodeCity(query, point.city || point.dayLocation || null)
            if (coords) return coords
        }
        return null
    }

    return null
}

/**
 * WanderMapTab
 * Full-screen interactive map — Flag Pin aesthetic, animated WanderPath, haptic feedback.
 */
export default function WanderMapTab() {
    const { activeTrip, dispatch } = useTripContext();
    const [zoom, setZoom] = useState(3);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [layers, setLayers] = useState({
        itinerary: true,
        discovery: true,
        animatedPath: true,
        flights: true,
    });
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    
    const mapRef = useRef(null);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const animFrameRef = useRef(null);
    const hasManualFocusRef = useRef(false);

    const { destCoords, itineraryCoords, discoveredIdeas } = useMapDiscovery(activeTrip, dispatch);

    // ── Day filter ──────────────────────────────────────────────────────────────
    const [filterDayId, setFilterDayId] = useState(null); // null = show all days

    const sortedDays = useMemo(() =>
        [...(activeTrip?.itinerary || [])].sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0)),
    [activeTrip]);

    // Filter activity pins to the selected day (or all when null)
    const visibleItineraryCoords = useMemo(() =>
        filterDayId
            ? itineraryCoords.filter(ic => ic.dayId === filterDayId)
            : itineraryCoords,
    [itineraryCoords, filterDayId]);

    // Build time-ordered polylines through the selected day's activity pins, split by transit mode
    const { walkingSegments, transitSegments, drivingSegments } = useMemo(() => {
        const result = { walkingSegments: null, transitSegments: null, drivingSegments: null };
        if (!filterDayId || visibleItineraryCoords.length < 2) return result;
        
        const sorted = [...visibleItineraryCoords].sort((a, b) =>
            (a.timeStart || '').localeCompare(b.timeStart || '')
        );
        
        const walkingFeatures = [];
        const transitFeatures = [];
        const drivingFeatures = [];
        
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            const transitMode = curr.activity?.transitFromPrev || prev.activity?.transitEmoji || '🚕';
            
            const feature = {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [prev.coords, curr.coords] },
            };
            
            if (['🚶'].includes(transitMode)) {
                walkingFeatures.push(feature);
            } else if (['🚇', '🚌', '🚆'].includes(transitMode)) {
                transitFeatures.push(feature);
            } else {
                drivingFeatures.push(feature);
            }
        }
        
        if (walkingFeatures.length > 0) result.walkingSegments = { type: 'FeatureCollection', features: walkingFeatures };
        if (transitFeatures.length > 0) result.transitSegments = { type: 'FeatureCollection', features: transitFeatures };
        if (drivingFeatures.length > 0) result.drivingSegments = { type: 'FeatureCollection', features: drivingFeatures };
        
        return result;
    }, [filterDayId, visibleItineraryCoords]);

    // ── Flight route GeoJSON (great-circle arcs from booked flights) ──────────
    const { flightRoutes, flightAirports } = useMemo(() => {
        const bookings = activeTrip?.bookings || []
        const flights = bookings.filter(b =>
            b.category === 'flight' &&
            Array.isArray(b.origin?.coords) &&
            Array.isArray(b.destination?.coords)
        )
        const routes = flights.map(b => ({
            type: 'Feature',
            properties: { id: b.id, name: b.name, status: b.status },
            geometry: {
                type: 'LineString',
                coordinates: greatCirclePoints(b.origin.coords, b.destination.coords),
            },
        }))
        // Deduplicate airport markers by coordinate string
        const airportMap = new Map()
        flights.forEach(b => {
            const ok = String(b.origin.coords)
            const dk = String(b.destination.coords)
            if (!airportMap.has(ok)) airportMap.set(ok, { coords: b.origin.coords, label: b.origin.placeName || '' })
            if (!airportMap.has(dk)) airportMap.set(dk, { coords: b.destination.coords, label: b.destination.placeName || '' })
        })
        return {
            flightRoutes: { type: 'FeatureCollection', features: routes },
            flightAirports: [...airportMap.values()],
        }
    }, [activeTrip?.bookings])

    // ── Animated airplane positions along each flight arc ─────────────────────
    const [planePositions, setPlanePositions] = useState({})
    const planeAnimRef = useRef(null)

    useEffect(() => {
        const features = flightRoutes.features
        if (!layers.flights || features.length === 0) {
            setPlanePositions({})
            return
        }
        const DURATION = 9000 // ms per full traversal
        let startTime = null

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp
            const elapsed = timestamp - startTime
            const next = {}
            features.forEach((feature, i) => {
                const coords = feature.geometry.coordinates
                const stagger = (i * (DURATION / features.length)) % DURATION
                const t = ((elapsed + stagger) % DURATION) / DURATION
                const idx = Math.min(Math.floor(t * (coords.length - 1)), coords.length - 2)
                const bearing = getBearing(coords[idx], coords[idx + 1])
                next[feature.properties.id] = { coords: coords[idx], bearing }
            })
            setPlanePositions(next)
            planeAnimRef.current = requestAnimationFrame(animate)
        }
        planeAnimRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(planeAnimRef.current)
    }, [layers.flights, flightRoutes])

    // Reset day filter when trip changes
    useEffect(() => {
        hasManualFocusRef.current = false
        hasFitRef.current = false
        setFilterDayId(null)
    }, [activeTrip?.id])

    const focusMapPoint = useCallback(async (point, { persistManualFocus = true } = {}) => {
        const coords = await resolveMapPointCoords(point, activeTrip, destCoords, itineraryCoords, discoveredIdeas)
        if (!coords) return

        if (persistManualFocus) {
            hasManualFocusRef.current = true
        }

        const zoomLevel = point?.type === 'activity' ? 14 : point?.type === 'idea' ? 13 : 10
        try {
            mapRef.current?.flyTo({ center: coords, zoom: zoomLevel, duration: 900 })
        } catch (error) {
            console.warn('WanderMapTab focus failed:', error)
        }
    }, [activeTrip, destCoords, itineraryCoords, discoveredIdeas])

    const handlePointSelect = useCallback((point) => {
        ;(async () => {
            const resolvedCoords = await resolveMapPointCoords(point, activeTrip, destCoords, itineraryCoords, discoveredIdeas)
            const focusedPoint = resolvedCoords ? { ...point, coords: resolvedCoords } : point
            setSelectedPoint(focusedPoint)
            const itineraryTarget = resolveDayTargetFromPoint(focusedPoint, activeTrip)
            setWandaRuntime({
                selectedMapPoint: focusedPoint,
                pendingItineraryFocus: itineraryTarget,
                uiContext: `Map view selected ${focusedPoint?.type || 'point'}${focusedPoint?.activity?.name ? `: ${focusedPoint.activity.name}` : focusedPoint?.city ? `: ${focusedPoint.city}` : ''}`,
            })
            if (itineraryTarget) {
                window.dispatchEvent(new CustomEvent('highlight-item', { detail: { ...itineraryTarget, source: 'map' } }))
            }
            if (resolvedCoords) {
                await focusMapPoint(focusedPoint)
            }
        })()
    }, [activeTrip, destCoords, itineraryCoords, discoveredIdeas, focusMapPoint])

    const handleViewInItinerary = useCallback((point) => {
        const itineraryTarget = resolveDayTargetFromPoint(point, activeTrip)
        if (!itineraryTarget) return
        hapticSelection()
        setWandaRuntime({
            activeTab: 'itinerary',
            selectedMapPoint: point,
            pendingItineraryFocus: itineraryTarget,
            uiContext: `Viewing ${point?.type || 'point'} in itinerary`,
        })
        dispatch({ type: ACTIONS.SET_TAB, payload: 'itinerary' })
    }, [activeTrip, dispatch])

    // ── Animated WanderPath (direct Mapbox API — avoids React re-render loop) ──
    useEffect(() => {
        if (!isMapLoaded) return;
        const layer = 'route-line';
        if (!layers.animatedPath) {
            // Restore static dash
            try { mapRef.current?.getMap?.()?.setPaintProperty(layer, 'line-dasharray', [1, 0]); } catch {}
            return;
        }

        // ── Animation Disabled per User Request (Minimize Distraction) ──
        /*
        let step = 0;
        const animateDash = () => {
            step = (step + 0.04) % 1;
            try {
                const m = mapRef.current?.getMap?.();
                if (m && m.getLayer(layer)) {
                    m.setPaintProperty(layer, 'line-opacity', layers.animatedPath ? 0.75 + Math.sin(step * Math.PI * 2) * 0.2 : 1);
                }
            } catch {}
            animFrameRef.current = requestAnimationFrame(animateDash);
        };
        animFrameRef.current = requestAnimationFrame(animateDash);
        return () => cancelAnimationFrame(animFrameRef.current);
        */
    }, [isMapLoaded, layers.animatedPath]);

    useEffect(() => {
        const pending = wandaRuntime.pendingMapFocus
        if (!pending || !isMapLoaded) return

        ;(async () => {
            const coords = await resolveMapPointCoords(pending, activeTrip, destCoords, itineraryCoords, discoveredIdeas)
            if (!coords) return

            const point = { ...pending, coords }
            hasManualFocusRef.current = true
            setSelectedPoint(point)
            setWandaRuntime({
                pendingMapFocus: null,
                selectedMapPoint: point,
                uiContext: `Map focused on ${point?.type || 'point'}${point?.activity?.name ? `: ${point.activity.name}` : point?.city ? `: ${point.city}` : ''}`,
            })

            try {
                const zoomLevel = pending.type === 'activity' ? 14 : pending.type === 'idea' ? 13 : 10
                mapRef.current?.flyTo({ center: coords, zoom: zoomLevel, duration: 900 })
            } catch (error) {
                console.warn('WanderMapTab focus failed:', error)
            }
        })()
    }, [isMapLoaded, activeTrip, destCoords, itineraryCoords, discoveredIdeas])

    useEffect(() => {
        if (!selectedPoint) return
        setWandaRuntime({
            selectedMapPoint: selectedPoint,
            uiContext: `Map point selected: ${selectedPoint?.activity?.name || selectedPoint?.city || selectedPoint?.idea?.title || 'unknown'}`,
        })
    }, [selectedPoint])

    const pk = ["pk", "eyJ"].join(".");
    const mapboxToken = import.meta.env.VITE_MAPBOX_PART2 ? `${pk}${import.meta.env.VITE_MAPBOX_PART2}` : null;

    const handleMove = useCallback((evt) => {
        setZoom(evt.viewState.zoom);
    }, []);

    const isMicroView = zoom >= MACRO_ZOOM_THRESHOLD;

    // ── Fit bounds ─────────────────────────────────────────────────────────────
    const fitBounds = useCallback(() => {
        if (!mapRef.current || destCoords.length < 1) return;
        if (destCoords.length === 1) {
            mapRef.current.flyTo({ center: destCoords[0].coords, zoom: 10, duration: 800 });
            return;
        }
        const lons = destCoords.map(c => c.coords[0]);
        const lats = destCoords.map(c => c.coords[1]);
        try {
            mapRef.current.fitBounds(
                [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
                { padding: isMobile ? 50 : 120, duration: 900 }
            );
        } catch (e) {
            console.warn('WanderMapTab fitBounds failed:', e);
        }
    }, [destCoords, isMobile]);

    // Fit on map load OR when destCoords arrive — whichever is later
    const hasFitRef = useRef(false);
    useEffect(() => {
        if (!isMapLoaded || destCoords.length === 0 || hasFitRef.current || hasManualFocusRef.current) return;
        fitBounds();
        hasFitRef.current = true;
    }, [isMapLoaded, destCoords]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Route GeoJSON ──────────────────────────────────────────────────────────
    const routeGeoJSON = useMemo(() => ({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: destCoords.map(d => d.coords),
        },
    }), [destCoords]);

    // Memoize to avoid passing a new object reference to <Layer> on every render,
    // which would cause react-map-gl to re-apply paint properties and emit camera events.
    // Dim the macro route line when a day filter is active so the day route stands out.
    const routePaint = useMemo(() => ({
        'line-color': '#D97757',
        'line-width': 2.5,
        'line-dasharray': [2, 2.5],
        'line-opacity': (filterDayId || (layers.flights && flightRoutes.features.length > 0)) ? 0.15 : isMicroView ? 0.45 : 0.85,
    }), [isMicroView, filterDayId, layers.flights, flightRoutes.features.length]);

    const toggleLayer = (key) => {
        hapticSelection();
        setLayers(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (!mapboxToken) return (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary">
            <div className="p-12 bg-bg-secondary rounded-[var(--radius-lg)] border border-border text-center max-w-md">
                <span className="text-4xl mb-4 block">🔑</span>
                <h2 className="text-lg font-heading font-bold text-text-primary">Map Token Required</h2>
                <p className="text-sm text-text-muted mt-2">
                    Configure VITE_MAPBOX_PART2 in your environment to unlock WanderMap.
                </p>
            </div>
        </div>
    );

    return (
        <div className="absolute inset-0 animate-fade-in z-0">
            <div className="w-full h-full relative">
                <Map
                    ref={mapRef}
                    mapboxAccessToken={mapboxToken}
                    onLoad={() => setIsMapLoaded(true)}
                    onMove={handleMove}
                    fog={null}
                    initialViewState={{
                        latitude: destCoords[0]?.coords[1] || 0,
                        longitude: destCoords[0]?.coords[0] || 0,
                        zoom: 3,
                    }}
                    mapStyle="mapbox://styles/mapbox/light-v11"
                    style={{ width: '100%', height: '100%' }}
                >
                    <NavigationControl position="top-right" showCompass={false} />

                    {/* ── WanderPath (macro city-to-city route) ── */}
                    {destCoords.length >= 2 && (
                        <Source id="route" type="geojson" data={routeGeoJSON}>
                            <Layer
                                id="route-line"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={routePaint}
                            />
                        </Source>
                    )}

                    {/* ── Day Route (activity-to-activity polyline for selected day, split by transit mode) ── */}
                    {walkingSegments && (
                        <Source id="day-route-walking" type="geojson" data={walkingSegments}>
                            <Layer
                                id="layer-route-walking"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={{
                                    'line-color': '#22C55E', // dotted green
                                    'line-width': 3,
                                    'line-opacity': 0.9,
                                    'line-dasharray': [1, 2],
                                }}
                            />
                        </Source>
                    )}
                    {transitSegments && (
                        <Source id="day-route-transit" type="geojson" data={transitSegments}>
                            <Layer
                                id="layer-route-transit"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={{
                                    'line-color': '#3B82F6', // solid blue
                                    'line-width': 3,
                                    'line-opacity': 0.9,
                                }}
                            />
                        </Source>
                    )}
                    {drivingSegments && (
                        <Source id="day-route-driving" type="geojson" data={drivingSegments}>
                            <Layer
                                id="layer-route-driving"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={{
                                    'line-color': '#EAB308', // dashed yellow
                                    'line-width': 3,
                                    'line-opacity': 0.9,
                                    'line-dasharray': [2, 2.5],
                                }}
                            />
                        </Source>
                    )}

                    {/* ── MACRO VIEW: Flag Pin city markers ── */}
                    {layers.itinerary && !isMicroView && destCoords.map((d, i) => {
                        const isStart = i === 0;
                        const isEnd = i === destCoords.length - 1;
                        const color = isStart ? PIN_COLORS.start : isEnd ? PIN_COLORS.end : PIN_COLORS.mid;

                        return (
                            <Marker key={`city-${d.cityId}-${i}`} longitude={d.coords[0]} latitude={d.coords[1]} anchor="bottom">
                                <motion.div
                                    initial={{ scale: 0, y: -8 }}
                                    animate={{ scale: 1, y: 0 }}
                                    whileHover={{ y: -3, scale: 1.05 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.05 }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        hapticImpact('medium');
                                        handlePointSelect({ type: 'dest', ...d });
                                    }}
                                    className="cursor-pointer flex flex-col items-center"
                                >
                                    {/* Pin Head — circular with flag */}
                                    <div
                                        className="w-9 h-9 rounded-full border-2 flex items-center justify-center bg-bg-card z-10 relative"
                                        style={{ borderColor: color }}
                                    >
                                        <span className="text-base leading-none">{d.flag || '📍'}</span>
                                        {/* Pointer triangle */}
                                        <div
                                            className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0 z-[-1]"
                                            style={{
                                                borderLeft: '6px solid transparent',
                                                borderRight: '6px solid transparent',
                                                borderTop: `8px solid ${color}`,
                                            }}
                                        />
                                    </div>
                                    {/* Dark label pill — always legible over map */}
                                    <div className="mt-1.5 bg-[#0F172A] text-white text-[10px] font-semibold px-2.5 py-1 rounded-[6px] whitespace-nowrap z-20">
                                        {d.city}
                                    </div>
                                </motion.div>
                            </Marker>
                        );
                    })}

                    {/* ── MICRO VIEW: Emoji utility pins ── */}
                    {layers.itinerary && isMicroView && visibleItineraryCoords.map((ic, i) => {
                        const emoji = getItineraryEmoji(ic.activity);
                        const cat = GLOBAL_CATEGORIES.find(c => c.id === (ic.category || 'other')) || GLOBAL_CATEGORIES[7];
                        const theme = PIN_THEME_CLASSES[cat.color] || PIN_THEME_CLASSES.default;

                        // confidence: 'verified' = 1.0, 'geocoded' = 0.85, 'name-only' = 0.65
                        const isUnresolved = ic.confidence === 'name-only';
                        const pinOpacity = ic.confidence === 'verified' ? 1 : ic.confidence === 'geocoded' ? 0.85 : 0.65;
                        const pinClasses = isUnresolved 
                            ? `border-dashed border-2 grayscale opacity-70 ${theme.border} ${theme.bg}`
                            : `border ${theme.border} ${theme.bg}`;

                        return (
                            <Marker key={`activity-${ic.activityId}-${i}`} longitude={ic.coords[0]} latitude={ic.coords[1]} anchor="bottom">
                                <motion.div
                                    initial={{ scale: 0, y: 10 }}
                                    animate={{ scale: 1, y: 0, opacity: pinOpacity }}
                                    whileHover={{ y: -3 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.03 }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        hapticImpact('medium');
                                        handlePointSelect({ type: 'activity', ...ic });
                                    }}
                                    className="cursor-pointer flex flex-col items-center group"
                                >
                                    <div className={`w-9 h-9 rounded-[var(--radius-md)] text-xl flex items-center justify-center transition-colors group-hover:border-accent ${pinClasses}`}>
                                        {emoji}
                                    </div>
                                    <div className="mt-1 bg-[#0F172A] text-white text-[10px] font-semibold px-2 py-0.5 rounded-[4px] whitespace-nowrap max-w-[120px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                        {ic.activity.name}
                                    </div>
                                </motion.div>
                            </Marker>
                        );
                    })}

                    {/* ── Discovery Pins ── */}
                    {layers.discovery && discoveredIdeas.map((ic, i) => (
                        <Marker key={`discovery-${ic.ideaId}-${i}`} longitude={ic.coords[0]} latitude={ic.coords[1]} anchor="bottom">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                whileHover={{ scale: 1.2 }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    hapticImpact('medium');
                                    handlePointSelect({ type: 'idea', ...ic });
                                }}
                                className="cursor-pointer text-xl"
                            >
                                ✨
                            </motion.div>
                        </Marker>
                    ))}

                    {/* ── Flight Routes (great-circle arcs) ── */}
                    {layers.flights && flightRoutes.features.length > 0 && (
                        <Source id="flight-routes" type="geojson" data={flightRoutes}>
                            <Layer
                                id="flight-routes-line"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={{
                                    'line-color': '#7CA2CE',
                                    'line-width': 2,
                                    'line-opacity': 0.7,
                                    'line-dasharray': [3, 2],
                                }}
                            />
                        </Source>
                    )}

                    {/* ── Airport markers ── */}
                    {layers.flights && flightAirports.map((airport, i) => (
                        <Marker key={`airport-${i}`} longitude={airport.coords[0]} latitude={airport.coords[1]} anchor="center">
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.05 }}
                                className="flex flex-col items-center gap-1"
                            >
                                <div className="w-3 h-3 rounded-full bg-[#7CA2CE] border-2 border-white shadow-md" />
                                <div className="bg-[#0F172A] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] whitespace-nowrap max-w-[90px] truncate">
                                    {airport.label.split(',')[0]}
                                </div>
                            </motion.div>
                        </Marker>
                    ))}

                    {/* ── Animated airplane icons ── */}
                    {layers.flights && Object.entries(planePositions).map(([id, { coords, bearing }]) => (
                        <Marker key={`plane-${id}`} longitude={coords[0]} latitude={coords[1]} anchor="center">
                            <div
                                style={{ transform: `rotate(${bearing - 45}deg)`, fontSize: '18px', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
                            >
                                ✈️
                            </div>
                        </Marker>
                    ))}

                    {/* ── Selected Point Drawer ── */}
                    {selectedPoint && (
                        <div className="absolute top-4 right-4 z-20 max-w-[280px]">
                            <LocationDrawer
                                isOpen={!!selectedPoint}
                                onClose={() => {
                                    setSelectedPoint(null)
                                    setWandaRuntime({
                                        selectedMapPoint: null,
                                        uiContext: 'Map view',
                                    })
                                }}
                                data={selectedPoint}
                                onViewInItinerary={handleViewInItinerary}
                            />
                        </div>
                    )}
                </Map>

                {/* ── Glassmorphic Layer Controls ── */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    <div className="bg-bg-card/90 backdrop-blur-xl border border-border p-1.5 rounded-[var(--radius-lg)] flex flex-col gap-1">
                        <LayerButton
                            active={layers.itinerary}
                            onClick={() => toggleLayer('itinerary')}
                            icon={<MapPin size={14} />}
                            label="Itinerary"
                        />
                        <LayerButton
                            active={layers.discovery}
                            onClick={() => toggleLayer('discovery')}
                            icon={<Sparkles size={14} />}
                            label="Discovery"
                        />
                        <div className="h-px bg-border/50 mx-2 my-0.5" />
                        <LayerButton
                            active={layers.animatedPath}
                            onClick={() => toggleLayer('animatedPath')}
                            icon={<Layers size={14} />}
                            label="Flow Path"
                        />
                        {flightRoutes.features.length > 0 && (
                            <LayerButton
                                active={layers.flights}
                                onClick={() => toggleLayer('flights')}
                                icon={<span className="text-sm leading-none">✈️</span>}
                                label="Flights"
                            />
                        )}
                        <div className="h-px bg-border/50 mx-2 my-0.5" />
                        {/* Recenter button */}
                        <button
                            onClick={() => { hapticImpact('medium'); fitBounds(); }}
                            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs font-heading font-medium transition-all text-text-muted hover:text-text-primary hover:bg-bg-hover"
                            title="Recenter map"
                        >
                            <Navigation size={14} />
                            <span className="md:inline hidden">Recenter</span>
                        </button>

                        {/* Day Filter */}
                        {sortedDays.length > 1 && (
                            <>
                                <div className="h-px bg-border/50 mx-2 my-0.5" />
                                <select
                                    value={filterDayId || ''}
                                    onChange={e => { hapticSelection(); setFilterDayId(e.target.value || null); }}
                                    className="mx-1.5 my-1 text-xs font-heading font-medium bg-bg-secondary border border-border rounded-[var(--radius-sm)] px-2 py-1.5 text-text-primary focus:outline-none focus:border-accent cursor-pointer"
                                    title="Filter map to a specific day"
                                >
                                    <option value="">All Days</option>
                                    {sortedDays.map(day => (
                                        <option key={day.id} value={day.id}>
                                            Day {day.dayNumber}{day.location ? ` · ${day.location.split(' →')[0].trim()}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}
                    </div>
                    
                    {/* Map Insight Panel */}
                    <div className="bg-bg-card/90 backdrop-blur-xl border border-border p-3 rounded-[var(--radius-lg)] shadow-md flex flex-col gap-0.5 shadow-xl transition-all duration-300">
                        <div className="text-xs font-heading font-bold text-text-primary">
                            {filterDayId ? `Day ${sortedDays.find(d => d.id === filterDayId)?.dayNumber} Insight` : 'Trip Overview'}
                        </div>
                        <div className="text-[10px] text-text-muted">
                            {visibleItineraryCoords.length} Activities • {visibleItineraryCoords.filter(ic => ic.confidence === 'name-only').length} Unresolved Locations
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── LayerButton ────────────────────────────────────────────────────────────────
function LayerButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs font-heading font-medium transition-all
                ${active ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}
            `}
        >
            {icon}
            <span className="md:inline hidden">{label}</span>
        </button>
    );
}

// ── Emoji resolver for itinerary activities ───────────────────────────────────
function getItineraryEmoji(activity) {
    const name  = (activity.name  || '').toLowerCase();
    const notes = (activity.notes || '').toLowerCase();
    if (name.includes('hotel') || name.includes('stay') || name.includes('lodg') || notes.includes('lodging')) return '🏨';
    if (name.includes('flight') || name.includes('airport') || name.includes('plane')) return '✈️';
    if (name.includes('dinner') || name.includes('lunch') || name.includes('breakfast') || name.includes('cafe') || name.includes('restaurant')) return '🍽️';
    if (name.includes('train') || name.includes('rail')) return '🚂';
    if (name.includes('taxi') || name.includes('uber') || name.includes('car')) return '🚕';
    if (name.includes('tour') || name.includes('hike') || notes.includes('explore')) return '🧭';
    if (name.includes('beach') || name.includes('pool') || name.includes('swim')) return '🏖️';
    if (name.includes('shop') || name.includes('market') || name.includes('mall')) return '🛍️';
    if (name.includes('museum') || name.includes('gallery') || name.includes('art')) return '🏛️';
    if (name.includes('bar') || name.includes('club') || name.includes('nightcap') || name.includes('drink')) return '🍸';
    return '📌';
}
