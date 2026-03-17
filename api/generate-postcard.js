import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

const IMAGEN_MODELS = [
    'imagen-4.0-generate-001',
    'imagen-4.0-ultra-generate-001',
    'imagen-4.0-fast-generate-001',
]

async function tryImagenModel(model, prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio: '9:16' }
        })
    })

    if (!response.ok) {
        const errText = await response.text()
        let errDetail = errText
        try { errDetail = JSON.parse(errText)?.error?.message || errText } catch {}
        console.error(`[generate-postcard] ${model} failed (${response.status}):`, errDetail)
        return { ok: false, status: response.status, detail: errDetail }
    }

    const data = await response.json()
    const prediction = data.predictions?.[0]
    if (!prediction?.bytesBase64Encoded) {
        console.error(`[generate-postcard] ${model} returned no image:`, JSON.stringify(data))
        return { ok: false, status: 500, detail: 'No image in response' }
    }

    return {
        ok: true,
        dataUrl: `data:${prediction.mimeType || 'image/png'};base64,${prediction.bytesBase64Encoded}`,
        model,
    }
}

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
        const apiKey = process.env.GEMINI_API_KEY

        let lastError = null
        for (const model of IMAGEN_MODELS) {
            const result = await tryImagenModel(model, prompt, apiKey)
            if (result.ok) {
                console.log(`[generate-postcard] Success with ${result.model}`)
                return res.status(200).json({ dataUrl: result.dataUrl })
            }
            lastError = result
        }

        return res.status(lastError.status || 500).json({
            error: 'All Imagen models failed',
            detail: lastError.detail,
        })
    } catch (error) {
        console.error('[generate-postcard] Error:', error)
        return res.status(500).json({ error: error.message })
    }
}
