export default function Card({ children, className = '', hover = false, onClick, padding = 'p-5' }) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-[var(--color-bg-card)] border border-border rounded-[14px]
        shadow-[var(--shadow-card)]
        ${hover ? 'hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-[1px] cursor-pointer' : ''}
        transition-all duration-200
        ${padding}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
