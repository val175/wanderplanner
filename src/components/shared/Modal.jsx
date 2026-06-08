import * as Dialog from '@radix-ui/react-dialog'
import {
  dialogCloseClass,
  dialogContentClass,
  dialogOverlayClass,
} from './surfaceStyles'

export default function Modal({
  isOpen,
  onClose,
  children,
  className = '',
  maxWidth = 'max-w-xl',
  title,
  description,
  closeOnOutsideClick = true,
}) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={dialogOverlayClass} />

        <Dialog.Content
          aria-describedby={description ? undefined : null}
          onEscapeKeyDown={onClose}
          onPointerDownOutside={e => {
            if (!closeOnOutsideClick) {
              e.preventDefault()
            }
          }}
          className={`
            ${dialogContentClass}
            ${maxWidth}
            rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)]
            animate-slide-up md:animate-scale-in
            pb-[env(safe-area-inset-bottom)] md:pb-0
            bottom-0 left-1/2 -translate-x-1/2
            md:top-1/2 md:bottom-auto md:-translate-y-1/2
            focus:outline-none
            ${className}
          `}
        >
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-12 h-1.5 bg-border rounded-full opacity-60" />
          </div>

          {!title && (
            <Dialog.Title className="sr-only">Dialog</Dialog.Title>
          )}

          {title && (
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
              <Dialog.Title className="font-heading font-semibold text-lg text-text-primary text-balance">
                {title}
              </Dialog.Title>

              <Dialog.Close
                onClick={onClose}
                className={dialogCloseClass}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>
          )}

          {description && (
            <Dialog.Description className="px-6 pb-1 text-sm text-text-secondary text-balance">
              {description}
            </Dialog.Description>
          )}

          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
