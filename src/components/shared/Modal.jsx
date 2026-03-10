import * as Dialog from '@radix-ui/react-dialog'

export default function Modal({ isOpen, onClose, children, className = '', maxWidth = 'max-w-xl', title }) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-[9998] bg-text-primary/30 backdrop-blur-sm animate-fade-in" />

        {/* Panel — slides up from bottom on mobile, scales in centered on desktop */}
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={onClose}
          onPointerDownOutside={onClose}
          className={`
            fixed z-[9999] w-full ${maxWidth}
            bg-bg-primary border border-border
            rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)]
            max-h-[95vh] md:max-h-[90vh] overflow-y-auto
            animate-slide-up md:animate-scale-in
            pb-[env(safe-area-inset-bottom)] md:pb-0
            bottom-0 left-1/2 -translate-x-1/2
            md:top-1/2 md:bottom-auto md:-translate-y-1/2
            focus:outline-none
            ${className}
          `}
        >
          {/* Mobile drag indicator pill */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-12 h-1.5 bg-border rounded-full opacity-60" />
          </div>

          {/* Optional title header */}
          {title && (
            <div className="flex items-center justify-between px-6 pt-5 pb-1">
              <Dialog.Title className="font-heading font-semibold text-lg text-text-primary">
                {title}
              </Dialog.Title>
              <Dialog.Close
                onClick={onClose}
                className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>
          )}

          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
