import * as cheerio from 'cheerio'
import { GoogleGenAI } from '@google/genai'
import 'dotenv/config'

// We don't initialize `ai` at the top level anymore because Vercel Serverless Functions
// sometimes load the file BEFORE injecting the environment variables on cold start.
// Instead, we instantiate it when needed inside the function scope.

/**
 * Extracts the main article text from a given URL using a headless browser.
 */
async function extractArticleText(url) {
    try {
        console.log(`[extract-trip] Fetching HTML from ${url}...`)

        // We use a regular fetch, but pretend to be a standard Mac Chrome browser
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
        // Continue existing cheerio parsing

        // Parse HTML with cheerio to do some initial cleanup (remove scripts, styles, etc)
        const $ = cheerio.load(html)
        $('script, style, noscript, nav, header, footer, aside, iframe, SVG, .ad, .advertisement').remove()
        const cleanHtml = $.html()

        // Custom text extraction: instead of Readability (which uses JSDOM and breaks on Vercel ESM),
        // we'll explicitly pull text from headings, paragraphs, and lists.
        const contentChunks = []

        $('h1, h2, h3, h4, h5, h6, p, li').each((_, el) => {
            const text = $(el).text().trim()
            if (text) {
                // Determine if it's a heading based on tag name
                const isHeading = el.tagName.match(/^h[1-6]$/i)
                contentChunks.push(isHeading ? `\n## ${text}\n` : text)
            }
        })

        const rawText = contentChunks.join('\n')

        if (!rawText) {
            throw new Error("Could not extract main article content from this URL.")
        }

        // Compress massive amounts of whitespace
        const compressedText = rawText.replace(/\n\s*\n/g, '\n\n').trim()

        // Extract title
        const parsedTitle = $('title').text().trim() || 'Imported Trip'

        return { title: parsedTitle, content: compressedText }

    } catch (error) {
        console.error("Extraction error:", error)
        throw new Error(`Failed to extract content: ${error.message}`)
    }
}

/**
 * Parses article text into a structured Trip Draft using Gemini
 */
async function parseTripWithGemini(articleTitle, articleText) {
    const prompt = `
You are an expert travel assistant. I am providing you the text extracted from a travel blog post: "${articleTitle}".

Your task is to extract the travel itinerary and output a STRICT JSON object representing a "Trip Draft".

Requirements:
1. Extract all logical destinations mentioned (cities/regions).
2. Attempt to infer a start Date and end Date if mentioned (ISO 8601 format: YYYY-MM-DD). If no specific dates are mentioned but duration is (e.g., "7 days"), leave dates empty. If no dates are mentioned, leave them empty strings "".
3. Suggest a fun "name" for the trip based on the article (e.g. "2 Weeks in Backpacking Vietnam")
4. Suggest a single relevant emoji for the trip.
5. Create budget categories based on standard travel needs (Flights, Accommodation, Food, Activities, Transport). 
   - If the article mentions specific expected costs, use those.
   - CRITICAL: If the blog DOES NOT mention specific costs for a category, DO NOT leave it at 0. You MUST use your own world knowledge to infer a realistic, rough estimate for a middle-class traveler for the TOTAL DURATION of the itinerary described.
   - For example, a 10-day trip to Europe should realistically cost upwards of 50,000+ PHP, not 500 PHP. 
   - ALL COSTS MUST BE CONVERTED AND ESTIMATED IN PHP (Philippine Pesos). If the blog quotes prices in USD, EUR, AUD, or other currencies, you MUST mathematically convert them to PHP using current approximate exchange rates.
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
     { "name": "Food", "emoji": "🍜", "min": 400, "max": 506 },
     { "name": "Activities", "emoji": "🎯", "min": 20, "max": 970 }
  ],
  "todos": [
     { "text": "String (Activity, sight to see, or task mentioned)", "category": "String (e.g. Activity, Sightseeing, Admin, Tech)" }
  ]
}

DO NOT wrap the response in markdown blocks (no \`\`\`json). Output RAW JSON only.

Blog Post Content:
---
${articleText.substring(0, 30000)} // Limiting length to be safe
---
`

    try {
        // Initialize AI client here where the environment variables are guaranteed to be loaded
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.1, // Keep it deterministic
                responseMimeType: 'application/json'
            }
        })

        // In the new @google/genai SDK, .text is a property, not a function
        const rawJSON = response.text;

        // Remove markdown formatting if Gemini wrapped it in ```json blocks anyway
        const cleanJSONString = rawJSON.replace(/```json/g, '').replace(/```/g, '').trim()

        return JSON.parse(cleanJSONString)
    } catch (error) {
        console.error("Gemini Parsing error:", error)
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
        const { url } = req.body

        if (!url) {
            return res.status(400).json({ error: 'URL is required in the request body.' })
        }

        // Ensure API Key exists
        if (!process.env.GEMINI_API_KEY) {
            console.error("ERROR: GEMINI_API_KEY is not set in environment variables.")
            return res.status(500).json({ error: "Server misconfiguration: AI API key missing." })
        }

        console.log(`[extract-trip] Processing URL: ${url}`)

        // 1. Scrape the URL
        const { title, content } = await extractArticleText(url)
        console.log(`[extract-trip] Successfully extracted ${content.length} characters from: ${title}`)

        // 2. Parse with AI
        const draftJson = await parseTripWithGemini(title, content)
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
