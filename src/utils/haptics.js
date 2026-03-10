/**
 * Safe wrapper for native browser haptic feedback (vibration pattern).
 * Fails silently on unsupported devices (e.g. desktop).
 */
export function triggerHaptic(type = 'light') {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            if (type === 'light') navigator.vibrate(15)        // subtle tap
            if (type === 'medium') navigator.vibrate(40)       // firmer confirmation
            if (type === 'heavy') navigator.vibrate([30, 40, 30]) // double pulse/error/destructive
        } catch (e) {
            // Ignore
        }
    }
}

/**
 * Semantic alias — fire on primary action buttons (FABs, submit, confirm).
 * @param {'light' | 'medium' | 'heavy'} intensity
 */
export function hapticImpact(intensity = 'medium') {
    triggerHaptic(intensity)
}

/**
 * Semantic alias — fire on selection changes, toggle flips, or swipe-threshold events.
 */
export function hapticSelection() {
    triggerHaptic('light')
}
