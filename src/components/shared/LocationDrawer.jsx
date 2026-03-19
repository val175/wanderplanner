import React from 'react';
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

    const { type } = data;
    const title = type === 'dest' ? data.city : (type === 'activity' ? data.activity?.name : data.idea?.title);
    const subtitle = type === 'dest' ? data.country : (type === 'activity' ? 'Activity' : 'Community Idea');
    const locationObj = type === 'dest' ? data.coords : (type === 'activity' ? data.activity?.location : data.idea?.location);
    const locationLabel = typeof locationObj === 'string' ? locationObj : (locationObj?.placeName || data.idea?.location || '')
    const rating = typeof locationObj === 'object' ? locationObj?.rating : null
    const reviewCount = typeof locationObj === 'object' ? locationObj?.reviewCount : null
    const openingHours = typeof locationObj === 'object' ? locationObj?.openingHours : null
    const isOpenNow = typeof locationObj === 'object' ? locationObj?.isOpenNow : null
    const website = typeof locationObj === 'object' ? locationObj?.website : ''
    const phone = typeof locationObj === 'object' ? locationObj?.phone : ''
    const sourceLinks = typeof locationObj === 'object' ? (locationObj?.sourceLinks || []) : []

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
                        {locationLabel && (
                            <div className="flex items-center gap-1.5 text-text-muted text-[11px] font-medium leading-tight">
                                <MapPin size={10} className="shrink-0" />
                                <span>{locationLabel}</span>
                            </div>
                        )}
                        {rating != null && (
                            <div className="flex items-center gap-1.5 text-text-muted text-[11px] font-medium leading-tight">
                                <span>⭐ {rating}</span>
                                {reviewCount != null && <span>({reviewCount.toLocaleString()})</span>}
                            </div>
                        )}
                        {isOpenNow != null && (
                            <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${isOpenNow ? 'text-success' : 'text-danger'}`}>
                                <span>{isOpenNow ? 'Open now' : 'Closed now'}</span>
                            </div>
                        )}
                        {openingHours && (
                            <div className="text-[11px] text-text-muted leading-tight">
                                {openingHours}
                            </div>
                        )}
                        {phone && (
                            <div className="text-[11px] text-text-muted leading-tight">
                                {phone}
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
                    {website && (
                        <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full h-8 rounded-[var(--radius-md)] bg-bg-secondary text-text-primary font-bold text-[10px] hover:bg-bg-hover transition-colors flex items-center justify-center gap-1.5 border border-border/50"
                        >
                            <ExternalLink size={12} strokeWidth={2.5} />
                            Website
                        </a>
                    )}
                    {locationObj?.mapUrl && (
                        <a
                            href={locationObj.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full h-8 rounded-[var(--radius-md)] bg-accent text-white font-bold text-[10px] hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                        >
                            <ExternalLink size={12} strokeWidth={2.5} />
                            Google Maps
                        </a>
                    )}
                    {sourceLinks.length > 0 && (
                        <div className="pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Sources</p>
                            <div className="flex flex-col gap-1">
                                {sourceLinks.slice(0, 2).map((link) => (
                                    <a
                                        key={link}
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-accent truncate hover:underline"
                                    >
                                        {link}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
