import * as AlertDialog from '@radix-ui/react-alert-dialog'
import Button from './Button'
import {
  dialogContentClass,
  dialogOverlayClass,
} from './surfaceStyles'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
}) {
  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogOverlayClass} />
        <AlertDialog.Content
          className={`
            ${dialogContentClass}
            max-w-sm animate-scale-in p-6
            top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          `}
        >
          <AlertDialog.Title className="font-heading font-semibold text-xl text-text-primary mb-2 text-balance">
            {title}
          </AlertDialog.Title>

          <AlertDialog.Description className="text-text-secondary text-sm mb-6 text-balance">
            {message}
          </AlertDialog.Description>

          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" size="md" onClick={onClose}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={danger ? 'danger' : 'primary'}
                size="md"
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
