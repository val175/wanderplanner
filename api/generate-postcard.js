import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization
        try {
            await verifyFirebaseToken(authHeader)
        } catch {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const { tripName, city, year } = req.body
        if (!tripName || !city || !year) {
            return res.status(400).json({ error: 'Missing required fields: tripName, city, year' })
        }

        const prompt = `A beautiful artistic postcard for a trip to ${city}. The text "${tripName} ${year}" is elegantly integrated into the scenery as if part of the landscape or a classic travel poster.`

        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict?key=${process.env.GEMINI_API_KEY}`
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt }],
                parameters: { sampleCount: 1, aspectRatio: '9:16' }
            })
        })

        if (!response.ok) {
            const err = await response.text()
            console.error('[generate-postcard] Imagen API error:', err)
            return res.status(response.status).json({ error: 'Image generation failed' })
        }

        const data = await response.json()
        const prediction = data.predictions?.[0]
        if (!prediction?.bytesBase64Encoded) {
            console.error('[generate-postcard] No image in response:', JSON.stringify(data))
            return res.status(500).json({ error: 'No image returned from Imagen' })
        }

        const dataUrl = `data:${prediction.mimeType || 'image/png'};base64,${prediction.bytesBase64Encoded}`
        return res.status(200).json({ dataUrl })
    } catch (error) {
        console.error('[generate-postcard] Error:', error)
        return res.status(500).json({ error: error.message })
    }
}
