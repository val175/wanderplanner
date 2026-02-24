import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

// Each user's own profile lives at users/{uid}/profile
// The shared traveler list (other people on trips) stays at users/{uid}/travelers
const STORAGE_KEY = 'wanderplan_profiles'

const ProfileContext = createContext(null)

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }
  return []
}

export function ProfileProvider({ user, children }) {
  // ── Current user's own profile ─────────────────────────────────────────
  const [currentUserProfile, setCurrentUserProfile] = useState(null)

  // ── Shared traveler list (other people, e.g. Juliann) ─────────────────
  const [profiles, setProfiles] = useState(loadFromLocalStorage)
  const readyRef = useRef(false)
  const isRemoteRef = useRef(false)

  const uid = user?.uid
  const profileDocRef = uid ? doc(db, 'users', uid, 'profile', 'data') : null
  const travelersDocRef = uid ? doc(db, 'users', uid, 'travelers', 'data') : null

  // ── 1. Auto-create / sync current user's profile from Google ───────────
  useEffect(() => {
    if (!profileDocRef || !user) return

    const unsub = onSnapshot(profileDocRef, async (snap) => {
      if (snap.exists()) {
        setCurrentUserProfile(snap.data())
      } else {
        // First time: seed profile from Google account data
        const seed = {
          id: uid,
          uid,
          name: user.displayName || user.email?.split('@')[0] || 'Me',
          email: user.email,
          // Use Google photo URL as default; user can override with a custom upload
          photo: user.photoURL || null,
          customPhoto: null, // set when user uploads their own
          createdAt: new Date().toISOString(),
        }
        await setDoc(profileDocRef, seed)
        setCurrentUserProfile(seed)
      }
    })

    return unsub
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Real-time listener: shared travelers Firestore → local state ────
  useEffect(() => {
    if (!travelersDocRef) return

    const unsub = onSnapshot(
      travelersDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data().profiles || []
          isRemoteRef.current = true
          setProfiles(data)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { }
        } else {
          // Doc doesn't exist yet — seed from localStorage if available
          const local = loadFromLocalStorage()
          if (local.length > 0) {
            isRemoteRef.current = true
            setDoc(travelersDocRef, { profiles: local }).catch(console.error)
          } else {
            isRemoteRef.current = true
          }
        }
        readyRef.current = true
      },
      (err) => {
        console.warn('[Wanderplan] Travelers listener error:', err)
        readyRef.current = true
      }
    )
    return unsub
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Outbound sync: shared travelers local state → Firestore ─────────
  useEffect(() => {
    if (isRemoteRef.current) { isRemoteRef.current = false; return }
    if (!readyRef.current || !travelersDocRef) return
    setDoc(travelersDocRef, { profiles }).catch(console.error)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)) } catch { }
  }, [profiles]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Current user profile actions ───────────────────────────────────────
  const updateCurrentUserProfile = useCallback(async (updates) => {
    if (!profileDocRef) return
    const merged = { ...currentUserProfile, ...updates }
    setCurrentUserProfile(merged)
    await setDoc(profileDocRef, merged)
  }, [currentUserProfile, profileDocRef]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared traveler actions ────────────────────────────────────────────
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

  // ── Resolved profile helper ────────────────────────────────────────────
  // Components can call resolveProfile(id) to get any profile by id,
  // including the current user's own profile (where id === uid).
  const resolveProfile = useCallback((id) => {
    if (id === uid && currentUserProfile) return currentUserProfile
    return profiles.find(p => p.id === id) || null
  }, [uid, currentUserProfile, profiles])

  return (
    <ProfileContext.Provider value={{
      currentUserProfile,
      updateCurrentUserProfile,
      profiles,
      addProfile,
      updateProfile,
      deleteProfile,
      resolveProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfiles() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfiles must be used within ProfileProvider')
  return ctx
}
