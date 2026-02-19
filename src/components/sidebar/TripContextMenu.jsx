import { useState, useEffect, useRef } from 'react'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import ConfirmDialog from '../shared/ConfirmDialog'

export default function TripContextMenu({ tripId, tripName, onClose }) {
  const { dispatch, showToast } = useTripContext()
  const menuRef = useRef(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Close on click outside — but not while the confirm dialog is open
  // (the confirm backdrop is outside menuRef and would prematurely unmount everything)
  useEffect(() => {
    function handleClickOutside(e) {
      if (showDeleteConfirm) return          // let ConfirmDialog handle its own clicks
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }

    function handleEscape(e) {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false)        // close dialog, keep menu
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, showDeleteConfirm])

  const handleRename = (e) => {
    e.stopPropagation()
    const newName = window.prompt('Rename trip:', tripName)
    if (newName && newName.trim() && newName.trim() !== tripName) {
      dispatch({
        type: ACTIONS.RENAME_TRIP,
        payload: { id: tripId, name: newName.trim() },
      })
      showToast('Trip renamed')
    }
    onClose()
  }

  const handleDuplicate = (e) => {
    e.stopPropagation()
    dispatch({ type: ACTIONS.DUPLICATE_TRIP, payload: tripId })
    showToast('Trip duplicated')
    onClose()
  }

  const handleDeleteClick = (e) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = () => {
    dispatch({ type: ACTIONS.DELETE_TRIP, payload: tripId })
    showToast('Trip deleted', 'info')
    setShowDeleteConfirm(false)
    onClose()
  }

  const menuItems = [
    {
      label: 'Rename',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: handleRename,
    },
    {
      label: 'Duplicate',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
      onClick: handleDuplicate,
    },
    {
      label: 'Delete',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      ),
      onClick: handleDeleteClick,
      danger: true,
    },
  ]

  return (
    <>
      <div
        ref={menuRef}
        className="absolute right-2 top-8 z-50 w-40
                   bg-bg-input border border-border rounded-[var(--radius-md)]
                   animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left
                        transition-colors duration-100
                        ${item.danger
                          ? 'text-danger hover:bg-danger/10'
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }`}
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete trip?"
        message={`Are you sure you want to delete "${tripName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger={true}
      />
    </>
  )
}
