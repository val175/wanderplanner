import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { getEffectiveStatus } from '../../utils/tripStatus'
import ConfirmDialog from '../shared/ConfirmDialog'
import ShareTripModal from '../modal/ShareTripModal'
import SettleUpModal from '../modal/SettleUpModal'

const itemCls = `
  flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer
  select-none outline-none rounded-[var(--radius-sm)]
  text-text-secondary
  data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary
  transition-colors duration-100
`
const dangerItemCls = `
  flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer
  select-none outline-none rounded-[var(--radius-sm)]
  text-danger data-[highlighted]:bg-danger/10
  transition-colors duration-100
`

export default function TripContextMenu({ tripId, tripName, children }) {
  const { dispatch, showToast, state } = useTripContext()
  const { currentUserProfile } = useProfiles()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showSettleUpModal, setShowSettleUpModal] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameValue, setRenameValue] = useState(tripName)

  const trip = state?.trips?.[tripId]
  const effectiveStatus = getEffectiveStatus(trip)
  const isReadOnly = effectiveStatus === 'completed' || effectiveStatus === 'archived'

  const handleRenameConfirm = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== tripName) {
      dispatch({ type: ACTIONS.RENAME_TRIP, payload: { id: tripId, name: trimmed } })
      showToast('Trip renamed')
    }
    setShowRenameDialog(false)
  }

  const handleDeleteConfirm = async () => {
    try {
      await deleteDoc(doc(db, 'trips', tripId))
      dispatch({ type: ACTIONS.DELETE_TRIP, payload: tripId })
      showToast('Trip deleted', 'info')
    } catch (err) {
      console.error('Failed to delete trip:', err)
      showToast('Failed to delete trip', 'error')
    }
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          {children ?? (
            <button
              className="p-1 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label="Trip options"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          )}
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-[9999] w-44 bg-bg-input border border-border rounded-[var(--radius-md)] py-1 animate-scale-in focus:outline-none"
          >
            <DropdownMenu.Item className={itemCls} onSelect={() => setShowShareModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
              Share trip
            </DropdownMenu.Item>

            {!isReadOnly && (
              <>
                <DropdownMenu.Item className={itemCls} onSelect={() => { setRenameValue(tripName); setShowRenameDialog(true) }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Rename
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={itemCls}
                  onSelect={() => { dispatch({ type: ACTIONS.DUPLICATE_TRIP, payload: tripId }); showToast('Trip duplicated') }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Duplicate
                </DropdownMenu.Item>
              </>
            )}

            {isReadOnly && (
              <>
                <DropdownMenu.Item
                  className={itemCls}
                  onSelect={() => { dispatch({ type: ACTIONS.DUPLICATE_AS_TEMPLATE, payload: { tripId, profileId: currentUserProfile?.id, uid: currentUserProfile?.uid } }); showToast('✈️ Template created — dates & expenses stripped') }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Use as Template
                </DropdownMenu.Item>
                {effectiveStatus !== 'archived' && (
                  <DropdownMenu.Item className={itemCls} onSelect={() => setShowSettleUpModal(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>
                    Archive Trip
                  </DropdownMenu.Item>
                )}
                {effectiveStatus === 'archived' && (
                  <DropdownMenu.Item
                    className={itemCls}
                    onSelect={() => { dispatch({ type: ACTIONS.UNARCHIVE_TRIP, payload: tripId }); showToast('Trip restored') }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" /></svg>
                    Restore Trip
                  </DropdownMenu.Item>
                )}
              </>
            )}

            <DropdownMenu.Separator className="my-1 h-px bg-border mx-2" />

            <DropdownMenu.Item className={dangerItemCls} onSelect={() => setShowDeleteConfirm(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Inline rename dialog — replaces window.prompt */}
      <Dialog.Root open={showRenameDialog} onOpenChange={open => !open && setShowRenameDialog(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[9998] bg-text-primary/30 backdrop-blur-sm animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed z-[9999] w-full max-w-sm bg-bg-primary border border-border rounded-[var(--radius-xl)] p-6 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-scale-in focus:outline-none"
          >
            <Dialog.Title className="font-heading font-semibold text-xl text-text-primary mb-4">
              Rename trip
            </Dialog.Title>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRenameConfirm()}
              className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:border-accent focus:outline-none transition-colors mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRenameDialog(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameConfirm}
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-[var(--radius-md)] hover:bg-accent-hover transition-colors"
              >
                Rename
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete trip?"
        message={`Are you sure you want to delete "${tripName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      {showShareModal && trip && (
        <ShareTripModal trip={trip} onClose={() => setShowShareModal(false)} />
      )}
      {showSettleUpModal && (
        <SettleUpModal tripId={tripId} onClose={() => setShowSettleUpModal(false)} />
      )}
    </>
  )
}
