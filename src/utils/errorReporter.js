import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase/config'

/**
 * Minimal client error telemetry for a private app.
 *
 * Errors land in the `clientErrors` Firestore collection — a write-only
 * drop box (see firestore.rules): clients can create, nobody can read
 * them back except via the Firebase console.
 *
 * Friends don't file bug reports; this is how the app tells you it broke.
 */

const MAX_REPORTS_PER_SESSION = 10
const DEDUPE_WINDOW_MS = 60_000

let reportCount = 0
const recentMessages = new Map() // message -> last reported timestamp

export function reportError(error, context = '') {
  try {
    const message = String(error?.message || error || 'Unknown error').slice(0, 1900)

    // In dev, log loudly and skip the network write.
    if (import.meta.env.DEV) {
      console.error('[errorReporter]', context, error)
      return
    }

    // Rules require an authenticated user; nothing to attribute otherwise.
    const uid = auth.currentUser?.uid
    if (!uid) return

    // Session cap + per-message dedupe so an error loop can't spam Firestore.
    if (reportCount >= MAX_REPORTS_PER_SESSION) return
    const last = recentMessages.get(message)
    if (last && Date.now() - last < DEDUPE_WINDOW_MS) return
    recentMessages.set(message, Date.now())
    reportCount++

    addDoc(collection(db, 'clientErrors'), {
      message,
      stack: String(error?.stack || '').slice(0, 4000),
      context: String(context || '').slice(0, 500),
      url: window.location.href.slice(0, 500),
      userAgent: navigator.userAgent.slice(0, 300),
      uid,
      createdAt: serverTimestamp(),
    }).catch(() => { /* telemetry must never throw */ })
  } catch { /* telemetry must never throw */ }
}

/** Install window-level handlers. Call once from main.jsx. */
export function installGlobalErrorReporting() {
  window.addEventListener('error', (event) => {
    reportError(event.error || event.message, 'window.onerror')
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'unhandledrejection')
  })
}
