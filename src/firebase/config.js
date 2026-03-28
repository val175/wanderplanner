import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
const envStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
const storageBucket = envStorageBucket && !String(envStorageBucket).includes('firebasestorage.app')
  ? envStorageBucket
  : `${projectId}.appspot.com`

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL:       'https://wanderplanner-dbee7-default-rtdb.asia-southeast1.firebasedatabase.app/'
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const storage = getStorage(app)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
})
export const rtdb = getDatabase(app)
export const googleProvider = new GoogleAuthProvider()
