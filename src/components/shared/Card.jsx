export default function Card({ children, className = '', hover = false, onClick, padding = 'p-5' }) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-bg-card border border-border rounded-[var(--radius-lg)]
        ${hover ? 'hover:border-border-strong cursor-pointer' : ''}
        transition-colors duration-200
        ${padding}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
