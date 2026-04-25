import { useEffect, useRef, useState } from 'react'
import AvatarCircle from './AvatarCircle'

export default function MentionTextarea({
  value,
  onChange,
  onMentionsChange,
  travelers = [],
  placeholder,
  disabled,
  onEnter,
  className,
}) {
  const [mentionQuery, setMentionQuery] = useState(null)
  const [mentionStart, setMentionStart] = useState(-1)
  const [mentionedIds, setMentionedIds] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)

  const filtered = mentionQuery !== null
    ? travelers.filter(t => t.name && t.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : []

  const handleChange = (e) => {
    const text = e.target.value
    const cursor = e.target.selectionStart
    onChange(text)

    const beforeCursor = text.slice(0, cursor)
    const lastAt = beforeCursor.lastIndexOf('@')
    if (lastAt !== -1) {
      const afterAt = beforeCursor.slice(lastAt + 1)
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        setMentionQuery(afterAt)
        setMentionStart(lastAt)
        setActiveIdx(0)
        return
      }
    }
    setMentionQuery(null)
  }

  const selectMention = (traveler) => {
    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + 1 + (mentionQuery?.length || 0))
    const newText = `${before}@${traveler.name} ${after}`
    onChange(newText)
    const next = [...new Set([...mentionedIds, traveler.id])]
    setMentionedIds(next)
    onMentionsChange?.(next)
    setMentionQuery(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Reset when value is cleared externally (after post)
  useEffect(() => {
    if (!value) {
      setMentionedIds([])
      onMentionsChange?.([])
    }
  }, [value])

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(filtered[activeIdx]); return }
      if (e.key === 'Escape') { setMentionQuery(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEnter?.()
    }
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {mentionQuery !== null && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 bg-bg-card border border-border rounded-[var(--radius-lg)] shadow-xl z-50 min-w-[160px] py-1 overflow-hidden">
          {filtered.map((t, i) => (
            <button
              key={t.id}
              onMouseDown={e => { e.preventDefault(); selectMention(t) }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors
                ${i === activeIdx ? 'bg-accent/10 text-text-primary' : 'hover:bg-bg-hover text-text-secondary'}`}
            >
              <AvatarCircle profile={t} size={20} />
              <span className="font-medium">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
