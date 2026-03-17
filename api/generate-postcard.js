import { experimental_generateImage as generateImage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

const IMAGEN_MODELS = [
    'imagen-4.0-generate-001',
    'imagen-4.0-ultra-generate-001',
    'imagen-4.0-fast-generate-001',
]

export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    const authHeader = req.headers.authorization || req.headers.Authorization
    try {
        await verifyFirebaseToken(authHeader)
    } catch {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
        const { tripName, city, year } = req.body
        if (!tripName || !city || !year) {
            return res.status(400).json({ error: 'Missing required fields: tripName, city, year' })
        }

        const prompt = `A beautiful artistic postcard for a trip to ${city}. The text "${tripName} ${year}" is elegantly integrated into the scenery as if part of the landscape or a classic travel poster.`

        const google = createGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY,
        })

        const errors = []
        for (const modelId of IMAGEN_MODELS) {
            try {
                console.log(`[generate-postcard] Trying ${modelId}`)
                const { image } = await generateImage({
                    model: google.image(modelId),
                    prompt,
                    aspectRatio: '9:16',
                })
                console.log(`[generate-postcard] Success with ${modelId}`)
                const dataUrl = `data:${image.mimeType};base64,${image.base64}`
                return res.status(200).json({ dataUrl })
            } catch (err) {
                const msg = err?.message || String(err)
                console.error(`[generate-postcard] ${modelId} failed:`, msg)
                errors.push(`${modelId}: ${msg}`)
            }
        }

        return res.status(500).json({ error: 'All Imagen models failed', detail: errors.join(' | ') })
    } catch (error) {
        console.error('[generate-postcard] Error:', error)
        return res.status(500).json({ error: error.message })
    }
}
