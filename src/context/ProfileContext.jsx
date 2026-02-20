import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'wanderplan_profiles'

const ProfileContext = createContext(null)

function loadProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState(loadProfiles)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  }, [profiles])

  const addProfile = useCallback((profile) => {
    const newProfile = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: profile.name.trim(),
      photo: profile.photo || null, // base64 data URL or null
    }
    setProfiles(prev => [...prev, newProfile])
    return newProfile
  }, [])

  const updateProfile = useCallback((id, updates) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }, [])

  const deleteProfile = useCallback((id) => {
    setProfiles(prev => prev.filter(p => p.id !== id))
  }, [])

  return (
    <ProfileContext.Provider value={{ profiles, addProfile, updateProfile, deleteProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfiles() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfiles must be used within ProfileProvider')
  return ctx
}
