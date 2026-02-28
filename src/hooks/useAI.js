/**
 * useAI.js
 * Gemini 2.0 Flash wrapper for Wanderplan.
 * Builds a trip-aware system prompt from the active trip's state,
 * so every response is grounded in the user's actual trip data.
 */

// Requests go to our Vercel Serverless Function proxy to protect the API key
const PROXY_URL = 'https://wanderplan-rust.vercel.app/api/gemini'

/**
 * Build a rich system prompt from the active trip.
 * This is what makes the AI feel "trip-aware" instead of generic.
 */
export function buildTripSystemPrompt(trip) {
  if (!trip) {
    return `You are Wanda, a friendly AI travel assistant built into Wanderplan, a trip planning app.
Help users plan trips, suggest activities, recommend restaurants, give packing advice, and optimize itineraries.
Be concise, warm, and practical. Use emojis sparingly. The user hasn't selected a trip yet, so give general travel advice.`
  }

  const cities = trip.cities?.map(c => `${c.flag} ${c.city}, ${c.country}`).join(' → ') || 'Not specified'
  const travelers = trip.travelers || 1
  const startDate = trip.startDate || 'TBD'
  const endDate = trip.endDate || 'TBD'

  // Use the trip's own currency — fall back to PHP if unset
  const currency = trip.currency || 'PHP'
  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', PHP: '₱', AUD: 'A$', CAD: 'C$', SGD: 'S$', HKD: 'HK$', THB: '฿', IDR: 'Rp', KRW: '₩', MYR: 'RM', VND: '₫', INR: '₹' }
  const sym = currencySymbols[currency] || currency

  const daysCount = trip.itinerary?.length || 0
  const activitiesCount = trip.itinerary?.reduce((sum, d) => sum + (d.activities?.length || 0), 0) || 0

  const budgetSummary = trip.budget?.length
    ? trip.budget.map(b => `${b.emoji || ''} ${b.name}: ${sym}${b.max} budget (${sym}${b.actual || 0} spent)`).join(', ')
    : 'No budget set'

  const totalBudget = trip.budget?.reduce((s, b) => s + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0

  const bookings = trip.bookings || []
  const confirmedBookings = bookings.filter(b => b.status === 'booked' || b.status === 'confirmed').length
  const pendingBookings = bookings.filter(b => b.status !== 'booked').length

  const todos = trip.todos || []
  const doneTodos = todos.filter(t => t.done).length

  const packingList = trip.packingList || []
  const packed = packingList.filter(p => p.packed).length

  const itinerarySummary = trip.itinerary?.slice(0, 5).map(d =>
    `Day ${d.dayNumber} (${d.location || 'location TBD'}): ${d.activities?.map(a => a.name).join(', ') || 'no activities yet'}`
  ).join('\n') || 'No itinerary yet'

  return `You are Wanda, a friendly AI travel assistant built into Wanderplan.
You are helping plan this specific trip:

🌍 TRIP: "${trip.name || 'Unnamed Trip'}" ${trip.emoji || '✈️'}
📍 Route: ${cities}
📅 Dates: ${startDate} → ${endDate} (${daysCount} days planned)
👥 Travelers: ${travelers}

💰 BUDGET (currency: ${currency}):
${budgetSummary}
Total: ${sym}${totalBudget} budget, ${sym}${totalSpent} spent, ${sym}${totalBudget - totalSpent} remaining

✈️ BOOKINGS: ${confirmedBookings} confirmed, ${pendingBookings} pending
✅ TODOS: ${doneTodos}/${todos.length} done
🧳 PACKING: ${packed}/${packingList.length} packed

📋 ITINERARY PREVIEW:
${itinerarySummary}

Your role:
- Give specific, actionable advice tailored to THIS trip's cities, budget, and timeline
- Be concise — 2-4 sentences per response unless the user asks for a detailed list
- ALWAYS use ${currency} (${sym}) when discussing money — NEVER use any other currency symbol
- Use emojis sparingly (1-2 per response max)
- When suggesting activities, consider the budget remaining (${sym}${totalBudget - totalSpent})
- If the user asks to "optimize" or "improve" something, give concrete suggestions
- Be warm and conversational, like a knowledgeable travel-savvy friend`
}

/**
 * Send a message to Gemini with full conversation history.
 * @param {string} systemPrompt - The trip-aware system prompt
 * @param {Array<{role: 'user'|'model', text: string}>} history - Prior messages
 * @param {string} userMessage - The new user message
 * @returns {Promise<string>} The AI's reply text
 */
export async function sendMessage(systemPrompt, history, userMessage) {
  // Gemini uses 'contents' array for history; 'user' and 'model' roles
  const contents = [
    ...history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ]

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 512,
    },
  }

  // If local API key exists in DEV, use it instantly to avoid proxy CORS failures
  const apiKey = import.meta.env.DEV ? import.meta.env.VITE_GEMINI_API_KEY : null
  if (apiKey) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || `Gemini API error ${res.status}`)
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('No response from Gemini API')
    return text
  }

  // Fallback to proxy
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No response from Gemini')
  return text
}

