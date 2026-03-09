import * as Dialog from '@radix-ui/react-dialog'

export default function Modal({ isOpen, onClose, children, className = '', maxWidth = 'max-w-xl' }) {
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
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
