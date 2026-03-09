import * as AlertDialog from '@radix-ui/react-alert-dialog'
import Button from './Button'

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
        <AlertDialog.Overlay className="fixed inset-0 z-[9998] bg-text-primary/30 backdrop-blur-sm animate-fade-in" />
        <AlertDialog.Content
          className="
            fixed z-[9999] w-full max-w-sm
            bg-bg-primary border border-border rounded-[var(--radius-xl)]
            animate-scale-in p-6
            top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            focus:outline-none
          "
        >
          <AlertDialog.Title className="font-heading font-semibold text-xl text-text-primary mb-2">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-text-secondary text-sm mb-6">
            {message}
          </AlertDialog.Description>
          <div className="flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={danger ? 'danger' : 'primary'}
                size="md"
                onClick={() => { onConfirm(); onClose() }}
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
