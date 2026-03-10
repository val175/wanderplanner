import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation2, MapPin, Sparkles, Layers, X, Briefcase, Hotel, Compass, Car } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useTripContext } from '../../context/TripContext';
import { useMapDiscovery } from '../../hooks/useMapDiscovery';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import LocationDrawer from '../shared/LocationDrawer';

const MACRO_ZOOM_THRESHOLD = 8;

/**
 * WanderMapTab
 * Full-screen interactive map with zoom-dependent pins and strict design system adherence.
 */
export default function WanderMapTab() {
    const { activeTrip } = useTripContext();
    const [zoom, setZoom] = useState(3);
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [layers, setLayers] = useState({
        itinerary: true,
        discovery: true,
        animatedPath: true
    });
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [lineDashOffset, setLineDashOffset] = useState(0);
    const mapRef = useRef(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    const { destCoords, itineraryCoords, discoveredIdeas, isLoading } = useMapDiscovery(activeTrip);

    // Path animation effect
    useEffect(() => {
        if (!layers.animatedPath) return;
        let frame;
        const animate = () => {
            setLineDashOffset(prev => (prev - 0.2) % 12);
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [layers.animatedPath]);

    const pk = ["pk", "eyJ"].join(".");
    const mapboxToken = import.meta.env.VITE_MAPBOX_PART2 ? `${pk}${import.meta.env.VITE_MAPBOX_PART2}` : null;

    // Viewport state management with zoom tracking
    const handleMove = useCallback((evt) => {
        setZoom(evt.viewState.zoom);
    }, []);

    const isMicroView = zoom >= MACRO_ZOOM_THRESHOLD;

    // Auto-fit bounds on load
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || destCoords.length < 2) return;
        const lons = destCoords.map(c => c.coords[0]);
        const lats = destCoords.map(c => c.coords[1]);
        try {
            mapRef.current.fitBounds(
                [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
                { padding: isMobile ? 40 : 100, duration: 1000 }
            );
        } catch (e) {
            console.warn("WanderMapTab fitBounds failed:", e);
        }
    }, [destCoords, isMapLoaded, isMobile]);

    const routeGeoJSON = useMemo(() => ({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: destCoords.map(d => d.coords)
        }
    }), [destCoords]);

    if (!mapboxToken) return (
        <div className="absolute inset-0 animate-fade-in z-0">
            {/* Map Container */}
            <div className="w-full h-full relative flex flex-col items-center justify-center">
                <div className="p-12 bg-bg-secondary rounded-[var(--radius-lg)] border border-border text-center max-w-md">
                    <span className="text-4xl mb-4 block">🔑</span>
                    <h2 className="text-lg font-heading font-bold text-text-primary">Map Token Required</h2>
                    <p className="text-sm text-text-muted mt-2">
                        Please configure VITE_MAPBOX_PART2 in your environment to unlock the full WanderMap experience.
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="absolute inset-0 animate-fade-in z-0">
            {/* Map Container */}
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
                        zoom: 3
                    }}
                    mapStyle="mapbox://styles/mapbox/light-v11"
                    style={{ width: '100%', height: '100%' }}
                >
                    <NavigationControl position="top-right" showCompass={false} />

                    {/* Route Line */}
                    {layers.itinerary && destCoords.length >= 2 && (
                        <Source id="route" type="geojson" data={routeGeoJSON}>
                            <Layer
                                id="route-line"
                                type="line"
                                paint={{
                                    'line-color': '#D97757',
                                    'line-width': isMicroView ? 4 : 3,
                                    'line-dasharray': [2, 2],
                                    'line-dash-offset': lineDashOffset,
                                    'line-opacity': isMicroView ? 0.4 : 1
                                }}
                            />
                        </Source>
                    )}

                    {/* MACRO VIEW: City Markers */}
                    {!isMicroView && destCoords.map((d, i) => (
                        <Marker key={`city-${d.cityId}-${i}`} longitude={d.coords[0]} latitude={d.coords[1]} anchor="bottom">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                whileHover={{ scale: 1.1 }}
                                transition={{ type: 'spring', damping: 15 }}
                                onClick={() => setSelectedPoint({ type: 'dest', ...d })}
                                className="cursor-pointer flex flex-col items-center pb-2"
                            >
                                <div className="px-3 py-1.5 bg-bg-card border border-border rounded-[var(--radius-md)] text-text-primary text-xs font-heading font-bold whitespace-nowrap flex items-center gap-2">
                                    <span className="text-accent"><Navigation2 size={12} className="fill-current" /></span>
                                    {d.city}
                                </div>
                                <div className="w-0.5 h-2 bg-border" />
                            </motion.div>
                        </Marker>
                    ))}

                    {/* MICRO VIEW: Itinerary Detail Markers */}
                    {isMicroView && itineraryCoords.map((ic, i) => {
                        const icon = getItineraryIcon(ic.activity);
                        return (
                            <Marker key={`activity-${ic.activityId}-${i}`} longitude={ic.coords[0]} latitude={ic.coords[1]} anchor="bottom">
                                <motion.div
                                    initial={{ scale: 0, y: 10 }}
                                    animate={{ scale: 1, y: 0 }}
                                    whileHover={{ y: -2 }}
                                    onClick={() => setSelectedPoint({ type: 'activity', ...ic })}
                                    className="cursor-pointer flex flex-col items-center pb-2 group"
                                >
                                    <div className="w-8 h-8 bg-bg-card border border-border rounded-[var(--radius-md)] text-accent flex items-center justify-center transition-colors hover:border-accent">
                                        {icon}
                                    </div>
                                    <div className="mt-1 px-2 py-0.5 bg-bg-card border border-border rounded-[var(--radius-sm)] text-[10px] font-bold text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[120px] truncate">
                                        {ic.activity.name}
                                    </div>
                                </motion.div>
                            </Marker>
                        );
                    })}

                    {/* Discovery Layer Pins (Active in both views, but filtered) */}
                    {layers.discovery && discoveredIdeas.map((ic, i) => (
                        <Marker key={`discovery-${ic.ideaId}-${i}`} longitude={ic.coords[0]} latitude={ic.coords[1]} anchor="bottom">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                whileHover={{ scale: 1.2 }}
                                onClick={() => setSelectedPoint({ type: 'idea', ...ic })}
                                className="cursor-pointer p-1.5 bg-bg-primary border border-border rounded-full text-indigo-500 hover:text-indigo-600 transition-colors"
                            >
                                <Sparkles size={14} className="fill-current opacity-20" />
                            </motion.div>
                        </Marker>
                    ))}
                </Map>

                {/* Glassmorphic Map Control Overlay */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    <div className="bg-bg-card/90 backdrop-blur-xl border border-border p-1.5 rounded-[var(--radius-lg)] flex flex-col gap-1">
                        <LayerButton
                            active={layers.itinerary}
                            onClick={() => setLayers(prev => ({ ...prev, itinerary: !prev.itinerary }))}
                            icon={<MapPin size={14} />}
                            label="Itinerary"
                        />
                        <LayerButton
                            active={layers.discovery}
                            onClick={() => setLayers(prev => ({ ...prev, discovery: !prev.discovery }))}
                            icon={<Sparkles size={14} />}
                            label="Discovery"
                        />
                        <div className="h-px bg-border/50 mx-2 my-0.5" />
                        <LayerButton
                            active={layers.animatedPath}
                            onClick={() => setLayers(prev => ({ ...prev, animatedPath: !prev.animatedPath }))}
                            icon={<Layers size={14} />}
                            label="Flow Path"
                        />
                    </div>
                </div>

                {/* Selection Details Drawer */}
                <LocationDrawer
                    isOpen={!!selectedPoint}
                    onClose={() => setSelectedPoint(null)}
                    data={selectedPoint}
                />
            </div>
        </div>
    );
}

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

function getItineraryIcon(activity) {
    const name = (activity.name || '').toLowerCase();
    const notes = (activity.notes || '').toLowerCase();

    if (name.includes('hotel') || name.includes('stay') || notes.includes('lodging')) return <Hotel size={14} />;
    if (name.includes('flight') || name.includes('airport')) return <Navigation2 size={14} className="rotate-45" />;
    if (name.includes('train') || name.includes('taxi') || name.includes('car')) return <Car size={14} />;
    if (name.includes('tour') || name.includes('hike') || notes.includes('explore')) return <Compass size={14} />;
    return <Briefcase size={14} />;
}
