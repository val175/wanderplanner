import React from 'react'

const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-sm' // Larger padding but keeps text-sm for clean aesthetics
}

const variants = {
    primary: 'bg-accent text-white hover:bg-accent-hover border border-transparent',
    secondary: 'bg-bg-secondary text-text-primary border border-border hover:bg-bg-hover hover:border-border-strong',
    ghost: 'bg-accent/5 text-accent border border-accent/20 hover:bg-accent/10 hover:border-accent/40',
    danger: 'bg-danger text-white hover:bg-danger/90 border border-transparent'
}

export default function Button({
    type = 'button',
    variant = 'primary',
    size = 'md',
    className = '',
    children,
    onClick,
    disabled = false,
    ...props
}) {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] transition-all'
    const sizeStyles = sizes[size] || sizes.md
    const variantStyles = variants[variant] || variants.primary
    const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyles} ${sizeStyles} ${variantStyles} ${disabledStyles} ${className}`}
            {...props}
        >
            {children}
        </button>
    )
}
