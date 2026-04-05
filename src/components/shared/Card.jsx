import { motion } from 'framer-motion'
import { spring } from '../../lib/motion'

export default function Card({ children, className = '', hover = false, onClick, padding = 'p-5', type = 'button', ...props }) {
  const classes = `
    bg-bg-card border border-border rounded-[var(--radius-md)]
    transition-colors duration-200
    ${padding}
    ${hover || onClick ? 'hover:border-border-strong' : ''}
    ${onClick ? 'cursor-pointer text-left w-full appearance-none focus-ring' : ''}
    ${className}
  `

  if (onClick) {
    return (
      <motion.button
        type={type}
        onClick={onClick}
        className={classes}
        whileHover={{ y: -2, transition: spring.snappy }}
        whileTap={{ scale: 0.98, transition: spring.snappy }}
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