/**
 * Generate an auto-filled city guide (Weather, Currency, Must-Do).
 * Requests JSON format from Gemini to easily map to the city object.
 */
export async function generateCityGuide(city, trip) {
  const prompt = `
You are Wanda, a travel assistant.
The user is traveling to: ${city.city}, ${city.country}.
Trip Dates: ${trip.startDate || 'Unknown'} to ${trip.endDate || 'Unknown'}.
Trip Currency: ${trip.currency || 'USD'}.

Please generate a quick travel guide for this city.
Return ONLY a valid JSON object with the following exact keys and format:

{
  "weather": "🌸 MARCH AVG\\n14°C / 5°C",
  "currencyTip": "¥ CURRENCY\\n1 USD = 150 JPY",
  "mustDo": "Neon lights, ancient temples, and the best food in the world. Don't miss the Shibuya Scramble, teamLab Planets, and eating ramen in Shinjuku."
}

Rules:
1. "weather": Based on the trip dates (or general averages if unknown), give a 2-line summary. Line 1: Emoji, Month, "AVG". Line 2: High/Low temp.
2. "currencyTip": 2-line summary. Line 1: Currency Symbol and "CURRENCY". Line 2: Exchange rate from ${trip.currency || 'USD'} to local.
3. "mustDo": A punchy, 2-to-3 sentence summary of the "Vibe & Must Do" highlights of the city.
4. DO NOT wrap the output in markdown code blocks like \`\`\`json. Output raw JSON only.
  `;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [{ text: "You are Wanda, a travel assistant built into Wanderplan." }],
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 256,
    },
  }

  const apiKey = import.meta.env.DEV ? import.meta.env.VITE_GEMINI_API_KEY : null
  const url = apiKey
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
    : PROXY_URL;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini API error ${res.status} `)
  }

  const data = await res.json()
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) throw new Error('No response from Gemini')

  // Clean potential markdown blocks if the AI still included them
  text = text.replace(/^\`\`\`json/m, '').replace(/^\`\`\`/m, '').trim()

  try {
    return JSON.parse(text)
  } catch (e) {
    console.error("Failed to parse city guide JSON:", text)
    throw new Error("Invalid format returned from AI")
  }
}

/**
 * Generate a pin's name and emoji given a raw URL.
 * Requests JSON format from Gemini.
 */
export async function generatePinFromUrl(url) {
  const prompt = `
A user pasted this URL into their travel planner:
${url}

Visit or analyze this URL. If it is a shortened link (like maps.app.goo.gl/XXXXXXXX), you MUST use your Google Search tool to search for the EXACT unique ID string at the end of the URL (e.g. search for "XXXXXXXX") or the URL itself to discover what place or business it redirects to. Do not guess. Search it.
Figure out the real name of the place, restaurant, landmark, or link title.
Then, pick ONE single emoji that best categorizes it (e.g. 🍜 for ramen, 🏨 for hotel, 🏛️ for museum, ✈️ for airport, etc.). If it's just a generic link, use 🔗.

Return ONLY a valid JSON object with the exact keys:
{
  "name": "Ichiran Shibuya",
  "emoji": "🍜"
}

DO NOT wrap the output in markdown code blocks like \`\`\`json. Output raw JSON only.
  `;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [{ text: "You are Wanda, a travel assistant built into Wanderplan." }],
    },
    tools: [
      { googleSearch: {} }
    ],
    generationConfig: {
      temperature: 0.2, // Low temp for more accurate/consistent extraction
      maxOutputTokens: 64,
    },
  }

  const apiKey = import.meta.env.DEV ? import.meta.env.VITE_GEMINI_API_KEY : null
  const apiUrl = apiKey
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
    : PROXY_URL;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`)
  }

  const data = await res.json()
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) throw new Error('No response from Gemini')

  // Clean potential markdown blocks if the AI still included them
  text = text.replace(/^\`\`\`json/m, '').replace(/^\`\`\`/m, '').trim()

  try {
    return JSON.parse(text)
  } catch (e) {
    console.error("Failed to parse pin JSON:", text)
    throw new Error("Invalid format returned from AI")
  }
}
export async function extractIdeaDetails(url, tripCurrency) {
  try {
    const res = await fetch('/api/extract-idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, currency: tripCurrency }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Failed to parse Idea extraction:", error);
    throw new Error("Failed to extract details from this link.");
  }
}
