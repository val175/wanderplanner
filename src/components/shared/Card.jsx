export default function Card({ children, className = '', hover = false, onClick, padding = 'p-6' }) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-bg-secondary border border-border rounded-[14px]
        ${hover ? 'hover:-translate-y-[1px] cursor-pointer' : ''}
        transition-all duration-200
        ${padding}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
