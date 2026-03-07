import * as cheerio from 'cheerio'
import 'dotenv/config'
import { callOpenRouter } from './_openrouter.js'
import { verifyFirebaseToken } from './_auth.js'

// We don't initialize `ai` at the top level anymore because Vercel Serverless Functions
// sometimes load the file BEFORE injecting the environment variables on cold start.
// Instead, we instantiate it when needed inside the function scope.

/**
 * Extracts a compact, structured summary from a travel blog URL.
 * Uses heading-first extraction: og:meta + (heading + first snippet per section).
 * Targets ~3–6k chars instead of a 30k full-text dump.
 */
async function extractArticleText(url) {
    try {
        console.log(`[extract-trip] Fetching HTML from ${url}...`)

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html)

        // Compact meta info (same approach as the voting room scraper)
        const title = $('meta[property="og:title"]').attr('content')
            || $('title').text().trim()
            || 'Imported Trip'
        const description = $('meta[property="og:description"]').attr('content')
            || $('meta[name="description"]').attr('content')
            || ''

        // Strip noise before extracting content
        $('script, style, noscript, nav, header, footer, aside, iframe, .ad, .advertisement, .comments, .sidebar, .related-posts, .newsletter').remove()

        $('a').each((_, el) => {
            const text = $(el).text().trim().toLowerCase();
            if (
                text.includes('read more') ||
                text.includes('click here') ||
                text.includes('affiliate') ||
                text.includes('commission') ||
                text.includes('continue reading') ||
                text.includes('buy now') ||
                text.includes('book here')
            ) {
                $(el).remove();
            }
        })

        // Heading-first extraction: travel blogs are structured by day headings.
        // Grab each heading + the first meaningful snippet after it (~250 chars).
        const sections = []
        $('h2, h3, h4').each((_, el) => {
            const headingText = $(el).text().trim()
            if (!headingText || headingText.length < 3) return

            let snippet = ''
            let sibling = $(el).next()
            while (sibling.length && !snippet && !sibling.is('h1,h2,h3,h4')) {
                const text = sibling.text().trim()
                if (text) snippet = text.substring(0, 250)
                sibling = sibling.next()
            }
            sections.push(snippet ? `## ${headingText}\n${snippet}` : `## ${headingText}`)
        })

        let content
        if (sections.length >= 3) {
            // Well-structured blog — headings + snippets give the AI all it needs
            content = sections.join('\n\n')
        } else {
            // Fallback: flat body text, tightly capped at 6k chars
            const bodyChunks = []
            $('h1, h2, h3, p, li').each((_, el) => {
                const text = $(el).text().trim()
                if (text) bodyChunks.push(text)
            })
            content = bodyChunks.join('\n').substring(0, 6000)
        }

        if (!content) throw new Error("Could not extract main article content from this URL.")

        console.log(`[extract-trip] Extracted ${content.length} chars across ${sections.length} sections`)
        return { title, description, content }

    } catch (error) {
        console.error("Extraction error:", error)
        throw new Error(`Failed to extract content: ${error.message}`)
    }
}

/**
 * Parses compact article data into a structured Trip Draft using OpenRouter
 */
