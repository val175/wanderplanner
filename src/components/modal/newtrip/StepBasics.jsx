import { useState } from 'react'
import { useProfiles } from '../../../context/ProfileContext'
import DatePicker from '../../shared/DatePicker'
import AvatarCircle from '../../shared/AvatarCircle'
import { TRIP_EMOJIS } from '../../../constants/emojis'
import Input from '../../shared/Input'

export default function StepBasics({ form, setForm }) {
  const [customEmoji, setCustomEmoji] = useState('')
  const { profiles, currentUserProfile } = useProfiles()

  const handleCustomEmoji = (val) => {
    const match = val.match(/\p{Emoji}/u)
    if (match) {
      setForm(f => ({ ...f, emoji: match[0] }))
      setCustomEmoji(match[0])
    } else {
      setCustomEmoji(val)
    }
  }

  const toggleTraveler = (id) => {
    setForm(f => {
      const ids = f.travelerIds || []
      if (id === currentUserProfile?.uid) return f
      const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
      return { ...f, travelerIds: next, travelers: Math.max(next.length, 1) }
    })
  }

  const allTravelers = [
    ...(currentUserProfile ? [{ ...currentUserProfile, id: currentUserProfile.uid, isMe: true }] : []),
    ...profiles,
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading font-semibold text-xl text-text-primary mb-1">Name your adventure</h2>
        <p className="text-sm text-text-muted font-medium">What should we call this trip?</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip Name</label>
        <Input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Summer in Europe"
          autoFocus
        />
      </div>

      {/* Emoji Picker */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip Emoji</label>
        <div className="grid grid-cols-10 gap-1.5 mb-2">
          {TRIP_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { setForm(f => ({ ...f, emoji })); setCustomEmoji('') }}
              className={`w-9 h-9 flex items-center justify-center text-lg rounded-[var(--radius-sm)] transition-all duration-150
                ${form.emoji === emoji && !customEmoji
                  ? 'bg-accent/15 ring-2 ring-accent scale-110'
                  : 'bg-bg-secondary hover:bg-bg-hover'
                }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl w-9 h-9 flex items-center justify-center border border-border rounded-[var(--radius-sm)] bg-bg-secondary">
            {form.emoji}
          </span>
          <Input
            type="text"
            value={customEmoji}
            onChange={e => handleCustomEmoji(e.target.value)}
            placeholder="Or type any emoji…"
          />
        </div>
      </div>

      {/* Travelers */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Wanderers</label>
        <div className="flex flex-wrap gap-2">
          {allTravelers.map(p => {
            const selected = (form.travelerIds || []).includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleTraveler(p.uid || p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)] border text-sm transition-all duration-150
                  ${selected
                    ? 'bg-accent/10 border-accent/40 text-text-primary'
                    : 'bg-bg-secondary border-border text-text-muted hover:border-accent/30 hover:text-text-secondary'
                  }
                  ${p.isMe ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <AvatarCircle profile={p} size={22} />
                <span className="font-medium">{p.isMe ? `${p.name} (you)` : p.name}</span>
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Start Date</label>
          <DatePicker
            value={form.startDate}
            onChange={val => setForm(f => ({ ...f, startDate: val }))}
            placeholder="Pick a date"
            className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)] hover:border-accent/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">End Date</label>
          <DatePicker
            value={form.endDate}
            onChange={val => setForm(f => ({ ...f, endDate: val }))}
            min={form.startDate || undefined}
            placeholder="Pick a date"
            className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)] hover:border-accent/50"
          />
        </div>
      </div>
    </div>
  )
}
