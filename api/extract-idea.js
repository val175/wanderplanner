import * as cheerio from 'cheerio'
import { GoogleGenAI } from '@google/genai'

async function scrapeMetadata(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': 'https://www.google.com/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Upgrade-Insecure-Requests': '1',
        }
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    const siteName = $('meta[property="og:site_name"]').attr('content') || '';
    const imageUrl = $('meta[property="og:image"]').attr('content')
        || $('meta[property="og: image"]').attr('content')   // TripAdvisor uses a space after the colon
        || $('meta[name="twitter:image"]').attr('content')
        || $('meta[name="twitter:image:src"]').attr('content')
        || '';
    const rawBody = $('body').text().replace(/\s+/g, ' ').substring(0, 1000);
    return { title, description, siteName, imageUrl, rawBody, url };
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

        // Best-effort scrape — if the site blocks us (403, 429, etc.) we fall back
        // to URL-only inference so the user still gets a useful result
        let scrapedData = { url, title: '', description: '', siteName: '', imageUrl: '', rawBody: '' };
        let scrapeWarning = '';
        try {
            scrapedData = await scrapeMetadata(url);
        } catch (scrapeErr) {
            console.warn('[extract-idea] Scrape failed, using URL-only fallback:', scrapeErr.message);
            scrapeWarning = `(Note: the page could not be fetched — ${scrapeErr.message}. Infer from the URL alone.)`;
        }

        // Many travel sites (Agoda, Expedia, etc.) inject og:image via React/JS at runtime,
        // so static cheerio scraping misses it. Microlink renders with a headless browser.
        if (!scrapedData.imageUrl) {
            try {
                const ml = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
                if (ml.ok) {
                    const mlJson = await ml.json();
                    scrapedData.imageUrl = mlJson?.data?.image?.url || '';
                }
            } catch (_) { /* non-fatal */ }
        }

        const hasScrapedContent = scrapedData.title || scrapedData.description || scrapedData.rawBody;

        // imageUrl is NOT passed through Gemini — LLMs corrupt URLs (truncation,
        // re-encoding of &amp; etc). We inject it directly from the scrape result below.
        const prompt = hasScrapedContent
            ? `You are Wanda, a travel planner. A user pasted this URL: ${scrapedData.url}
        Scraped data:
        Site Name: ${scrapedData.siteName}
        Title: ${scrapedData.title}
        Description: ${scrapedData.description}
        Raw Text Snippet: ${scrapedData.rawBody}
        Extract details and return ONLY a valid JSON object matching this schema:
        {
          "title": "Short, clean title of the place/activity",
          "type": "lodging",
          "priceDetails": "Best-effort price estimate in ${currency}. Use text clues if available. If unknown, make a reasonable market estimate and add '(est.)' — never leave blank.",
          "description": "A short 1-2 sentence catchy description.",
          "emoji": "🏡",
          "sourceName": "Airbnb, TripAdvisor, TikTok, etc."
        }
        Rules:
        - priceDetails format: "₱2500/night" or "₱1200/person" or "₱8000 (est.)" — always include a slash + period unit or '(est.)' suffix.
        Do not wrap in markdown blocks.`
            : `You are Wanda, a travel planner. A user pasted this URL: ${url}
        ${scrapeWarning}
        Based on the URL alone, make your best guess and return ONLY a valid JSON object matching this schema:
        {
          "title": "Short, clean title of the place/activity inferred from the URL",
          "type": "lodging",
          "priceDetails": "Make a reasonable market-rate estimate in ${currency} for this type of place/activity and add '(est.)' — never leave blank.",
          "description": "A short 1-2 sentence description based on what you can infer from the URL.",
          "emoji": "🔗",
          "sourceName": "Infer from the domain (e.g. airbnb.com → Airbnb)"
        }
        Do not wrap in markdown blocks.`;

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY });
        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: { temperature: 0.1, responseMimeType: 'application/json' }
        });

        let cleanJSONString = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const geminiData = JSON.parse(cleanJSONString);

        // Merge: Gemini handles text inference, scraper owns imageUrl exactly as-is
        return res.status(200).json({ ...geminiData, imageUrl: scrapedData.imageUrl || '' });
    } catch (error) {
        console.error('[extract-idea] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
