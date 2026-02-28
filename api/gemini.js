export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        // Vercel environment variables
        const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
        if (!apiKey) {
            console.error("Gemini API Key missing in Vercel environment variables")
            return res.status(500).json({ error: 'Server misconfiguration: AI API key missing.' })
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            return res.status(response.status).json(err)
        }

        const data = await response.json()
        return res.status(200).json(data)
    } catch (error) {
        console.error('Gemini Proxy Error:', error)
        return res.status(500).json({ error: error.message || 'Internal Server Error' })
    }
}
