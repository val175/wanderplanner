import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Map, { Marker, Source, Layer, NavigationControl, Popup } from 'react-map-gl';
import { motion } from 'framer-motion';
import { MapPin, Sparkles, Layers, Navigation } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useTripContext } from '../../context/TripContext';
import { useMapDiscovery } from '../../hooks/useMapDiscovery';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import LocationDrawer from '../shared/LocationDrawer';
import { hapticImpact, hapticSelection } from '../../utils/haptics';

const MACRO_ZOOM_THRESHOLD = 8;

// Pin color palette — matches OverviewTab route map
const PIN_COLORS = {
    start: '#7CA2CE',
    end:   '#E58F76',
    mid:   '#89A88F',
};

/**
 * WanderMapTab
 * Full-screen interactive map — Flag Pin aesthetic, animated WanderPath, haptic feedback.
 */
export default function WanderMapTab() {
    const { activeTrip } = useTripContext();
    const [zoom, setZoom] = useState(3);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [layers, setLayers] = useState({
        itinerary: true,
        discovery: true,
        animatedPath: true,
    });
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [lineDashOffset, setLineDashOffset] = useState(0);
    const mapRef = useRef(null);
    const isMobile = useMediaQuery('(max-width: 767px)');
    const animFrameRef = useRef(null);

    const { destCoords, itineraryCoords, discoveredIdeas } = useMapDiscovery(activeTrip);

    // ── Animated WanderPath ────────────────────────────────────────────────────
    useEffect(() => {
        if (!layers.animatedPath) {
            cancelAnimationFrame(animFrameRef.current);
            return;
        }
        const animate = () => {
            setLineDashOffset(prev => (prev - 0.3) % 20);
            animFrameRef.current = requestAnimationFrame(animate);
        };
        animFrameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [layers.animatedPath]);

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

    useEffect(() => {
        if (isMapLoaded) fitBounds();
    }, [destCoords, isMapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Route GeoJSON ──────────────────────────────────────────────────────────
    const routeGeoJSON = useMemo(() => ({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: destCoords.map(d => d.coords),
        },
    }), [destCoords]);

    const pathPaint = useMemo(() => ({
        'line-color': '#D97757',
        'line-width': 2.5,
        'line-opacity': isMicroView ? 0.45 : 1,
        ...(layers.animatedPath
            ? { 'line-dasharray': [2, 2.5], 'line-offset': lineDashOffset }
            : { 'line-dasharray': [1, 0] }
        ),
    }), [isMicroView, layers.animatedPath, lineDashOffset]);

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

                    {/* ── WanderPath ── */}
                    {layers.animatedPath && destCoords.length >= 2 && (
                        <Source id="route" type="geojson" data={routeGeoJSON}>
                            <Layer
                                id="route-line"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={pathPaint}
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
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        hapticImpact('medium');
                                        setSelectedPoint({ type: 'dest', ...d });
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
                    {layers.itinerary && isMicroView && itineraryCoords.map((ic, i) => {
                        const emoji = getItineraryEmoji(ic.activity);
                        return (
                            <Marker key={`activity-${ic.activityId}-${i}`} longitude={ic.coords[0]} latitude={ic.coords[1]} anchor="bottom">
                                <motion.div
                                    initial={{ scale: 0, y: 10 }}
                                    animate={{ scale: 1, y: 0 }}
                                    whileHover={{ y: -3 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.03 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        hapticImpact('medium');
                                        setSelectedPoint({ type: 'activity', ...ic });
                                    }}
                                    className="cursor-pointer flex flex-col items-center group"
                                >
                                    <div className="w-9 h-9 bg-bg-card border border-border rounded-[var(--radius-md)] text-xl flex items-center justify-center transition-colors group-hover:border-accent">
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    hapticImpact('medium');
                                    setSelectedPoint({ type: 'idea', ...ic });
                                }}
                                className="cursor-pointer text-xl"
                            >
                                ✨
                            </motion.div>
                        </Marker>
                    ))}

                    {/* ── Inline Popup ── */}
                    {selectedPoint && (
                        <Popup
                            longitude={selectedPoint.coords[0]}
                            latitude={selectedPoint.coords[1]}
                            anchor="bottom-right"
                            offset={[0, -48]}
                            onClose={() => setSelectedPoint(null)}
                            closeButton={false}
                            closeOnClick={false}
                            className="z-[1001]"
                        >
                            <LocationDrawer
                                isOpen={!!selectedPoint}
                                onClose={() => setSelectedPoint(null)}
                                data={selectedPoint}
                            />
                        </Popup>
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
