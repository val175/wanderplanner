import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase/config'

export function useAuth() {
  // null  = auth state not yet resolved (still loading)
  // false = resolved, user is not signed in
  // object = resolved, user is signed in
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || false)
      setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
    // onAuthStateChanged fires automatically after this — no manual setUser needed
  }

  const signOutUser = async () => {
    await signOut(auth)
  }

  return { user, authLoading, signInWithGoogle, signOutUser }
}
