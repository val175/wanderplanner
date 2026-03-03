/**
 * useAI.js
 * OpenRouter wrapper for Wanderplan.
 * Builds a trip-aware system prompt from the active trip's state,
 * so every response is grounded in the user's actual trip data.
 */

// All requests go through our Vercel proxy to keep the API key server-side
const PROXY_URL = 'https://wanderplan-rust.vercel.app/api/gemini'

const DEFAULT_MODEL = 'mistralai/mistral-small-3.1-24b-instruct:free'

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
 * Low-level helper: POST to the proxy in OpenAI format, return response text.
 */
async function callProxy(messages, opts = {}) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.max_tokens ?? 512,
      ...(opts.jsonMode && { response_format: { type: 'json_object' } }),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `AI proxy error ${res.status}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No response from AI')
  return text
}

/**
 * Send a message to the AI with full conversation history.
 * @param {string} systemPrompt - The trip-aware system prompt
 * @param {Array<{role: 'user'|'model', text: string}>} history - Prior messages
 * @param {string} userMessage - The new user message
 * @returns {Promise<string>} The AI's reply text
 */
export async function sendMessage(systemPrompt, history, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    // Gemini used 'model' for assistant turns; OpenAI uses 'assistant'
    ...history.map(msg => ({ role: msg.role === 'model' ? 'assistant' : msg.role, content: msg.text })),
    { role: 'user', content: userMessage },
  ]
  return callProxy(messages, { temperature: 0.8, max_tokens: 512 })
}

export async function generateCityGuide(city, trip) {
  try {
    const [weatherResult, currencyTip, mustDo] = await Promise.all([
      // 1. Weather via Open-Meteo
      (async () => {
        try {
          const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.city)}&count=1`)
          const geoData = await geoRes.json()
          if (geoData.results && geoData.results.length > 0) {
            const { latitude, longitude } = geoData.results[0]
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&forecast_days=1`)
            const weatherData = await weatherRes.json()
            if (weatherData.daily) {
              let monthStr = "ESTIMATED AVG"
              if (trip.startDate) {
                const date = new Date(trip.startDate)
                monthStr = date.toLocaleString('default', { month: 'long' }).toUpperCase() + " AVG"
              }
              const max = Math.round(weatherData.daily.temperature_2m_max[0])
              const min = Math.round(weatherData.daily.temperature_2m_min[0])
              return `🌤️ ${monthStr}\n${max}°C / ${min}°C`
            }
          }
        } catch (e) { console.warn("Weather fetch failed", e) }
        return "Weather unavailable"
      })(),

      // 2. Currency via Open.er-api.com & RestCountries
      (async () => {
        try {
          const baseCurrency = trip.currency || 'USD'
          let toCurrency = null
          if (city.country) {
            const countryRes = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(city.country)}`)
            const countryData = await countryRes.json()
            if (countryData && countryData[0] && countryData[0].currencies) {
              toCurrency = Object.keys(countryData[0].currencies)[0]
            }
          }
          if (toCurrency && toCurrency !== baseCurrency) {
            const erRes = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`)
            const erData = await erRes.json()
            if (erData.rates && erData.rates[toCurrency]) {
              return `💱 CURRENCY\n1 ${baseCurrency} = ${erData.rates[toCurrency]} ${toCurrency}`
            }
          } else if (toCurrency === baseCurrency) {
            return `💱 CURRENCY\nUses ${baseCurrency}`
          }
        } catch (e) { console.warn("Currency fetch failed", e) }
        return "¥ CURRENCY\nExchange rate unavailable"
      })(),

      // 3. Must Do via Wikipedia Summary
      (async () => {
        try {
          const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city.city)}`)
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json()
            if (wikiData.extract) {
              const sentences = wikiData.extract.match(/[^.!?]+[.!?]+/g) || [wikiData.extract]
              return sentences.slice(0, 2).join(' ').trim()
            }
          }
        } catch (e) { console.warn("Wikipedia fetch failed", e) }
        return "Highlight not found. Add your own must-do activities!"
      })()
    ])

    return { weather: weatherResult, currencyTip, mustDo }
  } catch (error) {
    console.error("Failed to generate city guide:", error)
    throw new Error("Failed to load city guide data")
  }
}

export async function generatePinFromUrl(urlOrContext) {
  try {
    const urlMatch = urlOrContext.match(/http[s]?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : urlOrContext;

    let titleFromContext = "";
    const titleMatch = urlOrContext.match(/Page Title: (.*)/);
    if (titleMatch) titleFromContext = titleMatch[1];

    let extractedName = titleFromContext;

    // If we didn't get a pre-resolved title, try to scrape it via corsproxy
    if (!extractedName && url) {
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(proxyUrl, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeoutId);

        if (res && res.ok) {
          const htmlText = await res.text();
          // Try og:title first
          const ogMatch = htmlText.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)
            || htmlText.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i);
          if (ogMatch && ogMatch[1]) {
            extractedName = ogMatch[1].trim();
          } else {
            const titleTagMatch = htmlText.match(/<title>([^<]+)<\/title>/i);
            if (titleTagMatch && titleTagMatch[1]) {
              extractedName = titleTagMatch[1].trim();
            }
          }
        }
      } catch (e) {
        console.warn("Fast scrape failed for pin", e);
      }
    }

    // Clean up title
    let finalName = extractedName || "Saved Link";
    finalName = finalName.replace(/ - Google Maps/i, '').replace(/[\r\n]+/g, ' ').trim();
    if (finalName.length > 50) finalName = finalName.substring(0, 50) + '...';

    // Figure out Emoji directly using Regex dictionary
    let emoji = "🔗";
    const textToAnalyze = (finalName + " " + url).toLowerCase();

    if (/hotel|resort|airbnb|booking|hostel|villa|inn|stay/i.test(textToAnalyze)) {
      emoji = "🏨";
    } else if (/restaurant|cafe|food|dining|eats|menu|ramen|sushi|bistro/i.test(textToAnalyze)) {
      emoji = "🍜";
    } else if (/museum|gallery|art|exhibit|history/i.test(textToAnalyze)) {
      emoji = "🏛️";
    } else if (/airport|flight|airline|terminal/i.test(textToAnalyze)) {
      emoji = "✈️";
    } else if (/park|garden|nature|forest/i.test(textToAnalyze)) {
      emoji = "🌳";
    } else if (/beach|coast|ocean|sea/i.test(textToAnalyze)) {
      emoji = "🏖️";
    } else if (/temple|shrine|church|mosque/i.test(textToAnalyze)) {
      emoji = "⛩️";
    } else if (/train|station|rail|metro/i.test(textToAnalyze)) {
      emoji = "🚆";
    } else if (/store|shop|mall|market/i.test(textToAnalyze)) {
      emoji = "🛍️";
    }

    return {
      name: finalName,
      emoji: emoji
    };
  } catch (e) {
    console.error("Failed to parse pin JSON:", e)
    return { name: "Saved Link", emoji: "🔗" };
  }
}

export async function extractIdeaDetails(url, tripCurrency) {
  try {
    const res = await fetch('https://wanderplan-rust.vercel.app/api/extract-idea', {
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
