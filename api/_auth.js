import { jwtVerify, createRemoteJWKSet } from 'jose'

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'wanderplanner-dbee7'
const JWKS_URI = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

const JWKS = createRemoteJWKSet(new URL(JWKS_URI))

export async function verifyFirebaseToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('[verifyFirebaseToken] Missing or invalid Authorization header', authHeader)
        throw new Error('Unauthorized: Missing or invalid token')
    }

    const token = authHeader.split('Bearer ')[1]

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
            audience: FIREBASE_PROJECT_ID,
        })
        return payload
    } catch (error) {
        console.error('[verifyFirebaseToken] Token verification failed:', error.message)
        throw new Error('Unauthorized: Invalid token')
    }
}
