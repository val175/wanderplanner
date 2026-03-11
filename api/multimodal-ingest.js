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
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Content
                    }
                },
                { text: "You are an expert travel data extraction engine for a premium trip planner. Analyze this booking document (Image, PDF, or Text). Extract the details into the strict JSON format defined in the response schema.\n\n### GUIDELINES:\n1. **TITLE**: Create a clear, human-readable name (e.g., 'AirAsia Flight Z2 123' or 'The Peninsula Hotel'). If it's a receipt, name it after the merchant.\n2. **TYPE**: Map to the most relevant category: [lodging, flight, activity, transport, other].\n3. **DATE**: Use ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ). For lodging, use Check-In. For flights, use Departure time.\n4. **LOCATION**: Provide the address, venue name, or route (e.g., 'Manila to Cebu').\n5. **AMOUNT**: Extract the pure numeric value of the total cost (remove currency symbols like $, ₱, €, or commas).\n6. **NOTES**: Summarize key details like passengers, check-in instructions, or cancellation policies.\n7. **CONFIRMATION**: Find the PNR, Booking ID, or Reference Code.\n8. **STATUS**: Set to 'confirmed' for receipts/confirmed bookings, 'requested' for pending, 'to_book' for quotes, and 'idea' for general info.\n\nDO NOT hallucinate. If a value is absolutely not present, return null for that field." }
            ]
        }],
        generationConfig: {
            response_mime_type: "application/json",
            response_schema: {
                type: "OBJECT",
                properties: {
                    type: { type: "STRING", enum: ["lodging", "flight", "activity", "transport", "other"] },
                    title: { type: "STRING" },
                    date: { type: "STRING" },
                    location: { type: "STRING" },
                    confirmationNumber: { type: "STRING" },
                    amountPaid: { type: "NUMBER" },
                    providerLink: { type: "STRING" },
                    notes: { type: "STRING" },
                    status: { type: "STRING", enum: ["confirmed", "requested", "to_book", "idea"] }
                },
                required: ["type", "title", "date", "location", "status"]
            }
        }
    }

    console.log(`[multimodal-ingest] Requesting extraction for mimeType: ${mimeType}`)

    const extractionResponse = await fetch(extractionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractionBody)
    })

    if (!extractionResponse.ok) {
        const err = await extractionResponse.json()
        console.error('[multimodal-ingest] Gemini API Error:', err)
        throw new Error(`Extraction failed: ${err.error?.message || extractionResponse.statusText}`)
    }

    const extractionData = await extractionResponse.json()
    const textResult = extractionData.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!textResult) {
        console.error('[multimodal-ingest] No text returned from Gemini:', extractionData)
        throw new Error('No extraction result returned from AI')
    }

    console.log('[multimodal-ingest] Raw Text Result:', textResult)
    const parsedData = JSON.parse(textResult)
    console.log('[multimodal-ingest] Parsed Data:', parsedData)

    // 2. Embedding with Gemini Embedding 2 (MRL)
    const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key=${geminiKey}`
    
    // Create a string representation for embedding
    const embeddingInput = `${parsedData.type} ${parsedData.title} ${parsedData.date} ${parsedData.location}`

    const embeddingBody = {
        model: "models/gemini-embedding-2-preview",
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
