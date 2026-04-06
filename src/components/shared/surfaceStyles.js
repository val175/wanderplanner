export const dialogOverlayClass =
  'fixed inset-0 z-[9998] bg-text-primary/30 backdrop-blur-sm animate-fade-in'

export const dialogContentClass = `
  fixed z-[9999] w-full
  bg-bg-card border border-border rounded-[var(--radius-xl)]
  max-h-[95vh] overflow-y-auto
  focus:outline-none
`

export const dialogCloseClass =
  'p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors'

export const dialogSectionLabelClass =
  'text-xs font-semibold text-text-muted uppercase tracking-wider'

export const popoverSurfaceClass = `
  z-[9999] bg-bg-card border border-border rounded-[var(--radius-md)]
  overflow-hidden
`

export const inputSurfaceClass = `
  w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)]
  text-text-primary placeholder:text-text-muted px-3 py-2
  focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/40
  focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary transition-colors
`

export const compactInputSurfaceClass = `
  w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)]
  text-text-primary placeholder:text-text-muted px-2 py-1.5
  focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/40
  focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary transition-colors
`
