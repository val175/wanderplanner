import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

// Internal logic for multimodal ingestion
export async function multimodalIngest(fileBuffer, mimeType) {
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured')

    // 1. Extraction with Gemini 3.1 Flash-Lite
    const extractionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`
    
    // Convert buffer to base64
    const base64Content = fileBuffer.toString('base64')

    const extractionBody = {
        contents: [{
            parts: [
                { text: "Extract structured data from this booking document (Image/PDF/Text). Return ONLY a valid JSON object with: type (must be one of: lodging, flight, activity, transport, other), title, date (ISO 8601), location. If information is missing, use null." },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Content
                    }
                }
            ]
        }],
        generationConfig: {
            response_mime_type: "application/json",
            // Matched to user requirement for minimal thinking / high speed
            thinking_config: { include_thoughts: false }
        }
    }

    const extractionResponse = await fetch(extractionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractionBody)
    })

    if (!extractionResponse.ok) {
        const err = await extractionResponse.json()
        throw new Error(`Extraction failed: ${err.error?.message || extractionResponse.statusText}`)
    }

    const extractionData = await extractionResponse.json()
    const textResult = extractionData.candidates[0].content.parts[0].text
    const parsedData = JSON.parse(textResult)

    // 2. Embedding with Gemini Embedding 2 (MRL)
    // Note: text-embedding-004 is available in v1
    const embeddingUrl = `https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=${geminiKey}`
    
    // Create a string representation for embedding
    const embeddingInput = `${parsedData.type} ${parsedData.title} ${parsedData.date} ${parsedData.location}`

    const embeddingBody = {
        model: "models/text-embedding-004",
        content: { parts: [{ text: embeddingInput }] },
        outputDimensionality: 256
    }

    const embeddingResponse = await fetch(embeddingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embeddingBody)
    })

    if (!embeddingResponse.ok) {
        const err = await embeddingResponse.json()
        throw new Error(`Embedding failed: ${err.error?.message || embeddingResponse.statusText}`)
    }

    const embeddingData = await embeddingResponse.json()
    const vector = embeddingData.embedding.values

    return { data: parsedData, vector }
}

export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization
        await verifyFirebaseToken(authHeader)

        const { file, mimeType } = req.body
        if (!file || !mimeType) {
            return res.status(400).json({ error: 'Missing file or mimeType in request body' })
        }

        // Handle base64 input
        const fileBuffer = Buffer.from(file, 'base64')
        const result = await multimodalIngest(fileBuffer, mimeType)

        return res.status(200).json(result)
    } catch (error) {
        console.error('[multimodal-ingest] Error:', error)
        return res.status(500).json({ error: error.message || 'Processing failed' })
    }
}
