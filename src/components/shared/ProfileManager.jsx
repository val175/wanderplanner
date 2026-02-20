import { useState, useRef } from 'react'
import { useProfiles } from '../../context/ProfileContext'
import Modal from './Modal'
import AvatarCircle from './AvatarCircle'

function resizeImage(file, maxSize = 200) {
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

function ProfileRow({ profile, onDelete }) {
  const { updateProfile } = useProfiles()
  const fileRef = useRef()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const photo = await resizeImage(file)
    updateProfile(profile.id, { photo })
  }

  const handleSaveName = () => {
    if (name.trim()) updateProfile(profile.id, { name: name.trim() })
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-1 group">
      {/* Avatar — click to change photo */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative shrink-0 hover:opacity-80 transition-opacity"
        title="Change photo"
      >
        <AvatarCircle profile={profile} size={40} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full
                         bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-medium">
          edit
        </span>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
      </button>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setName(profile.name); setEditing(false) } }}
            className="w-full px-2 py-1 text-sm bg-bg-input border border-accent/40 rounded-[var(--radius-sm)] text-text-primary outline-none focus:ring-1 focus:ring-accent/20"
          />
        ) : (
          <span
            className="text-sm text-text-primary cursor-pointer hover:text-accent transition-colors"
            onClick={() => setEditing(true)}
          >
            {profile.name}
          </span>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(profile.id)}
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all p-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  )
}

function AddProfileForm({ onDone }) {
  const { addProfile } = useProfiles()
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState(null)
  const fileRef = useRef()

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const resized = await resizeImage(file)
    setPhoto(resized)
  }

  const handleAdd = () => {
    if (!name.trim()) return
    addProfile({ name, photo })
    onDone()
  }

  const previewProfile = { name, photo }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-3">Add traveler</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 w-10 h-10 rounded-full border-2 border-dashed border-border hover:border-accent/50 flex items-center justify-center text-text-muted hover:text-accent transition-colors overflow-hidden"
          title="Upload photo"
        >
          {photo
            ? <img src={photo} alt="" className="w-full h-full object-cover" />
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
          }
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </button>

        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Traveler name"
          className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
        />

        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="px-3 py-2 text-sm bg-accent text-white rounded-[var(--radius-md)] hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export default function ProfileManager({ isOpen, onClose }) {
  const { profiles, deleteProfile } = useProfiles()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-sm">
      <div className="px-6 pt-6 pb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-lg font-bold text-text-primary">Travelers</h2>
          <button onClick={onClose} className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {profiles.length === 0 && !showAdd ? (
          <p className="text-sm text-text-muted text-center py-6">No traveler profiles yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {profiles.map(p => (
              <ProfileRow key={p.id} profile={p} onDelete={deleteProfile} />
            ))}
          </div>
        )}

        {showAdd
          ? <AddProfileForm onDone={() => setShowAdd(false)} />
          : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border-strong rounded-[var(--radius-md)] text-sm text-text-muted font-medium hover:text-accent hover:border-accent/40 hover:bg-accent-muted/20 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Traveler
            </button>
          )
        }
      </div>
    </Modal>
  )
}
