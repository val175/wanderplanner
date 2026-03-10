/**
 * api/_cors.js — Single source of truth for CORS headers.
 * Supports both production and local development (localhost).
 */

const PRODUCTION_ORIGIN = 'https://planner.vlbonite.co'

/**
 * Returns allowed origin based on the request.
 * If origin is localhost or production, reflects it back.
 * Otherwise defaults to production origin.
 */
function getAllowedOrigin(req) {
    const origin = req.headers?.origin || (req.headers?.get && req.headers.get('origin')) || ''

    if (
        origin === PRODUCTION_ORIGIN ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
    ) {
        return origin
    }

    return PRODUCTION_ORIGIN
}

const COMMON_HEADERS = {
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
    'Access-Control-Allow-Credentials': 'true',
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
