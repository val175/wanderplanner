import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

export async function extractTripFromPdf(fileUrl) {
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured')

    // Fetch the PDF from the public URL and convert to base64 inline_data
    const pdfResponse = await fetch(fileUrl)
    if (!pdfResponse.ok) {
        throw new Error(`Failed to fetch PDF from storage: ${pdfResponse.statusText}`)
    }
    const pdfBuffer = await pdfResponse.arrayBuffer()
    const base64Content = Buffer.from(pdfBuffer).toString('base64')

    const extractionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`
    
    const promptText = `
You are an expert travel assistant. Extract the travel itinerary from this document and output a STRICT JSON object representing a "Trip Draft".

Requirements:
1. Extract all logical destinations mentioned (cities/regions).
2. Attempt to infer a start Date and end Date if mentioned (ISO 8601 format: YYYY-MM-DD). If no specific dates are mentioned but duration is (e.g., "7 days"), leave dates empty. If no dates are mentioned, leave them empty strings "".
3. Suggest a fun "name" for the trip based on the document (e.g. "2 Weeks Backpacking Vietnam")
4. Suggest a single relevant emoji for the trip.
5. Create budget categories based on standard travel needs (Flights, Accommodation, Food, Activities, Transport).
   - If the document mentions specific expected costs, use those.
   - CRITICAL: If costs are not mentioned, use your world knowledge to infer realistic estimates for a middle-class traveler in PHP (Philippine Pesos) for the full trip duration.
   - ALL COSTS MUST BE IN PHP. Convert from USD/EUR/AUD/etc. using current approximate exchange rates.
6. CRITICAL: Every activity MUST have a "duration" (Integer, in minutes) and "endTime" (String, HH:mm). 
   - Estimate durations based on the activity type (e.g., 90m for meals, 120m for museums, 120m-240m for flights, 30m for quick stops) if the source text doesn't specify.
   - Calculate "endTime" based on "time" + "duration".
   - If "time" is missing for an activity, still provide a "duration" and "endTime" based on your best guess of when the activity would likely happen.

- For categories: Choose the closest fit from the list (lodging, flight, food, activity, transport, shopping, concert, other) based on the name/context. Use 'other' if unsure.
`

    const extractionBody = {
        system_instruction: {
            parts: [{ text: promptText }]
        },
        contents: [{
            parts: [
                {
                    inline_data: {
                        mime_type: 'application/pdf',
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
                  name: { type: "STRING" },
                  emoji: { type: "STRING" },
                  startDate: { type: "STRING" },
                  endDate: { type: "STRING" },
                  destinations: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        city: { type: "STRING" },
                        country: { type: "STRING" }
                      }
                    }
                  },
                  currency: { type: "STRING" },
                  budgetCategories: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        emoji: { type: "STRING" },
                        min: { type: "NUMBER" },
                        max: { type: "NUMBER" }
                      }
                    }
                  },
                  todos: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            text: { type: "STRING" },
                            category: { type: "STRING" }
                        }
                    }
                  },
                  itinerary: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        dayNumber: { type: "INTEGER" },
                        date: { type: "STRING" },
                        location: { type: "STRING" },
                        activities: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            properties: {
                              time: { type: "STRING" },
                              duration: { type: "INTEGER" },
                              endTime: { type: "STRING" },
                              category: { type: "STRING" },
                              name: { type: "STRING" },
                              emoji: { type: "STRING" },
                              location: { type: "STRING" },
                              estCost: { type: "STRING" },
                              transit: { type: "STRING" },
                              transitEmoji: { type: "STRING" },
                              notes: { type: "STRING" }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                required: ["name", "emoji", "destinations", "currency", "budgetCategories", "itinerary"]
            }
        }
    }

    console.log(`[extract-trip-pdf] Requesting extraction for fileUrl: ${fileUrl} (${(pdfBuffer.byteLength / 1024).toFixed(1)} KB)`)

    const extractionResponse = await fetch(extractionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractionBody)
    })

    if (!extractionResponse.ok) {
        const err = await extractionResponse.json()
        console.error('[extract-trip-pdf] Gemini API Error:', err)
        throw new Error(`Extraction failed: ${err.error?.message || extractionResponse.statusText}`)
    }

    const extractionData = await extractionResponse.json()
    const textResult = extractionData.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!textResult) {
        console.error('[extract-trip-pdf] No text returned from Gemini:', extractionData)
        throw new Error('No extraction result returned from AI')
    }

    return JSON.parse(textResult)
}

export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization
        await verifyFirebaseToken(authHeader)

        const { fileUrl } = req.body
        if (!fileUrl) {
            return res.status(400).json({ error: 'Missing fileUrl in request body' })
        }

        const draftJson = await extractTripFromPdf(fileUrl)
        return res.status(200).json({ success: true, data: draftJson })
    } catch (error) {
        console.error('[extract-trip-pdf] Error:', error)
        return res.status(500).json({ success: false, error: error.message || 'Processing failed' })
    }
}
