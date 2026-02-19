import { createContext, useContext } from 'react'

export const TripContext = createContext(null)

export function useTripContext() {
  const context = useContext(TripContext)
  if (!context) {
    throw new Error('useTripContext must be used within a TripContext.Provider')
  }
  return context
}
