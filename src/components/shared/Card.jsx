export default function Card({ children, className = '', hover = false, onClick, padding = 'p-5' }) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-[var(--color-bg-card)] border border-border rounded-[14px]
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
