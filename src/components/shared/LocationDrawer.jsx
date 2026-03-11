import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, MapPin, Sparkles, Navigation2 } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * LocationDrawer
 * A responsive detail panel for the WanderMap.
 * Mobile: Bottom sheet | Desktop: Side drawer
 */
export default function LocationDrawer({ isOpen, onClose, data }) {
    const isMobile = useMediaQuery('(max-width: 767px)');

    if (!isOpen || !data) return null;

    return (
        <div className="bg-bg-card border border-border rounded-[var(--radius-lg)] overflow-hidden w-[260px] animate-scale-in">
            <div className="p-4 flex flex-col gap-3">
                {/* Close button (top right) */}
                <div className="absolute top-2 right-2 z-10">
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full bg-bg-secondary/80 backdrop-blur-md text-text-muted hover:text-text-primary transition-colors"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* Main Info */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">
                            {type === 'dest' ? '🏙️' : (type === 'activity' ? (data.activity?.emoji || '📅') : '✨')}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            type === 'dest' ? 'text-accent' :
                            type === 'activity' ? 'text-success' : 'text-indigo-500'
                        }`}>
                            {subtitle}
                        </span>
                    </div>
                    <h2 className="text-sm font-bold text-text-primary leading-tight">
                        {title}
                    </h2>
                    
                    {/* Time & Location Details */}
                    <div className="flex flex-col gap-1 mt-2">
                        {type === 'activity' && data.activity?.time && (
                            <div className="flex items-center gap-1.5 text-text-secondary text-[10px] font-bold uppercase">
                                <span className="text-accent">🕒</span>
                                {data.activity.time}
                            </div>
                        )}
                        {(locationObj?.placeName || data.idea?.location) && (
                            <div className="flex items-center gap-1.5 text-text-muted text-[11px] font-medium leading-tight">
                                <MapPin size={10} className="shrink-0" />
                                <span>{locationObj?.placeName || data.idea?.location}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Description / Notes */}
                {(type === 'activity' ? data.activity?.notes : data.idea?.description) && (
                    <p className="text-[11px] text-text-secondary leading-normal italic border-t border-border/10 pt-2">
                        "{(type === 'activity' ? data.activity?.notes : data.idea?.description)}"
                    </p>
                )}

                {/* Action Area */}
                <div className="flex flex-col gap-1.5 pt-1">
                    {locationObj?.mapUrl && (
                        <a
                            href={locationObj.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full h-8 rounded-[var(--radius-md)] bg-accent text-white font-bold text-[10px] hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            <ExternalLink size={12} strokeWidth={2.5} />
                            Google Maps
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
