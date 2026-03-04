import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ isOpen, onClose, children, className = '', maxWidth = 'max-w-xl' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 w-screen h-screen bg-text-primary/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Modal content */}
      <div className={`
        relative z-10 w-full ${maxWidth}
        bg-bg-primary border border-border 
        rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)]
        max-h-[95vh] md:max-h-[90vh] overflow-y-auto
        animate-slide-up md:animate-scale-in pb-[env(safe-area-inset-bottom)] md:pb-0
        ${className}
      `}>
        {/* Mobile drag indicator pill */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-12 h-1.5 bg-border rounded-full opacity-60"></div>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
