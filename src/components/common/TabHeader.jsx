import React, { useState, useEffect, useRef } from 'react'

export default function TabHeader({ leftSlot, rightSlot }) {
  const [isScrolled, setIsScrolled] = useState(false)
  const headerRef = useRef(null)

  useEffect(() => {
    const mainContainer = headerRef.current?.closest('[role="tabpanel"]')
    if (!mainContainer) return

    const handleScroll = () => {
      setIsScrolled(mainContainer.scrollTop > 10)
    }

    handleScroll()
    mainContainer.addEventListener('scroll', handleScroll)
    return () => mainContainer.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div ref={headerRef} className={`
      flex flex-col gap-2
      md:flex-row md:items-center md:justify-between
      md:sticky md:top-[-20px] lg:top-[-28px] md:z-10 md:-mx-8 md:px-8 md:py-3 md:mb-5
      md:border-b md:transition-colors md:duration-300
      ${isScrolled
        ? 'md:bg-bg-primary/95 md:backdrop-blur-sm md:border-border'
        : 'md:bg-transparent md:border-transparent pb-3 mb-4'
      }
    `}>
      <div className="flex items-center gap-3 shrink-0">
        {leftSlot}
      </div>
      {rightSlot && (
        <div className="flex items-center gap-2 flex-wrap min-w-0 md:flex-nowrap md:justify-end gap-y-1.5">
          {rightSlot}
        </div>
      )}
    </div>
  )
}
