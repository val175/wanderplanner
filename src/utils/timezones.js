/**
 * Lightweight country → IANA timezone mapping.
 * Covers the most common travel destinations. Falls back gracefully to null
 * when a country is not recognized (no badge shown).
 */
export const COUNTRY_TIMEZONE = {
    // Southeast Asia
    'Philippines': 'Asia/Manila',
    'Thailand': 'Asia/Bangkok',
    'Vietnam': 'Asia/Ho_Chi_Minh',
    'Indonesia': 'Asia/Jakarta',
    'Malaysia': 'Asia/Kuala_Lumpur',
    'Singapore': 'Asia/Singapore',
    'Cambodia': 'Asia/Phnom_Penh',
    'Myanmar': 'Asia/Rangoon',
    'Laos': 'Asia/Vientiane',
    'Brunei': 'Asia/Brunei',
    'Timor-Leste': 'Asia/Dili',

    // East Asia
    'Japan': 'Asia/Tokyo',
    'South Korea': 'Asia/Seoul',
    'Korea': 'Asia/Seoul',
    'China': 'Asia/Shanghai',
    'Taiwan': 'Asia/Taipei',
    'Hong Kong': 'Asia/Hong_Kong',
    'Macau': 'Asia/Macau',
    'Mongolia': 'Asia/Ulaanbaatar',

    // South Asia
    'India': 'Asia/Kolkata',
    'Sri Lanka': 'Asia/Colombo',
    'Nepal': 'Asia/Kathmandu',
    'Bangladesh': 'Asia/Dhaka',
    'Pakistan': 'Asia/Karachi',
    'Maldives': 'Indian/Maldives',

    // Middle East & Central Asia
    'United Arab Emirates': 'Asia/Dubai',
    'UAE': 'Asia/Dubai',
    'Qatar': 'Asia/Qatar',
    'Saudi Arabia': 'Asia/Riyadh',
    'Turkey': 'Europe/Istanbul',
    'Israel': 'Asia/Jerusalem',
    'Jordan': 'Asia/Amman',

    // Europe
    'United Kingdom': 'Europe/London',
    'UK': 'Europe/London',
    'France': 'Europe/Paris',
    'Germany': 'Europe/Berlin',
    'Spain': 'Europe/Madrid',
    'Italy': 'Europe/Rome',
    'Portugal': 'Europe/Lisbon',
    'Netherlands': 'Europe/Amsterdam',
    'Belgium': 'Europe/Brussels',
    'Switzerland': 'Europe/Zurich',
    'Austria': 'Europe/Vienna',
    'Greece': 'Europe/Athens',
    'Poland': 'Europe/Warsaw',
    'Czech Republic': 'Europe/Prague',
    'Hungary': 'Europe/Budapest',
    'Sweden': 'Europe/Stockholm',
    'Norway': 'Europe/Oslo',
    'Denmark': 'Europe/Copenhagen',
    'Finland': 'Europe/Helsinki',
    'Russia': 'Europe/Moscow',
    'Croatia': 'Europe/Zagreb',
    'Romania': 'Europe/Bucharest',
    'Ireland': 'Europe/Dublin',

    // Americas
    'United States': 'America/New_York',
    'USA': 'America/New_York',
    'Canada': 'America/Toronto',
    'Mexico': 'America/Mexico_City',
    'Brazil': 'America/Sao_Paulo',
    'Argentina': 'America/Argentina/Buenos_Aires',
    'Chile': 'America/Santiago',
    'Colombia': 'America/Bogota',
    'Peru': 'America/Lima',
    'Ecuador': 'America/Guayaquil',
    'Cuba': 'America/Havana',
    'Dominican Republic': 'America/Santo_Domingo',

    // Pacific & Africa
    'Australia': 'Australia/Sydney',
    'New Zealand': 'Pacific/Auckland',
    'Fiji': 'Pacific/Fiji',
    'Hawaii': 'Pacific/Honolulu',
    'South Africa': 'Africa/Johannesburg',
    'Egypt': 'Africa/Cairo',
    'Kenya': 'Africa/Nairobi',
    'Morocco': 'Africa/Casablanca',
    'Ethiopia': 'Africa/Addis_Ababa',
}

/**
 * Get the UTC offset in hours for a given IANA timezone at the current moment.
 * Uses Intl API — no external dependencies. Works in all modern browsers.
 */
export function getUTCOffsetHours(ianaTimezone) {
    try {
        const now = new Date()
        const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
        const local = new Date(now.toLocaleString('en-US', { timeZone: ianaTimezone }))
        return (local - utc) / (1000 * 60 * 60)
    } catch {
        return null
    }
}

/**
 * Given a 24h time string like "14:00" and an offset delta (hours),
 * return the "body clock" time as a formatted string like "3:00 AM".
 */
export function applyTimezoneOffset(time24h, offsetDelta) {
    if (!time24h || offsetDelta === null) return null
    const [hRaw, mRaw] = time24h.split(':').map(Number)
    if (isNaN(hRaw) || isNaN(mRaw)) return null

    let totalMinutes = hRaw * 60 + mRaw - offsetDelta * 60
    // Keep within 0–1440 range (wrap around midnight)
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    const period = h < 12 ? 'AM' : 'PM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** Patterns that identify an arrival/flight activity */
export const FLIGHT_ACTIVITY_PATTERNS = /arriv|land|touchdown|flight|check[\s-]?in|transit|layover/i
export const FLIGHT_EMOJIS = new Set(['✈️', '🛬', '🛫', '🚀'])
