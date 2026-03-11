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
                { text: "You are an expert travel data extraction engine for a premium trip planner. Analyze this booking document (Image, PDF, or Text). Extract the details into a strict JSON format matching the schema below.\n\n1. Extract all available data. If a field is not present, return null. DO NOT hallucinate.\n2. Format 'date' as an ISO 8601 string.\n3. Ensure 'amountPaid' is a pure number (remove currency symbols, commas, etc.).\n4. For 'confirmationNumber', look for PNR, Booking ID, or Reference Code.\n5. For flights or transit, format the 'location' string as \"Origin to Destination\" (e.g., \"Mactan-Cebu (CEB) to Ninoy Aquino (MNL)\").\n6. Output ONLY valid JSON. Do not include markdown formatting (like ```json) or any conversational text.\n\n<schema>\n{\n  \"type\": \"ENUM: [lodging, flight, activity, transport, other]\",\n  \"title\": \"String. A clear, human-readable name (e.g., 'AirAsia Flight Z2 123' or 'The Peninsula Hotel')\",\n  \"date\": \"String. ISO 8601 format for the start date/time, departure, or check-in.\",\n  \"location\": \"String. Address, venue name, or route.\",\n  \"confirmationNumber\": \"String. The primary confirmation code or PNR.\",\n  \"amountPaid\": \"Number. Numeric value of the total cost.\",\n  \"providerLink\": \"String. A URL to manage the booking or the vendor's website, if present.\",\n  \"notes\": \"String. A concise summary of passengers, cancellation policies, check-in instructions, or inclusions.\",\n  \"status\": \"ENUM: [confirmed (for final itineraries/receipts); requested (for pending/waitlisted); to_book (for quotes/drafts); idea (for general searches)]\"\n}\n</schema>" }
            ]
        }],
        generationConfig: {
            response_mime_type: "application/json"
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
