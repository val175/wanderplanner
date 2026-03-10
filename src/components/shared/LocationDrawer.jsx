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

    const type = data.type; // 'dest' or 'idea'
    const title = type === 'dest' ? data.city : data.idea?.title;
    const subtitle = type === 'dest' ? 'Confirmed Route Stop' : 'Suggested Activity';

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[1000] pointer-events-none overflow-hidden">
                {/* Backdrop only on mobile for focus */}
                {isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] pointer-events-auto"
                    />
                )}

                <motion.div
                    initial={isMobile ? { y: '100%' } : { x: '100%' }}
                    animate={isMobile ? { y: 0 } : { x: 0 }}
                    exit={isMobile ? { y: '100%' } : { x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={`
            pointer-events-auto absolute bg-bg-card border-border shadow-2xl overflow-hidden
            ${isMobile
                            ? 'bottom-0 left-0 right-0 rounded-t-[var(--radius-xl)] border-t max-h-[70vh]'
                            : 'top-4 right-4 bottom-4 w-96 rounded-[var(--radius-xl)] border'}
          `}
                >
                    {/* Header/Banner Area */}
                    <div className="relative h-32 bg-gradient-to-br from-indigo-500/10 to-accent/20 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                        <div className="text-4xl">
                            {type === 'dest' ? '🏙️' : (data.idea?.emoji || '✨')}
                        </div>
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 backdrop-blur-md text-text-primary hover:bg-white/40 transition-colors shadow-sm"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100%-8rem)]">
                        {/* Main Info */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${type === 'dest' ? 'bg-accent/10 text-accent' : 'bg-indigo-500/10 text-indigo-500'
                                    }`}>
                                    {subtitle}
                                </span>
                            </div>
                            <h2 className="text-2xl font-black text-text-primary tracking-tight leading-tight">
                                {title}
                            </h2>
                            {type === 'idea' && data.idea?.location && (
                                <div className="flex items-center gap-1.5 text-text-muted text-xs font-medium">
                                    <MapPin size={12} />
                                    {data.idea.location}
                                </div>
                            )}
                        </div>

                        {/* Content Body */}
                        <div className="space-y-4">
                            {type === 'idea' && (
                                <div className="space-y-2">
                                    <p className="text-sm text-text-secondary leading-relaxed font-medium capitalize-first italic">
                                        "{data.idea?.description || 'No description provided for this idea yet.'}"
                                    </p>
                                </div>
                            )}

                            {type === 'dest' && (
                                <div className="bg-bg-secondary p-4 rounded-[var(--radius-lg)] border border-border/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Route Details</span>
                                        <Navigation2 size={14} className="text-accent" />
                                    </div>
                                    <p className="text-[13px] text-text-secondary leading-relaxed font-medium">
                                        This city is a key stop on your journey. Use the voting room to add highlights or lodging near this area.
                                    </p>
                                </div>
                            )}

                            {/* Action Area */}
                            <div className="pt-4 flex flex-col gap-3">
                                <button
                                    onClick={onClose}
                                    className="w-full h-12 rounded-[var(--radius-md)] bg-text-primary text-bg-primary font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                >
                                    <MapPin size={16} />
                                    Keep exploring
                                </button>
                                {type === 'idea' && (
                                    <div className="flex items-center justify-center gap-4 py-2 opacity-60">
                                        <span className="h-px flex-1 bg-border" />
                                        <span className="text-[10px] font-black tracking-widest uppercase">Community Idea</span>
                                        <span className="h-px flex-1 bg-border" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
