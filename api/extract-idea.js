import * as cheerio from 'cheerio'
import { GoogleGenAI } from '@google/genai'

async function scrapeMetadata(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    const siteName = $('meta[property="og:site_name"]').attr('content') || '';
    const rawBody = $('body').text().replace(/\s+/g, ' ').substring(0, 1000);
    return { title, description, siteName, rawBody, url };
}

export default async function handler(req, res) {
    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://planner.vlbonite.co');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle the preflight OPTIONS request immediately
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Rest of your POST logic...
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { url, currency = 'PHP' } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });
        const scrapedData = await scrapeMetadata(url);
        const prompt = `
        You are Wanda, a travel planner. A user pasted this URL: ${scrapedData.url}
        Scraped data:
        Site Name: ${scrapedData.siteName}
        Title: ${scrapedData.title}
        Description: ${scrapedData.description}
        Raw Text Snippet: ${scrapedData.rawBody}
        Extract details and return ONLY a valid JSON object matching this schema:
        {
          "title": "Short, clean title of the place/activity",
          "type": "lodging", // Must be "lodging", "activity", "food", or "other"
          "priceDetails": "Guess price format based on text. Format in ${currency}",
          "description": "A short 1-2 sentence catchy description.",
          "emoji": "🏡", // 1 single relevant emoji
          "sourceName": "Airbnb, TripAdvisor, TikTok, etc."
        }
        Do not wrap in markdown blocks.
    `;

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY });
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: { temperature: 0.1, responseMimeType: 'application/json' }
        });

        let cleanJSONString = result.text.replace(/```json/g, '').replace(/```/g, '').trim();

        return res.status(200).json(JSON.parse(cleanJSONString));
    } catch (error) {
        console.error('[extract-idea] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
