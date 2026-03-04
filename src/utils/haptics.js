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
