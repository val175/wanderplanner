import { useState, useRef } from 'react'
import { useProfiles } from '../../context/ProfileContext'
import Modal from './Modal'
import AvatarCircle from './AvatarCircle'
import { getLevelForXp } from '../../constants/xpLevels'

function resizeImage(file, maxSize = 300) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/* ── Leaderboard Row (Handles both Current User and Shared Travelers) ── */
function LeaderboardRow({ profile, rank, isMe, onDelete }) {
  const { updateCurrentUserProfile, updateProfile } = useProfiles()
  const fileRef = useRef()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name || '')
  
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const photo = await resizeImage(file)
    if (isMe) {
      await updateCurrentUserProfile({ customPhoto: photo })
    } else {
      updateProfile(profile.id, { photo })
    }
  }

  const handleSaveName = () => {
    if (name.trim()) {
      if (isMe) updateCurrentUserProfile({ name: name.trim() })
      else updateProfile(profile.id, { name: name.trim() })
    }
    setEditing(false)
  }

  const levelInfo = getLevelForXp(profile.xp || 0)

  return (
    <div className={`flex items-center gap-3 py-3 px-2 rounded-[var(--radius-lg)] group transition-colors ${isMe ? 'bg-bg-secondary border border-border/50' : 'hover:bg-bg-secondary/50'}`}>
      <div className="w-5 text-center shrink-0 text-xs font-bold text-text-muted opacity-60">
        {rank}
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative shrink-0 hover:opacity-80 transition-opacity"
        title="Change photo"
      >
        <AvatarCircle profile={profile} size={40} levelColor={levelInfo?.frameColor} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full
                         bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-medium leading-tight text-center">
          edit
        </span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveName()
                if (e.key === 'Escape') { setName(profile.name); setEditing(false) }
              }}
              className="w-full px-2 py-0.5 text-sm bg-bg-input border border-accent/40 rounded-[var(--radius-sm)] text-text-primary outline-none focus:ring-1 focus:ring-accent/20"
            />
          ) : (
            <span
              className={`text-sm font-semibold cursor-pointer hover:text-accent transition-colors truncate ${isMe ? 'text-text-primary' : 'text-text-primary'}`}
              onClick={() => setEditing(true)}
              title="Click to edit name"
            >
              {profile.name} {isMe && <span className="text-text-muted font-normal text-xs ml-1">(You)</span>}
            </span>
          )}
        </div>
        <p className="text-[10px] font-semibold text-text-muted mt-0.5 truncate uppercase tracking-wider">
          Lvl {levelInfo.level} • {levelInfo.emoji} {levelInfo.title}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-bold text-accent px-2 bg-accent/10 rounded-full py-0.5 mr-1">
          {profile.xp || 0} XP
        </span>
        {!isMe && (
          <button
            type="button"
            onClick={() => onDelete?.(profile.id)}
            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger hover:bg-danger/10 p-1.5 rounded-md transition-all"
            title="Remove wanderer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Add Wanderer (Manual or by Email) ────────────────────────────────── */
function AddProfileForm({ onDone }) {
  const { addProfile, findProfileByEmail } = useProfiles()
  const [mode, setMode] = useState('manual') // 'manual' or 'email'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const resized = await resizeImage(file)
    setPhoto(resized)
  }

  const handleAddManual = () => {
    if (!name.trim()) return
    addProfile({ name, photo })
    onDone()
  }

  const handleLookupEmail = async () => {
    if (!email.trim() || !email.includes('@')) return
    setLoading(true)
    setError('')
    const found = await findProfileByEmail(email)
    setLoading(false)

    if (found) {
      addProfile(found)
      onDone()
    } else {
      setError("User not found. They must sign in to Wanderplan first!")
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setMode('manual'); setError('') }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-colors ${mode === 'manual' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-muted hover:text-text-secondary'}`}
        >
          Manual
        </button>
        <button
          onClick={() => { setMode('email'); setError('') }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-colors ${mode === 'email' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-muted hover:text-text-secondary'}`}
        >
          By Email
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="shrink-0 w-10 h-10 rounded-full border-2 border-dashed border-border hover:border-accent/50
                       flex items-center justify-center text-text-muted hover:text-accent transition-colors overflow-hidden"
          >
            {photo
              ? <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            }
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </button>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddManual() }}
            placeholder="Wanderer name"
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
          />
          <button
            onClick={handleAddManual}
            disabled={!name.trim()}
            className="px-3 py-2 text-sm bg-accent text-white rounded-[var(--radius-md)] hover:bg-accent-hover disabled:opacity-40"
          >
            Add
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLookupEmail() }}
              placeholder="user@example.com"
              className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
            />
            <button
              onClick={handleLookupEmail}
              disabled={loading || !email.includes('@')}
              className="px-3 py-2 text-sm bg-accent text-white rounded-[var(--radius-md)] hover:bg-accent-hover disabled:opacity-40"
            >
              {loading ? '...' : 'Invite'}
            </button>
          </div>
          {error && <p className="text-[10px] text-danger font-medium leading-tight">{error}</p>}
          <p className="text-[10px] text-text-muted italic leading-tight">
            Finding a user by email will add their real Wanderplan profile to your wanderer list.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Main Modal ──────────────────────────────────────────────────────── */
export default function ProfileManager({ isOpen, onClose }) {
  const { profiles, currentUserProfile, deleteProfile } = useProfiles()
  const [showAdd, setShowAdd] = useState(false)

  // Combine and sort all wanderers by XP descending
  const allUsers = [currentUserProfile, ...profiles].filter(Boolean)
  const sortedUsers = [...allUsers].sort((a, b) => (b.xp || 0) - (a.xp || 0))

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="px-6 pt-6 pb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-xl font-semibold text-text-primary flex items-center gap-2">
            <span>🏆</span> Leaderboard & Wanderers
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1 mb-2">
          {sortedUsers.map((user, index) => {
            const isMe = user.id === currentUserProfile?.id || user.uid === currentUserProfile?.uid || user.email === currentUserProfile?.email
            return (
              <LeaderboardRow
                key={user.uid || user.id || index}
                profile={user}
                rank={index + 1}
                isMe={isMe}
                onDelete={deleteProfile}
              />
            )
          })}
        </div>

        {showAdd
          ? <AddProfileForm onDone={() => setShowAdd(false)} />
          : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed
                         border-border-strong rounded-[var(--radius-md)] text-sm text-text-muted font-medium
                         hover:text-accent hover:border-accent/40 hover:bg-accent-muted/20 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Wanderer
            </button>
          )
        }
      </div>
    </Modal>
  )
}
