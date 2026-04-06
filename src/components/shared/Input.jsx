import { forwardRef } from 'react'
import { compactInputSurfaceClass, inputSurfaceClass } from './surfaceStyles'

const sizes = {
  sm: compactInputSurfaceClass,
  md: inputSurfaceClass,
  lg: inputSurfaceClass,
}

const variants = {
  default: '',
  bare: 'bg-transparent border-0 px-0 py-0 shadow-none text-text-primary placeholder:text-text-muted focus:ring-0 focus-visible:ring-0',
}

const Input = forwardRef(function Input(
  { className = '', size = 'md', variant = 'default', ...props },
  ref
) {
  const sizeClass = sizes[size] || sizes.md
  const variantClass = variants[variant] || variants.default

  return (
    <input
      ref={ref}
      className={`${sizeClass} ${variantClass} ${className}`}
      {...props}
    />
  )
})

export default Input
