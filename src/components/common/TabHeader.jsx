import React from 'react'

/**
 * Universal Header for Trip Planner Tab Views
 * Accepts title, subtitle, and an optional rightSlot (node).
 */
export default function TabHeader({ title, subtitle, rightSlot }) {
    return (
        <div className="flex items-start justify-between mb-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    {title}
                </h1>
                {subtitle && (
                    <p className="mt-1 text-sm text-text-muted">
                        {subtitle}
                    </p>
                )}
            </div>
            {rightSlot && (
                <div className="flex items-center gap-3 shrink-0">
                    {rightSlot}
                </div>
            )}
        </div>
    )
}
