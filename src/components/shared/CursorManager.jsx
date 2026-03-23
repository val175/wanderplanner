import React from 'react'
import { usePresence } from '../../hooks/usePresence'
import { useProfiles } from '../../context/ProfileContext'

export default function CursorManager({ tripId, userId, tabId }) {
  const others = usePresence(tripId, userId, tabId)
  const { profiles } = useProfiles()
  
  // Predictable unique color generator based on User ID
  const getCursorColor = (id) => {
    const colors = ['#E45353', '#5356E4', '#15B079', '#ED9A1E', '#9E24E6', '#22C1CA']
    let hash = 0
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  if (!tripId || !userId) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {Object.entries(others).map(([id, presence]) => {
        const isSameTab = presence.tabId === tabId
        
        // Find profile for name
        const profile = profiles.find(p => p.id === id || p.uid === id)
        const name = profile?.name ? profile.name.split(' ')[0] : 'Traveler'
        const color = getCursorColor(id)

        // Don't render if it's placed offscreen initially
        if (presence.x < 0 && presence.y < 0) return null

        return (
          <div
            key={id}
            className={`absolute top-0 left-0 transition-transform duration-[50ms] ease-linear ${isSameTab ? 'opacity-100' : 'opacity-40'}`}
            style={{
              transform: `translate(${presence.x}px, ${presence.y}px)`,
            }}
          >
            {/* Custom SVG Mouse Pointer */}
            <svg
              width="24"
              height="36"
              viewBox="0 0 24 36"
              fill="none"
              stroke="white"
              strokeWidth="2"
              className="drop-shadow-md origin-top-left -ml-1 -mt-1"
              style={{ color }}
            >
              <path
                d="M5.65376 2.15376C4.40366 0.903654 2 1.78913 2 3.55744V29.4426C2 31.2109 4.40366 32.0963 5.65376 30.8462L11 25.5H19C20.6569 25.5 22 24.1569 22 22.5V18.5147C22 17.7191 21.6839 16.956 21.1213 16.3934L5.65376 2.15376Z"
                fill="currentColor"
              />
            </svg>
            
            {/* Name label */}
            <div 
              className="absolute left-6 top-6 px-2 py-0.5 rounded-full text-[11px] font-medium text-white shadow-sm whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {name} {isSameTab ? '' : <span className="opacity-75 relative -top-[1px] ml-1 text-[10px]">(on {presence.tabId})</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
