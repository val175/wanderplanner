import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

export async function extractTripFromPdf(base64Content) {
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured')

    // gemini-3.1-flash-lite — confirmed working on this project's free plan + v1beta
    const extractionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`

    const prompt = `
You are an expert travel data extraction engine. Read the attached PDF and extract its COMPLETE day-by-day itinerary into a structured JSON Trip Draft.

CRITICAL RULES — READ CAREFULLY:
- You MUST extract EVERY single day from the document. Do NOT skip any day.
- You MUST extract EVERY activity row within each day. Do NOT summarize or combine rows.
- If the PDF has a table with columns like Time / Activity / Budget / Notes, extract each row as a separate activity object.
- Do not hallucinate activities. Only include what is explicitly written in the PDF.
- If a budget amount is listed per activity, use it as estCost (in PHP unless otherwise stated).
- Dates: If the document says "Day 00 – August 20, Thursday", set dayNumber=0, date="2026-08-20", and infer startDate/endDate from the first and last day found.
- endDate MUST be set to the date of the LAST day in the document.
- For each activity: infer category from context (lodging/flight/food/activity/transport/shopping/concert/other).
- For each activity: estimate duration in minutes and calculate endTime = time + duration.
- estCost: include the currency symbol if present (e.g. "₱3,500" or "3500.00"). Use the raw value from the PDF.
- notes: include hotel options, tips, or any side notes from the PDF's Notes column.
- transitEmoji: default to 🚕 unless a specific mode is obvious (✈️ flight, 🚗 car, 🚌 bus, 🛥️ ferry).

The output MUST be a single raw JSON object matching this exact schema. DO NOT wrap in markdown. DO NOT add any explanation text.

{
  "name": "String — creative trip name based on the document",
  "emoji": "String — single emoji",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "destinations": [
    { "city": "String", "country": "String" }
  ],
  "currency": "PHP",
  "budgetCategories": [
    { "name": "Flights", "emoji": "✈️", "min": 0, "max": 0 },
    { "name": "Accommodation", "emoji": "🏨", "min": 0, "max": 0 },
    { "name": "Food", "emoji": "🍜", "min": 0, "max": 0 },
    { "name": "Activities", "emoji": "🎯", "min": 0, "max": 0 },
    { "name": "Transport", "emoji": "🚗", "min": 0, "max": 0 }
  ],
  "todos": [
    { "text": "String — booking task or logistical note", "category": "String" }
  ],
  "itinerary": [
    {
      "dayNumber": 0,
      "date": "YYYY-MM-DD",
      "location": "String — main city/area for the day",
      "activities": [
        {
          "time": "HH:MM AM/PM",
          "duration": 60,
          "endTime": "HH:mm",
          "category": "String — one of: lodging, flight, food, activity, transport, shopping, concert, other",
          "name": "String — exact activity name from the PDF",
          "emoji": "String — single semantic emoji",
          "location": "String — specific venue or route",
          "estCost": "String — exact amount from PDF, e.g. ₱3,500",
          "transit": "String — how to get to next spot, or empty",
          "transitEmoji": "🚕",
          "notes": "String — raw notes/hotel options from PDF, or empty"
        }
      ]
    }
  ]
}

Now extract the full itinerary from the attached PDF. Every day. Every row.
`

    const extractionBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: 'application/pdf',
                        data: base64Content
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1
            // No response_mime_type — free text output avoids JSON truncation on large itineraries
        }
    }

    console.log(`[extract-trip-pdf] Extracting with gemini-2.5-flash — ${(base64Content.length * 0.75 / 1024).toFixed(1)} KB`)

    const extractionResponse = await fetch(extractionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractionBody)
    })

    if (!extractionResponse.ok) {
        const err = await extractionResponse.json().catch(() => ({}))
        console.error('[extract-trip-pdf] Gemini API Error:', err)
        throw new Error(`Extraction failed: ${err.error?.message || extractionResponse.statusText}`)
    }

    const extractionData = await extractionResponse.json()
    const textResult = extractionData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!textResult) {
        console.error('[extract-trip-pdf] No text returned from Gemini:', extractionData)
        throw new Error('No extraction result returned from AI')
    }

    // Strip any accidental markdown fences the model may have added
    const clean = textResult.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(clean)
}

export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization
        await verifyFirebaseToken(authHeader)

        const { file } = req.body
        if (!file) {
            return res.status(400).json({ error: 'Missing file (base64) in request body' })
        }

        const draftJson = await extractTripFromPdf(file)
        return res.status(200).json({ success: true, data: draftJson })
    } catch (error) {
        console.error('[extract-trip-pdf] Error:', error)
        return res.status(500).json({ success: false, error: error.message || 'Processing failed' })
    }
}
