export default function CommentText({ text, travelers = [], className = '' }) {
  if (!text) return null

  const names = travelers.map(t => t.name).filter(Boolean).sort((a, b) => b.length - a.length)

  if (!names.length) {
    return <p className={`mt-2 text-sm text-text-secondary leading-relaxed ${className}`}>{text}</p>
  }

  const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'g')
  const parts = text.split(pattern)

  return (
    <p className={`mt-2 text-sm text-text-secondary leading-relaxed ${className}`}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && names.includes(part.slice(1))) {
          return <span key={i} className="text-accent font-semibold">{part}</span>
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}
