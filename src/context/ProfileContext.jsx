import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { doc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
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
        const seed = {
          id: uid,
          uid,
          name: user.displayName || user.email?.split('@')[0] || 'Me',
          email: user.email,
          photo: user.photoURL || null,
          customPhoto: null,
          createdAt: new Date().toISOString(),
        }
        // Root doc for lookup
        await setDoc(doc(db, 'users', uid), {
          email: user.email?.toLowerCase().trim(),
          uid,
          updatedAt: new Date().toISOString()
        })
        // Profile doc
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

  // ── Discovery: Find other users by email ────────────────────────────────
  const findProfileByEmail = useCallback(async (email) => {
    if (!email) return null
    try {
      // Search all users/{uid}/profile/data docs where email matches
      // Note: This requires a collection group index or iterating if security allows.
      // For simplicity in this structure, we'll try to find the profile
      const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()))
      // Actually, my structure is /users/{uid}/profile/data. email is inside 'data'.
      // Better to use a collectionGroup query if possible, or we need a root 'profiles' collection.
      // Let's assume we can search the profiles via collectionGroup 'profile'.
      // Wait, I can't easily setup collectionGroup indices here.
      // Alternative: Try to fetch a known path or use a root 'users' doc for lookup.
      // I previously setup: match /users/{uid} { allow read... }
      // Let's check if the user has an 'allowed: true' check in App.jsx.

      // I will implement a simpler lookup: search in the root 'users' collection 
      // where I'll ensure email is also stored for lookup.
      const usersRef = collection(db, 'users')
      const emailQuery = query(usersRef, where('email', '==', email.toLowerCase().trim()))
      const snap = await getDocs(emailQuery)

      if (!snap.empty) {
        const userDoc = snap.docs[0]
        const userData = userDoc.data()
        // Now get the actual profile data
        const pSnap = await getDoc(doc(db, 'users', userDoc.id, 'profile', 'data'))
        return pSnap.exists() ? { ...pSnap.data(), id: userDoc.id, uid: userDoc.id } : null
      }
      return null
    } catch (err) {
      console.warn('[ProfileContext] Lookup failed:', err)
      return null
    }
  }, [])

  // ── Shared traveler actions ────────────────────────────────────────────
  const addProfile = useCallback((profile) => {
    const newProfile = {
      ...profile,
      id: profile.uid || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      name: profile.name.trim(),
      photo: profile.photo || null,
    }
    setProfiles(prev => {
      // Avoid duplicates
      if (prev.some(p => p.id === newProfile.id || (p.email && p.email === newProfile.email))) {
        return prev
      }
      return [...prev, newProfile]
    })
    return newProfile
  }, [])

  const updateProfile = useCallback((id, updates) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }, [])

  const deleteProfile = useCallback((id) => {
    setProfiles(prev => prev.filter(p => p.id !== id))
  }, [])

  // ── Resolved profile helper ────────────────────────────────────────────
  const resolveProfile = useCallback((id) => {
    if (id === uid && currentUserProfile) return currentUserProfile
    return profiles.find(p => p.id === id || p.uid === id) || null
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
      findProfileByEmail,
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
