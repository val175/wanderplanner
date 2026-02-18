import Modal from './Modal'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6">
        <h3 className="font-heading text-xl text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary
                       bg-bg-secondary border border-border rounded-[var(--radius-md)]
                       hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={`px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-colors
              ${danger
                ? 'bg-danger text-white hover:bg-danger/90'
                : 'bg-accent text-white hover:bg-accent-hover'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
