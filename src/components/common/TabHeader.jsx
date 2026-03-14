import React, { useState, useEffect } from 'react'

export default function TabHeader({ leftSlot, rightSlot }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const mainContainer = document.querySelector('main div[role="tabpanel"]')
    if (!mainContainer) return

    const handleScroll = () => {
      setIsScrolled(mainContainer.scrollTop > 10)
    }

    mainContainer.addEventListener('scroll', handleScroll)
    return () => mainContainer.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={`
      flex items-center justify-between gap-2 transition-all duration-200
      md:sticky md:top-[-20px] lg:top-[-28px] md:z-10 md:-mx-8 md:px-8 md:py-3 md:mb-5
      ${isScrolled 
        ? 'md:bg-bg-primary/95 md:backdrop-blur-sm md:border-b md:border-border' 
        : 'md:bg-transparent pb-3 mb-4'
      }
    `}>
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
