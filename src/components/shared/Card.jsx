import { motion } from 'framer-motion'

const springTransition = { type: 'spring', stiffness: 400, damping: 28 }

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
      <motion.button
        type={type}
        onClick={onClick}
        className={classes}
        whileHover={{ y: -2, transition: springTransition }}
        whileTap={{ scale: 0.98, transition: springTransition }}
        {...props}
      >
        {children}
      </motion.button>
    )
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}
