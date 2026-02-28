import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
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
      // ALWAYS ensure the root document has the email for lookups,
      // even if their profile already existed from before this feature was added.
      try {
        await setDoc(doc(db, 'users', uid), {
          email: user.email?.toLowerCase().trim(),
          uid,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      } catch (err) {
        console.warn('[ProfileContext] Failed to update root user doc:', err)
      }

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
          const firestoreData = snap.data().profiles || []
          // Merge Firestore data with localStorage so locally-added travelers are never wiped
          const localData = loadFromLocalStorage()
          const merged = [...firestoreData]
          localData.forEach(localProfile => {
            if (!merged.some(p => p.id === localProfile.id)) {
              merged.push(localProfile)
            }
          })
          // Only set isRemoteRef immediately before calling setProfiles
          isRemoteRef.current = true
          setProfiles(merged)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch { }
          // Heal Firestore if our merged list has more data than what's there
          if (merged.length > firestoreData.length) {
            setDoc(travelersDocRef, { profiles: merged }).catch(console.warn)
          }
        } else {
          // Doc doesn't exist yet — push local data to Firestore if we have any.
          // DO NOT set isRemoteRef here since we are NOT calling setProfiles.
          // Setting it without a matching setProfiles call would cause the next
          // user-driven addProfile() to be silently skipped by the outbound sync.
          const local = loadFromLocalStorage()
          if (local.length > 0) {
            setDoc(travelersDocRef, { profiles: local }).catch(console.error)
          }
        }
        readyRef.current = true
      },
      (err) => {
        console.warn('[Wanderplan] Travelers listener error:', err)
        const local = loadFromLocalStorage()
        if (local.length > 0) {
          isRemoteRef.current = true
          setProfiles(local)
        }
        readyRef.current = true
      }
    )
    return unsub
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Outbound sync: shared travelers local state → Firestore ─────────
  useEffect(() => {
    if (isRemoteRef.current) { isRemoteRef.current = false; return }
    if (!readyRef.current) return
    // Always persist to localStorage first (works even without Firestore access)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)) } catch { }
    // Then try Firestore (may fail if rules aren't configured; that's OK)
    if (travelersDocRef) {
      setDoc(travelersDocRef, { profiles }).catch(console.warn)
    }
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

    // Add current user to other person's travelers list if they have a real account
    if (newProfile.uid && currentUserProfile && newProfile.uid !== currentUserProfile.uid) {
      const otherTravelersRef = doc(db, 'users', newProfile.uid, 'travelers', 'data')
      const reciprocalProfile = {
        id: currentUserProfile.id || currentUserProfile.uid,
        uid: currentUserProfile.uid,
        name: currentUserProfile.name,
        email: currentUserProfile.email,
        photo: currentUserProfile.photo || currentUserProfile.customPhoto || null
      }

      getDoc(otherTravelersRef).then(snap => {
        const otherProfiles = snap.exists() ? snap.data().profiles || [] : []
        if (!otherProfiles.some(p => p.id === reciprocalProfile.id || (p.email && p.email === reciprocalProfile.email))) {
          otherProfiles.push(reciprocalProfile)
          setDoc(otherTravelersRef, { profiles: otherProfiles }, { merge: true })
            .catch(err => console.warn('[ProfileContext] Failed to add reciprocal traveler:', err))
        }
      }).catch(err => console.warn('[ProfileContext] Failed to retrieve other travelers:', err))
    }

    return newProfile
  }, [currentUserProfile])

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
