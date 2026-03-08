import { callOpenRouter } from './_openrouter.js'
import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

export default async function handler(req, res) {
    setCorsHeaders(res)
    if (req.method === 'OPTIONS') return res.status(200).end()

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        try {
            await verifyFirebaseToken(authHeader);
        } catch (authError) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { tripName, destinations, startDate, endDate } = req.body;

        const destString = destinations && destinations.length > 0
            ? destinations.map(d => d.city).join(', ')
            : 'an unknown destination';

        const datesString = startDate && endDate ? `from ${startDate} to ${endDate}` : 'with unknown dates';

        const prompt = `You are Wanda, an expert AI travel planner. Your task is to generate a comprehensive, intelligent travel checklist for a trip.
        
Trip Details:
- Name: ${tripName || 'Untitled Trip'}
- Destination(s): ${destString}
- Dates: ${datesString}

Based on the destination, climate, and typical travel requirements, generate a pragmatic checklist of 8-12 actionable tasks. Assign each task to one of the following phases:
1. "planning" (e.g., Book flights, Apply for visa, Reserve JR Pass)
2. "booking" (e.g., Book accommodation in Shinjuku, Reserve Michelin star restaurant)
3. "packing" (e.g., Buy thermal layers for winter, Pack universal adapter)
4. "pre_departure" (e.g., Check-in online, Notify bank of travel)

Return ONLY a valid JSON object matching exactly this schema:
{
  "todos": [
    {
      "text": "Task title",
      "category": "planning|booking|packing|pre_departure",
      "note": "A short 1-2 sentence context or detail, e.g. 'Use the official site to avoid scalper fees.'"
    }
  ]
}

No markdown tags or additional text. Just the raw JSON object.`;

        const aiData = await callOpenRouter(process.env.OPENROUTER_API_KEY, {
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
        });

        let content = aiData.choices[0].message.content.trim();
        // Remove markdown formatting if the model still outputs it
        if (content.startsWith('\`\`\`json')) {
            content = content.replace(/^\`\`\`json\n?/, '').replace(/\n?\`\`\`$/, '');
        } else if (content.startsWith('\`\`\`')) {
            content = content.replace(/^\`\`\`\n?/, '').replace(/\n?\`\`\`$/, '');
        }

        const checklistData = JSON.parse(content);

        return res.status(200).json(checklistData);
    } catch (error) {
        console.error('[generate-checklist] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
