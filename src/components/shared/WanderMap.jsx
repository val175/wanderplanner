import React, { useMemo, useState, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, MapPin, Sparkles, Navigation2, X } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useMapDiscovery } from '../../hooks/useMapDiscovery';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import LocationDrawer from './LocationDrawer';

/**
 * WanderMap
 * Premium interactive map component with discovery layers and animated paths.
 */
export default function WanderMap({ trip, className = '' }) {
    const [layers, setLayers] = useState({
        itinerary: true,
        discovery: true,
        animatedPath: true
    });
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [lineDashOffset, setLineDashOffset] = useState(0);
    const mapRef = useRef(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    const { destCoords, discoveredIdeas, isLoading } = useMapDiscovery(trip);

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

    // Assemble Mapbox token
    const pk = ["pk", "eyJ"].join(".");
    const mapboxToken = import.meta.env.VITE_MAPBOX_PART2 ? `${pk}${import.meta.env.VITE_MAPBOX_PART2}` : null;

    // Auto-fit bounds when destinations load
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || destCoords.length < 2) return;
        const lons = destCoords.map(c => c.coords[0]);
        const lats = destCoords.map(c => c.coords[1]);
        try {
            mapRef.current.fitBounds(
                [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
                { padding: isMobile ? 40 : 100, duration: 800 }
            );
        } catch (e) {
            console.warn("WanderMap fitBounds failed:", e);
        }
    }, [destCoords, isMapLoaded, isMobile]);

    // GeoJSON LineString for the route
    const routeGeoJSON = useMemo(() => ({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: destCoords.map(d => d.coords)
        }
    }), [destCoords]);

    if (!mapboxToken) return (
        <div className="flex flex-col items-center justify-center p-8 bg-bg-secondary rounded-[var(--radius-lg)] border border-border min-h-[300px]">
            <span className="text-2xl mb-2">🔑</span>
            <p className="text-sm font-semibold text-warning">Mapbox Token Missing</p>
            <p className="text-xs text-text-muted mt-1">Please add VITE_MAPBOX_PART2 to .env</p>
        </div>
    );

    return (
        <div className={`relative w-full h-full rounded-[var(--radius-lg)] overflow-hidden border border-border bg-bg-secondary ${className}`}>
            <Map
                ref={mapRef}
                mapboxAccessToken={mapboxToken}
                onLoad={() => setIsMapLoaded(true)}
                fog={null}
                initialViewState={{
                    latitude: destCoords[0]?.coords[1] || 0,
                    longitude: destCoords[0]?.coords[0] || 0,
                    zoom: 3
                }}
                mapStyle="mapbox://styles/mapbox/light-v11"
                style={{ width: '100%', height: '100%' }}
            >
                {/* Route Path */}
                {layers.itinerary && destCoords.length >= 2 && (
                    <Source id="route" type="geojson" data={routeGeoJSON}>
                        <Layer
                            id="route-line"
                            type="line"
                            paint={{
                                'line-color': '#E86E50',
                                'line-width': 3,
                                'line-dasharray': [2, 2],
                                'line-dash-offset': lineDashOffset
                            }}
                        />
                    </Source>
                )}

                {/* Destination Markers */}
                {destCoords.map((d, i) => (
                    <Marker key={d.cityId} longitude={d.coords[0]} latitude={d.coords[1]} anchor="bottom">
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => setSelectedPoint({ type: 'dest', ...d })}
                            className="cursor-pointer group flex flex-col items-center pb-2"
                        >
                            <div className="w-9 h-9 rounded-full border-2 border-border bg-bg-card flex items-center justify-center text-text-primary ring-2 ring-accent/20 group-hover:scale-110 transition-transform">
                                <Navigation2 size={14} className="fill-current" />
                            </div>
                            <div className="mt-1.5 px-2 py-0.5 bg-[#0F172A] text-white text-[10px] font-medium rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {d.city}
                            </div>
                        </motion.div>
                    </Marker>
                ))}

                {/* Discovery Pins (Nearby Ideas) */}
                {layers.discovery && discoveredIdeas.map((ic, i) => (
                    <Marker key={ic.ideaId} longitude={ic.coords[0]} latitude={ic.coords[1]} anchor="bottom">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5 + (i * 0.05) }}
                            onClick={() => setSelectedPoint({ type: 'idea', ...ic })}
                            className="cursor-pointer group flex flex-col items-center pb-2"
                        >
                            <div className="w-9 h-9 rounded-[var(--radius-md)] border border-border bg-bg-card flex items-center justify-center text-text-primary transition-colors">
                                <span className="text-[12px]">{ic.idea.emoji || '✨'}</span>
                            </div>
                        </motion.div>
                    </Marker>
                ))}
            </Map>

            {/* Layer Controls */}
            <LayerToggle layers={layers} onToggle={(k) => setLayers(prev => ({ ...prev, [k]: !prev[k] }))} />

            {/* Detail Drawer */}
            <LocationDrawer
                isOpen={!!selectedPoint}
                onClose={() => setSelectedPoint(null)}
                data={selectedPoint}
            />
        </div>
    );
}

function LayerToggle({ layers, onToggle }) {
    return (
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            <div className="bg-bg-card/80 backdrop-blur-md border border-border p-1.5 rounded-2xl flex flex-col gap-1">
                <ToggleButton
                    active={layers.itinerary}
                    onClick={() => onToggle('itinerary')}
                    icon={<MapPin size={14} />}
                    label="Itinerary"
                />
                <ToggleButton
                    active={layers.discovery}
                    onClick={() => onToggle('discovery')}
                    icon={<Sparkles size={14} />}
                    label="Discovery"
                />
                <div className="h-px bg-border mx-2 my-0.5" />
                <ToggleButton
                    active={layers.animatedPath}
                    onClick={() => onToggle('animatedPath')}
                    icon={<Layers size={14} />}
                    label="Live Path"
                />
            </div>
        </div>
    );
}

function ToggleButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`
        flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all
        ${active
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:bg-bg-hover'}
      `}
        >
            {icon}
            <span className="md:inline hidden">{label}</span>
        </button>
    );
}
