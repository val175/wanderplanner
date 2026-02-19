import { useState, useRef, useEffect } from 'react'

export default function EditableText({
  value,
  onSave,
  tag: Tag = 'span',
  className = '',
  inputClassName = '',
  placeholder = 'Click to edit...',
  multiline = false,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select?.()
    }
  }, [editing])

  useEffect(() => {
    setDraft(value)
  }, [value])

  const handleSave = () => {
    setEditing(false)
    const trimmed = draft?.trim() ?? ''
    if (trimmed !== value) {
      onSave(trimmed)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setDraft(value)
      setEditing(false)
    }
  }

  if (editing) {
    const InputTag = multiline ? 'textarea' : 'input'
    return (
      <InputTag
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`
          bg-bg-input border border-accent/30 rounded-[var(--radius-sm)]
          px-2 py-1 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
          text-text-primary font-body
          ${multiline ? 'min-h-[80px] resize-y w-full' : ''}
          ${inputClassName}
        `}
        rows={multiline ? 3 : undefined}
      />
    )
  }

  return (
    <Tag
      onClick={() => { setDraft(value); setEditing(true) }}
      className={`
        cursor-pointer border-b border-transparent
        hover:border-accent/30 transition-colors duration-150
        ${!value ? 'text-text-muted italic' : ''}
        ${className}
      `}
      title="Click to edit"
    >
      {value || placeholder}
    </Tag>
  )
}
