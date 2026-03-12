import React from 'react'

export default function TabHeader({ leftSlot, rightSlot }) {
  return (
    <div className="flex items-center justify-between pb-3 mb-4 gap-2">
      <div className="flex items-center gap-3 shrink-0">
        {leftSlot}
      </div>
      {rightSlot && (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {rightSlot}
        </div>
      )}
    </div>
  )
}
