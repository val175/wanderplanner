/**
 * api/_cors.js — Single source of truth for CORS headers.
 *
 * Two export shapes because we have two handler styles:
 *
 *   Edge runtime (chat.js):
 *     import { CORS_HEADERS } from './_cors.js'
 *     return new Response(body, { headers: CORS_HEADERS })
 *
 *   Serverless / Node runtime (extract-*.js, generate-checklist.js):
 *     import { setCorsHeaders } from './_cors.js'
 *     setCorsHeaders(res)
 *     if (req.method === 'OPTIONS') return res.status(200).end()
 *
 * Adding or changing a header in ONE place here fixes every endpoint at once.
 */

const ALLOWED_ORIGIN  = 'https://planner.vlbonite.co'
const ALLOWED_METHODS = 'GET,OPTIONS,PATCH,DELETE,POST,PUT'
const ALLOWED_HEADERS = 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'

/** Plain object — spread directly into edge Response headers. */
export const CORS_HEADERS = {
    'Access-Control-Allow-Origin':      ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods':     ALLOWED_METHODS,
    'Access-Control-Allow-Headers':     ALLOWED_HEADERS,
    'Access-Control-Allow-Credentials': 'true',
}

/** Mutates a Node/Vercel serverless `res` object with the CORS headers. */
export function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin',      ALLOWED_ORIGIN)
    res.setHeader('Access-Control-Allow-Methods',     ALLOWED_METHODS)
    res.setHeader('Access-Control-Allow-Headers',     ALLOWED_HEADERS)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
}
