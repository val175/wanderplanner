import { useEffect, useRef, useState } from 'react'
import AvatarCircle from './AvatarCircle'

function getHighlightedParts(text, travelerNames) {
  if (!text || !travelerNames.length) return [{ text, highlight: false }]
  const escaped = [...travelerNames].sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'g')
  return text.split(pattern).map(part => ({
    text: part,
    highlight: part.startsWith('@') && travelerNames.includes(part.slice(1)),
  }))
}

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
  const textareaRef = useRef(null)

  const travelerNames = travelers.map(t => t.name).filter(Boolean)
  const filtered = mentionQuery !== null
    ? travelers.filter(t => t.name && t.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : []

  // Auto-resize to content height
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

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
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

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

  // Shared metrics applied to both overlay and textarea
  const sharedStyle = {
    fontSize: 'inherit',
    fontFamily: 'inherit',
    fontWeight: 'inherit',
    lineHeight: '1.5',
    letterSpacing: 'inherit',
    padding: 0,
    margin: 0,
    border: 0,
    wordBreak: 'break-word',
  }

  return (
    <div className="relative flex-1 min-w-0">

      {/* Highlight overlay — renders @mentions in accent, all other text transparent */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap"
        style={{ ...sharedStyle }}
      >
        {value ? (
          getHighlightedParts(value + ' ', travelerNames).map((part, i) =>
            part.highlight
              ? <span key={i} className="text-accent font-semibold">{part.text}</span>
              : <span key={i} style={{ color: 'transparent' }}>{part.text}</span>
          )
        ) : (
          // Placeholder rendered here so textarea can stay color:transparent
          <span className="text-text-muted">{placeholder}</span>
        )}
      </div>

      {/* Actual textarea — transparent text so overlay shows through, caret stays visible */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        className={`relative w-full resize-none overflow-hidden bg-transparent outline-none border-none ${className}`}
        style={{
          ...sharedStyle,
          color: 'transparent',
          caretColor: 'var(--color-text-primary, currentColor)',
          minHeight: '1.5em',
        }}
      />

      {/* @ mention dropdown */}
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
