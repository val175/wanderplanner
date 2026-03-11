import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

// Internal logic for multimodal ingestion
export async function multimodalIngest(fileBuffer, mimeType) {
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured')

    // 1. Extraction with Gemini 3.1 Flash-Lite (Strict Priority: 500 RPD)
    const extractionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`
    
    // Convert buffer to base64
    const base64Content = fileBuffer.toString('base64')

    const extractionBody = {
        system_instruction: {
            parts: [{ text: `You are an expert travel data extraction engine. Analyze the provided document and extract details into structured JSON.
            
            ### CATEGORIZATION RULES (CRITICAL):
            Map to these exact types only:
            - 'lodging': For any stays, hotels, resorts, or Airbnbs.
            - 'flight': For any airline tickets, boarding passes, or flight receipts.
            - 'food': For restaurants, cafes, bars, or any dining receipts.
            - 'activity': For tours, tickets to attractions, or events.
            - 'transport': For rental cars, trains, buses, ferries, or transfers.
            - 'shopping': For retail purchases, souvenirs, or mall receipts.
            - 'concert': Specific music event tickets or receipts.
            - 'other': Anything that doesn't fit the above.

            ### FORMATTING:
            1. TITLE: Concise name (e.g., 'Marriott Cebu' or 'AirAsia Z2 123').
            2. DATE: Return YYYY-MM-DD only.
            3. AMOUNT: Number only.
            4. LOCATION: Specific address or route.
            `}]
        },
        contents: [{
            parts: [
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
            response_schema: {
                type: "OBJECT",
                properties: {
                    type: { type: "STRING", enum: ["lodging", "flight", "food", "activity", "transport", "shopping", "concert", "other"] },
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
