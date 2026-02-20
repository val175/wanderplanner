import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

// Single Firestore document that holds the profiles array.
// Since this is a private 2-person app, one shared doc is simpler than per-user paths.
const PROFILES_DOC = doc(db, 'meta', 'profiles')
const STORAGE_KEY = 'wanderplan_profiles' // localStorage used as fast initial seed + offline cache

const ProfileContext = createContext(null)

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

export function ProfileProvider({ children }) {
  // Seed from localStorage immediately so UI doesn't flash empty on load
  const [profiles, setProfiles] = useState(loadFromLocalStorage)
  // Track whether the initial Firestore snapshot has arrived
  const readyRef = useRef(false)
  // Track whether a change came FROM Firestore (to avoid echo-write loop)
  const isRemoteRef = useRef(false)

  // ── 1. Real-time listener: Firestore → local state ──────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      PROFILES_DOC,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data().profiles || []
          isRemoteRef.current = true
          setProfiles(data)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
        } else {
          // Doc doesn't exist yet — seed it from localStorage if available
          const local = loadFromLocalStorage()
          if (local.length > 0) {
            setDoc(PROFILES_DOC, { profiles: local }).catch(console.error)
          }
        }
        readyRef.current = true
      },
      (err) => {
        console.warn('[Wanderplan] Profiles listener error:', err)
        readyRef.current = true // fall back to localStorage data already in state
      }
    )
    return unsub
  }, [])

  // ── 2. Outbound sync: local state → Firestore ───────────────────────────
  // Skips the echo-write when the change came FROM Firestore.
  // Also skips before the first Firestore snapshot to avoid overwriting with stale cache.
  useEffect(() => {
    if (isRemoteRef.current) {
      isRemoteRef.current = false
      return
    }
    if (!readyRef.current) return
    setDoc(PROFILES_DOC, { profiles }).catch(console.error)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)) } catch {}
  }, [profiles])

  const addProfile = useCallback((profile) => {
    const newProfile = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: profile.name.trim(),
      photo: profile.photo || null,
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
