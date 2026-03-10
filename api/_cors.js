/**
 * api/_cors.js — Single source of truth for CORS headers.
 * Supports both production and local development (localhost).
 */

const PRODUCTION_ORIGIN = 'https://planner.vlbonite.co'

/**
 * Returns allowed origin based on the request headers.
 * Supports production, local dev, and local network IPs for mobile testing.
 */
function getAllowedOrigin(req) {
    const origin = req.headers?.origin || (req.headers?.get && req.headers.get('origin')) || ''

    if (
        origin === PRODUCTION_ORIGIN ||
        origin.endsWith('.vlbonite.co') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.') ||
        origin.startsWith('http://172.')
    ) {
        return origin
    }

    return PRODUCTION_ORIGIN
}

const COMMON_HEADERS = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-ai-sdk-runtime, x-ai-sdk-version',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
}

/** Plain object — spread directly into edge Response headers. */
export function getCorsHeaders(req) {
    return {
        ...COMMON_HEADERS,
        'Access-Control-Allow-Origin': getAllowedOrigin(req),
    }
}

/** Mutates a Node/Vercel serverless `res` object with the CORS headers. */
export function setCorsHeaders(req, res) {
    const origin = getAllowedOrigin(req)
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', COMMON_HEADERS['Access-Control-Allow-Methods'])
    res.setHeader('Access-Control-Allow-Headers', COMMON_HEADERS['Access-Control-Allow-Headers'])
    res.setHeader('Access-Control-Allow-Credentials', COMMON_HEADERS['Access-Control-Allow-Credentials'])
}
