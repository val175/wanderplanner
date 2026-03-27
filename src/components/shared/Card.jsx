export default function Card({ children, className = '', hover = false, onClick, padding = 'p-5', type = 'button', ...props }) {
  const classes = `
    bg-bg-card border border-border rounded-[var(--radius-md)]
    transition-colors duration-200
    ${padding}
    ${hover || onClick ? 'hover:border-border-strong' : ''}
    ${onClick ? 'cursor-pointer text-left w-full appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary' : ''}
    ${className}
  `

  if (onClick) {
    return (
      <button
        type={type}
        onClick={onClick}
        className={classes}
        {...props}
      >
        {children}
      </button>
    )
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}
