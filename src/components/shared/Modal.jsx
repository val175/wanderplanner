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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 w-screen h-screen bg-text-primary/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Modal content */}
      <div className={`
        relative z-10 w-full ${maxWidth}
        bg-bg-primary border border-border rounded-[var(--radius-xl)]
        max-h-[90vh] overflow-y-auto
        animate-scale-in
        ${className}
      `}>
        {children}
      </div>
    </div>,
    document.body
  )
}
