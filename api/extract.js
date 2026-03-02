// api/extract.js
import * as cheerio from 'cheerio'

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
    const rawBody = $('body').text().replace(/\s+/g, ' ').substring(0, 1500);
    return { title, description, siteName, rawBody, url };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'https://planner.vlbonite.co');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { url, activeTrip } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const tripCurrency = activeTrip?.currency || 'USD';
        const tripCities = activeTrip?.cities?.map(c => c.city).join(', ') || '';
        const tripName = activeTrip?.name || 'the selected destination';

        const scrapedData = await scrapeMetadata(url);

        const prompt = `
You are Wanda, a travel assistant. A user pasted this URL for a trip called "${tripName}" (cities: ${tripCities}).

URL: ${scrapedData.url}
Site: ${scrapedData.siteName}
Title: ${scrapedData.title}
Description: ${scrapedData.description}
Content snippet: ${scrapedData.rawBody}

Extract details and return ONLY a valid JSON object:
{
  "title": "Short, clean title of the place/activity",
  "type": "lodging",
  "priceDetails": "Price in ${tripCurrency} based on text. If unknown, write 'Price TBD'.",
  "description": "1-2 sentence catchy description.",
  "emoji": "🏡",
  "sourceName": "Airbnb, TripAdvisor, TikTok, etc."
}
type must be one of: "lodging", "activity", "food", "other".
Do not wrap in markdown.`;

        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://planner.vlbonite.co',
                'X-Title': 'Wanderplan',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-exp:free',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: { type: 'json_object' },
            }),
        });
        if (!aiRes.ok) throw new Error(`OpenRouter error ${aiRes.status}`);
        const aiData = await aiRes.json();
        return res.status(200).json(JSON.parse(aiData.choices[0].message.content));
    } catch (error) {
        console.error('[extract] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
