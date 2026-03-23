import { useEffect, useState, useRef } from 'react'
import { ref, onValue, set, onDisconnect, remove } from 'firebase/database'
import { rtdb } from '../firebase/config'

export function usePresence(tripId, userId, tabId) {
  const [others, setOthers] = useState({})
  
  // Ref to hold the latest tabId to avoid stale closures in mousemove
  const currentTab = useRef(tabId)
  useEffect(() => {
    currentTab.current = tabId
  }, [tabId])

  useEffect(() => {
    if (!tripId || !userId) return

    const userRef = ref(rtdb, `presence/${tripId}/${userId}`)
    
    // Set up onDisconnect to remove cursor when user disconnects
    onDisconnect(userRef).remove()

    let lastUpdate = 0
    const THROTTLE_MS = 50 // Roughly 20fps

    const handleMouseMove = (e) => {
      const now = Date.now()
      if (now - lastUpdate > THROTTLE_MS) {
        lastUpdate = now
        set(userRef, {
          x: e.clientX,
          y: e.clientY,
          tabId: currentTab.current,
          timestamp: now
        })
      }
    }

    // Initialize presence (hide initially by placing offscreen)
    set(userRef, {
      x: -100, 
      y: -100,
      tabId: currentTab.current,
      timestamp: Date.now()
    })

    window.addEventListener('mousemove', handleMouseMove)

    // Listen to other users' presence
    const tripRef = ref(rtdb, `presence/${tripId}`)
    const unsubscribe = onValue(tripRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        // Remove ourselves from the 'others' list
        delete data[userId]
        
        // Filter out stale cursors (older than 30 seconds) in case of dirty disconnects
        const now = Date.now()
        const activeOthers = {}
        for (const [id, presence] of Object.entries(data)) {
           if (now - presence.timestamp < 30000) {
              activeOthers[id] = presence
           }
        }
        setOthers(activeOthers)
      } else {
        setOthers({})
      }
    })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      remove(userRef) // Cleanup when unmounting or switching trips
      unsubscribe()
    }
  }, [tripId, userId])

  return others
}
