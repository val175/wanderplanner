// src/components/shared/LocationPill.jsx
import React from 'react'
import { MapPin, CheckCircle2, ChevronDown } from 'lucide-react'

/**
 * LocationPill
 * A compact, rich UI element for smart locations.
 */
export default function LocationPill({ location, onClick, isResolving, readOnly }) {
    if (isResolving) {
        return (
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-[var(--radius-pill)] border border-border/20 bg-bg-secondary animate-pulse">
                <div className="w-4 h-4 rounded-full bg-border" />
                <div className="h-3 w-20 bg-border rounded" />
            </div>
        )
    }

    if (!location || typeof location === 'string') {
        const text = typeof location === 'string' ? location : ''
        return (
            <button
                onClick={onClick}
                disabled={readOnly}
                className={`group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border/20 bg-bg-secondary text-text-muted hover:text-text-primary hover:border-border-strong transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
                <MapPin size={12} className="opacity-60" />
                <span>{text || 'Add location'}</span>
                {!readOnly && <ChevronDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
        )
    }

    const { placeName, photoUrl, verified } = location

    return (
        <button
            onClick={onClick}
            disabled={readOnly}
            className={`group inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold border border-border/20 bg-bg-card text-text-primary hover:border-accent/40 transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
        >
            {photoUrl ? (
                <img
                    src={photoUrl}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover border border-border/10 grayscale-[0.5] group-hover:grayscale-0 transition-all"
                />
            ) : (
                <MapPin size={12} className="text-accent" />
            )}

            <span className="truncate max-w-[120px]">{placeName}</span>

            {verified && (
                <CheckCircle2 size={10} className="text-info fill-info/10" />
            )}

            {!readOnly && (
                <ChevronDown size={10} className="opacity-40 group-hover:opacity-100 transition-opacity ml-0.5" />
            )}
        </button>
    )
}
