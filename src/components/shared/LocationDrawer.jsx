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

    const type = data.type; // 'dest', 'idea', or 'activity'
    const title = type === 'dest' ? data.city : (type === 'activity' ? data.activity?.name : data.idea?.title);
    const subtitle = type === 'dest' ? 'Confirmed Route Stop' : (type === 'activity' ? 'Itinerary Activity' : 'Suggested Activity');
    const locationObj = type === 'activity' ? data.activity?.location : null;
    const photoUrl = (type === 'activity' && locationObj?.photoUrl) ? locationObj.photoUrl : null;

    return (
        <AnimatePresence>
            <div className="absolute inset-0 z-[1000] pointer-events-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className={`
                        pointer-events-auto absolute bg-bg-card border border-border shadow-2xl overflow-hidden
                        ${isMobile
                            ? 'bottom-4 left-4 right-4 rounded-[var(--radius-lg)]'
                            : 'top-20 right-4 w-[280px] rounded-[var(--radius-lg)]'
                        }
                    `}
                >
                    {/* Header Image/Icon */}
                    {photoUrl ? (
                        <div className="relative h-48 w-full overflow-hidden border-b border-border bg-bg-secondary">
                            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                            <button
                                onClick={onClose}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-bg-card/80 backdrop-blur-md text-text-primary hover:bg-bg-card transition-colors border border-border shadow-sm"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 flex items-start justify-between border-b border-border bg-bg-secondary">
                            <div className="w-12 h-12 rounded-[var(--radius-md)] bg-bg-card border border-border flex items-center justify-center text-2xl shadow-sm">
                                {type === 'dest' ? '🏙️' : (type === 'activity' ? (data.activity?.emoji || '📅') : (data.idea?.emoji || '✨'))}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-full hover:bg-bg-hover text-text-muted transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    <div className="p-5 flex flex-col gap-4">
                        {/* Main Info */}
                        <div className="space-y-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${type === 'dest' ? 'text-accent' :
                                type === 'activity' ? 'text-success' : 'text-indigo-500'
                                }`}>
                                {subtitle}
                            </span>
                            <h2 className="text-lg font-bold text-text-primary leading-tight">
                                {title}
                            </h2>
                            {(locationObj?.placeName || data.idea?.location) && (
                                <div className="flex items-center gap-1.5 text-text-muted text-xs font-medium">
                                    <MapPin size={12} />
                                    <span className="truncate">{locationObj?.placeName || data.idea?.location}</span>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 italic">
                            "{(type === 'activity' ? data.activity?.notes : data.idea?.description) || 'No details provided yet.'}"
                        </p>

                        {/* Action Area */}
                        <div className="flex flex-col gap-2">
                            {locationObj?.mapUrl && (
                                <a
                                    href={locationObj.mapUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full h-10 rounded-[var(--radius-md)] bg-accent text-white font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={14} />
                                    Google Maps
                                </a>
                            )}
                            <button
                                onClick={onClose}
                                className="w-full h-10 rounded-[var(--radius-md)] bg-bg-secondary text-text-primary border border-border font-bold text-xs hover:bg-bg-hover transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