async function parseTripWithAI({ title, description, content }) {
    const prompt = `
You are an expert travel assistant. Extract the travel itinerary from this blog post and output a STRICT JSON object representing a "Trip Draft".

Title: "${title}"${description ? `\nSummary: ${description}` : ''}

Requirements:
1. Extract all logical destinations mentioned (cities/regions).
2. Attempt to infer a start Date and end Date if mentioned (ISO 8601 format: YYYY-MM-DD). If no specific dates are mentioned but duration is (e.g., "7 days"), leave dates empty. If no dates are mentioned, leave them empty strings "".
3. Suggest a fun "name" for the trip based on the article (e.g. "2 Weeks Backpacking Vietnam")
4. Suggest a single relevant emoji for the trip.
5. Create budget categories based on standard travel needs (Flights, Accommodation, Food, Activities, Transport).
   - If the article mentions specific expected costs, use those.
   - CRITICAL: If costs are not mentioned, use your world knowledge to infer realistic estimates for a middle-class traveler in PHP (Philippine Pesos) for the full trip duration.
   - ALL COSTS MUST BE IN PHP. Convert from USD/EUR/AUD/etc. using current approximate exchange rates.
6. The exact output MUST be a valid JSON matching this schema:

{
  "name": "String (Suggested Name)",
  "emoji": "String (Single Emoji)",
  "startDate": "String (YYYY-MM-DD or empty)",
  "endDate": "String (YYYY-MM-DD or empty)",
  "destinations": [
    {
      "city": "String (City or Region name)",
      "country": "String (Country Name)"
    }
  ],
  "currency": "PHP",
  "budgetCategories": [
     { "name": "Flights", "emoji": "✈️", "min": 0, "max": 0 },
     { "name": "Accommodation", "emoji": "🏨", "min": 0, "max": 0 },
     { "name": "Food", "emoji": "🍜", "min": 0, "max": 0 },
     { "name": "Activities", "emoji": "🎯", "min": 0, "max": 0 }
  ],
  "todos": [
     { "text": "String (Activity, sight to see, or task mentioned)", "category": "String (e.g. Activity, Sightseeing, Admin, Tech)" }
  ],
  "itinerary": [
     {
        "dayNumber": 1,
        "date": "String (YYYY-MM-DD or empty)",
        "location": "String (Main area for the day or empty)",
        "activities": [
           {
              "time": "String (e.g. 09:00 AM or empty)",
              "name": "String (Activity name)",
              "emoji": "String (Single semantic emoji)",
              "location": "String (Specific venue or address)",
              "estCost": "String (e.g. ₱500 or empty)",
              "transit": "String (e.g. 15 mins to next spot or empty)",
              "transitEmoji": "String (e.g. 🚕, 🚇, 🚶, ✈️) or default to 🚕",
              "notes": "String (Any tips or context or empty)"
           }
        ]
     }
  ]
}

DO NOT wrap the response in markdown blocks (no \`\`\`json). Output RAW JSON only.

Blog Content:
---
${content}
---
`

    try {
        const aiData = await callOpenRouter(process.env.OPENROUTER_API_KEY, {
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
        });
        const rawJSON = aiData.choices[0].message.content;
        const cleanJSONString = rawJSON.replace(/```json/g, '').replace(/```/g, '').trim()
        return JSON.parse(cleanJSONString)
    } catch (error) {
        console.error("AI Parsing error:", error)
        throw new Error("AI failed to parse the itinerary from the text.")
    }
}

export default async function handler(req, res) {
    // Enable CORS for frontend deployments (like Hostinger) to access this Vercel function
    res.setHeader('Access-Control-Allow-Origin', '*') // Allow any origin to hit this API
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    )

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        try {
            await verifyFirebaseToken(authHeader);
        } catch (authError) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { url } = req.body

        if (!url) {
            return res.status(400).json({ error: 'URL is required in the request body.' })
        }

        // Ensure API Key exists
        if (!process.env.OPENROUTER_API_KEY) {
            console.error("ERROR: OPENROUTER_API_KEY is not set in environment variables.")
            return res.status(500).json({ error: "Server misconfiguration: AI API key missing." })
        }

        console.log(`[extract-trip] Processing URL: ${url}`)

        // 1. Scrape the URL
        const scraped = await extractArticleText(url)
        console.log(`[extract-trip] Successfully extracted ${scraped.content.length} chars from: ${scraped.title}`)

        // 2. Parse with AI
        const draftJson = await parseTripWithAI(scraped)
        console.log(`[extract-trip] Successfully parsed trip data.`)

        // 3. Return the result
        return res.status(200).json({ success: true, data: draftJson })

    } catch (error) {
        console.error('[extract-trip] API Error:', error)
        return res.status(500).json({
            success: false,
            error: error.message || 'An unexpected error occurred while processing the trip.'
        })
    }
}
