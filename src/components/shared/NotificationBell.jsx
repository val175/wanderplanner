import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { useProfiles } from '../../context/ProfileContext'
import AvatarCircle from './AvatarCircle'

function formatRelTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationBell({ myUid, className = '' }) {
  const { notifications, unreadCount, markRead, readTimestamp } = useNotifications(myUid)
  const { resolveProfile } = useProfiles()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, left: Math.max(r.right - 320, 8) })
    }
    const opening = !open
    setOpen(o => !o)
    if (opening) markRead()
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`relative flex items-center justify-center min-w-[44px] min-h-[44px] rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors ${className}`}
        aria-label={unreadCount > 0 ? `${unreadCount} unread mentions` : 'Notifications'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold leading-none pointer-events-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          className="z-[9999] w-80 bg-bg-card border border-border rounded-[var(--radius-lg)] shadow-xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-semibold text-text-primary">Mentions</h3>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-muted">No mentions yet.</p>
              <p className="text-xs text-text-muted/60 mt-1">Type @ in a comment to tag a wanderer.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-80 divide-y divide-border/40">
              {notifications.map(n => {
                const author = resolveProfile(n.authorId)
                const isUnread = !readTimestamp || new Date(n.timestamp) > new Date(readTimestamp)
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 ${isUnread ? 'bg-accent/5' : ''}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <AvatarCircle profile={author} size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap leading-tight">
                        <span className="text-xs font-semibold text-text-primary">{author?.name || 'Someone'}</span>
                        <span className="text-xs text-text-muted">tagged you in</span>
                        <span className="text-xs font-medium text-text-secondary">{n.itemEmoji} {n.itemName}</span>
                      </div>
                      <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">{n.text}</p>
                      <span className="text-[10px] text-text-muted/50 mt-0.5 block">{formatRelTime(n.timestamp)}</span>
                    </div>
                    {isUnread && (
                      <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
