import { GLOBAL_CATEGORIES } from '../constants/categories'
import { addMinutesToTime, generateId, normalizeTimeString } from './helpers'
import { sortActivities, sortItineraryDays } from '../state/reducerUtils'

const VALID_CATEGORIES = new Set(GLOBAL_CATEGORIES.map(c => c.id))
const CATEGORY_EMOJI = Object.fromEntries(GLOBAL_CATEGORIES.map(c => [c.id, c.emoji]))

const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

const STOP_SECTION_RE = /^(book before|cost overview|summary|already booked|day-by-day spend|unit prices|rain backups|practical tips|sources|references|packing|budget|notes)\b/i

function stripMarkdown(str = '') {
  return String(str)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferYear(rawText, tripContext) {
  if (tripContext?.startDate && /^\d{4}-\d{2}-\d{2}$/.test(tripContext.startDate)) {
    return Number(tripContext.startDate.slice(0, 4))
  }
  const isoMatch = rawText.match(/\b(20\d{2})-\d{2}-\d{2}\b/)
  if (isoMatch) return Number(isoMatch[1])
  const textYearMatch = rawText.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+(20\d{2})\b/i)
  if (textYearMatch) return Number(textYearMatch[1])
  return new Date().getFullYear()
}

function parseMonthDayToISO(text, fallbackYear) {
  if (!text) return ''
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]

  const md = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(20\d{2}))?\b/i)
  if (!md) return ''
  const month = MONTHS[md[1].toLowerCase()]
  const day = Number(md[2])
  const year = md[3] ? Number(md[3]) : fallbackYear
  if (!month || day < 1 || day > 31) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function inferCategoryAndEmoji(text = '') {
  const lower = text.toLowerCase()
  if (/\b(land at|flight|fly to|departure|depart|boarding|changi|klia|subang|airport|airline|cebu pacific|airasia|firefly)\b/.test(lower)) {
    return { category: 'flight', emoji: '✈️' }
  }
  if (/\b(check in|check-in|check out|check-out|hotel|hostel|resort|ibis|komune|drop bags|freshen up|nap|rest and pool|back to the hotel)\b/.test(lower)) {
    return { category: 'lodging', emoji: '🏨' }
  }
  if (/\b(concert|my chemical romance|mcr|stadium|show starts|gig|live music|setlist)\b/.test(lower)) {
    return { category: 'concert', emoji: '🎵' }
  }
  if (/\b(breakfast|brunch|lunch|dinner|supper|eat|food|hawker|cafe|coffee|satay|kaya toast|chicken rice|nasi lemak|drinks|beer|dessert)\b/.test(lower)) {
    return { category: 'food', emoji: '🍜' }
  }
  if (/\b(mrt|lrt|ktm|monorail|grab|taxi|bus|train|klia ekspres|sentosa express|walk to|leave for|getting back)\b/.test(lower)) {
    return { category: 'transport', emoji: '🚇' }
  }
  if (/\b(shop|shops|mall|merch|souvenir|vivocity|pavilion|suria klcc|mid valley)\b/.test(lower)) {
    return { category: 'shopping', emoji: '🛍️' }
  }
  return { category: 'activity', emoji: '🎯' }
}

function inferTransit(text = '') {
  const lower = text.toLowerCase()
  if (/\b(flight|fly|firefly|airasia|cebu pacific)\b/.test(lower)) return { transit: '', transitEmoji: '✈️' }
  if (/\b(mrt|lrt|ktm|monorail|train|ekspres|sentosa express)\b/.test(lower)) return { transit: '', transitEmoji: '🚇' }
  if (/\b(bus)\b/.test(lower)) return { transit: '', transitEmoji: '🚌' }
  if (/\b(ferry|boat)\b/.test(lower)) return { transit: '', transitEmoji: '🛥️' }
  if (/\b(walk|on foot|boardwalk)\b/.test(lower)) return { transit: '', transitEmoji: '🚶' }
  return { transit: '', transitEmoji: '🚕' }
}

function estimateDurationMinutes(text, category) {
  const hrsMatch = text.match(/\b(?:allow|about)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i)
  if (hrsMatch) {
    const mins = Math.round(Number(hrsMatch[1]) * 60)
    if (mins >= 15 && mins <= 720) return mins
  }
  const minsMatch = text.match(/\b(\d+)\s*(?:minutes?|mins?)\b/i)
  if (minsMatch) {
    const mins = Number(minsMatch[1])
    if (mins >= 10 && mins <= 360) return mins
  }
  if (category === 'concert') return 180
  if (category === 'flight') return 150
  if (category === 'food') return 90
  if (category === 'transport') return 45
  if (category === 'lodging') return 45
  return 90
}

function extractCostHint(text = '') {
  const m = text.match(/(?:about|around|roughly)?\s*((?:S\$|US\$|₱|RM|SGD|MYR|PHP|\$|€|£|¥)\s?[\d,]+(?:\.\d{1,2})?)/i)
  return m ? m[1].replace(/\s+/g, '') : ''
}

function splitNameAndNotes(rawContent = '') {
  const boldLead = rawContent.match(/^\*\*([^*]+)\*\*\s*(.*)$/)
  if (boldLead) {
    const name = stripMarkdown(boldLead[1]).replace(/\.$/, '').trim()
    const notes = stripMarkdown(boldLead[2]).trim()
    if (name) return { name, notes }
  }

  const plain = stripMarkdown(rawContent)
  const sentenceBreak = plain.match(/^([^.!?]{8,80}?)[.!?]\s+(.+)$/)
  if (sentenceBreak) {
    return { name: sentenceBreak[1].trim(), notes: sentenceBreak[2].trim() }
  }

  if (plain.length <= 70) {
    return { name: plain.replace(/\.$/, '').trim(), notes: '' }
  }

  const colonBreak = plain.match(/^([^:]{8,60}):\s+(.+)$/)
  if (colonBreak) {
    return { name: colonBreak[1].trim(), notes: colonBreak[2].trim() }
  }

  return { name: `${plain.slice(0, 65).trim()}…`, notes: plain }
}

/**
 * Deterministic parser for structured Markdown / plain-text itineraries.
 * Used as a fast client-side fallback when the AI endpoint is unavailable or offline.
 */
export function parseStructuredTextItinerary(rawText, tripContext = {}) {
  if (!rawText || typeof rawText !== 'string') return []

  const year = inferYear(rawText, tripContext)
  const lines = rawText.split(/\r?\n/)
  const days = []

  let currentCity = ''
  let currentDay = null
  let inDayTableOrSubblock = false
  let stoppedAtTrailingSection = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      inDayTableOrSubblock = false
      continue
    }

    // Check headings (#, ##, ###, ####)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingText = stripMarkdown(headingMatch[2])
      inDayTableOrSubblock = false

      const dayMatch = headingText.match(/^day\s*0*(\d+)\b(?:\s*[·:\-–—|]\s*(.+))?$/i)
      if (dayMatch) {
        stoppedAtTrailingSection = false
        const dayNumber = Number(dayMatch[1])
        const rest = (dayMatch[2] || '').trim()
        const date = parseMonthDayToISO(rest, year)

        // Extract theme/location from remainder after stripping weekday/date
        const parts = rest.split(/\s*[·|—–-]\s*/).map(p => p.trim()).filter(Boolean)
        const nonDateParts = parts.filter(p => !parseMonthDayToISO(p, year) && !/^(mon|tue|wed|thu|fri|sat|sun)/i.test(p))
        const subtitle = nonDateParts.join(' · ')

        currentDay = {
          dayNumber,
          date,
          location: currentCity || subtitle || '',
          emoji: '📍',
          notes: subtitle && currentCity && subtitle !== currentCity ? subtitle : '',
          activities: [],
        }
        days.push(currentDay)
        continue
      }

      if (level <= 2) {
        if (STOP_SECTION_RE.test(headingText)) {
          stoppedAtTrailingSection = true
          currentDay = null
          continue
        }
        // Top/city section heading, e.g. "## Singapore (Nov 14 to 18)"
        const cleanedCity = headingText.replace(/\s*\([^)]*\)\s*$/, '').trim()
        if (cleanedCity && !/^(trip at a glance|itinerary)/i.test(cleanedCity)) {
          currentCity = cleanedCity
          stoppedAtTrailingSection = false
        }
      }
      continue
    }

    if (stoppedAtTrailingSection || !currentDay) continue

    // Skip Markdown tables & bold table headers inside days (e.g. LeVeL33 menu table)
    if (line.startsWith('|') || /^\*\*proposed order\b/i.test(line)) {
      inDayTableOrSubblock = true
      continue
    }
    if (inDayTableOrSubblock) continue

    // Bullet item inside a day
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/)
    if (bulletMatch) {
      const body = bulletMatch[1].trim()

      // Standalone italic/bold note bullet: "*Note:* ..."
      if (/^\*note:\*/i.test(body) || /^note:/i.test(stripMarkdown(body))) {
        const noteText = stripMarkdown(body).replace(/^note:\s*/i, '').trim()
        if (noteText) {
          currentDay.notes = currentDay.notes ? `${currentDay.notes}\n${noteText}` : noteText
        }
        continue
      }

      // Timed bullet: "**5:00 PM** ..." or "5:00 PM - ..." or "17:00 ..."
      const timedMatch = body.match(/^(?:\*\*)?(\d{1,2}:\d{2}(?:\s*[AP]M)?)(?:\*\*)?\s*(?:[-–—:]\s*)?(.+)$/i)
      if (timedMatch) {
        const normalizedTime = normalizeTimeString(timedMatch[1])
        const contentRaw = timedMatch[2].trim()
        const { name, notes } = splitNameAndNotes(contentRaw)
        const { category, emoji } = inferCategoryAndEmoji(contentRaw)
        const duration = estimateDurationMinutes(contentRaw, category)
        const endTime = normalizedTime ? addMinutesToTime(normalizedTime, duration) : ''
        const estCost = extractCostHint(contentRaw)
        const { transit, transitEmoji } = inferTransit(contentRaw)

        currentDay.activities.push({
          time: normalizedTime,
          duration,
          endTime,
          category,
          name,
          emoji,
          location: '',
          estCost,
          transit,
          transitEmoji,
          notes,
        })
        continue
      }

      // Relative time bullet: "**Morning** ...", "**Evening** ...", "**Afternoon** ..."
      const relativeMatch = body.match(/^(?:\*\*)?(morning|midday|noon|afternoon|evening|night|late night)(?:\*\*)?\s*(?:[-–—:]\s*)?(.+)$/i)
      if (relativeMatch) {
        const period = relativeMatch[1]
        const contentRaw = relativeMatch[2].trim()
        const { name, notes } = splitNameAndNotes(contentRaw)
        const { category, emoji } = inferCategoryAndEmoji(contentRaw)
        const estCost = extractCostHint(contentRaw)
        const { transit, transitEmoji } = inferTransit(contentRaw)
        const defaultTimeMap = {
          morning: '09:00',
          midday: '12:00',
          noon: '12:00',
          afternoon: '14:00',
          evening: '19:00',
          night: '20:30',
          'late night': '22:00',
        }
        const time = defaultTimeMap[period.toLowerCase()] || ''
        const duration = 60
        const endTime = time ? addMinutesToTime(time, duration) : ''

        currentDay.activities.push({
          time,
          duration,
          endTime,
          category,
          name,
          emoji,
          location: '',
          estCost,
          transit,
          transitEmoji,
          notes: notes ? `${period}: ${notes}` : period,
        })
        continue
      }

      // General reminder bullet inside a day -> append to day notes
      const cleanNote = stripMarkdown(body)
      if (cleanNote) {
        currentDay.notes = currentDay.notes ? `${currentDay.notes}\n• ${cleanNote}` : cleanNote
      }
    }
  }

  return days.filter(d => d.activities.length > 0 || d.notes)
}

/**
 * Normalizes raw extracted days/activities into a reviewable UI structure.
 */
export function normalizeImportedDays(rawDays = [], trip = null) {
  const fallbackCity = trip?.cities?.[0]?.city || ''

  return (rawDays || []).map((day, dayIdx) => {
    const dayNumber = Number.isFinite(Number(day.dayNumber)) ? Number(day.dayNumber) : dayIdx + 1
    const activities = (day.activities || []).map((act, actIdx) => {
      const category = VALID_CATEGORIES.has(act.category) ? act.category : 'other'
      const time = normalizeTimeString(act.time) || ''
      const duration = Number(act.duration) > 0 ? Number(act.duration) : 60
      const endTime = normalizeTimeString(act.endTime) || (time ? addMinutesToTime(time, duration) : '')
      return {
        id: act.id || `imp-act-${dayIdx}-${actIdx}-${generateId()}`,
        selected: act.selected !== false,
        time,
        duration,
        endTime,
        category,
        name: String(act.name || 'Activity').trim(),
        emoji: act.emoji || CATEGORY_EMOJI[category] || '📌',
        location: typeof act.location === 'string' ? act.location.trim() : (act.location?.placeName || ''),
        estCost: act.estCost ? String(act.estCost).trim() : '',
        transit: act.transit ? String(act.transit).trim() : '',
        transitEmoji: act.transitEmoji || '🚕',
        notes: act.notes ? String(act.notes).trim() : '',
      }
    })

    return {
      id: day.id || `imp-day-${dayIdx}-${generateId()}`,
      selected: day.selected !== false,
      dayNumber,
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(day.date || '')) ? day.date : '',
      location: String(day.location || fallbackCity || '').trim(),
      emoji: day.emoji || '📍',
      notes: String(day.notes || '').trim(),
      activities,
    }
  })
}

function buildFinalActivity(act, defaultParticipantIds) {
  const category = VALID_CATEGORIES.has(act.category) ? act.category : 'other'
  const time = normalizeTimeString(act.time) || ''
  const duration = Number(act.duration) > 0 ? Number(act.duration) : 60
  const endTime = normalizeTimeString(act.endTime) || (time ? addMinutesToTime(time, duration) : '')
  return {
    id: generateId(),
    time,
    duration,
    endTime,
    category,
    name: String(act.name || 'Activity').trim(),
    emoji: act.emoji || CATEGORY_EMOJI[category] || '📌',
    location: act.location || '',
    estCost: act.estCost || '',
    transit: act.transit || '',
    transitEmoji: act.transitEmoji || '🚕',
    notes: act.notes || '',
    done: false,
    participantIds: defaultParticipantIds,
    comments: [],
  }
}

function activityDedupeKey(act) {
  const normTime = normalizeTimeString(act?.time) || ''
  const normName = String(act?.name || '').trim().toLowerCase()
  return `${normTime}::${normName}`
}

/**
 * Finds the matching existing day index for an imported day (date first, then dayNumber).
 */
export function findMatchingDayIndex(existingItinerary = [], importedDay) {
  if (importedDay?.date) {
    const byDate = existingItinerary.findIndex(d => d.date && d.date === importedDay.date)
    if (byDate >= 0) return byDate
  }
  if (Number.isFinite(Number(importedDay?.dayNumber))) {
    const byNum = existingItinerary.findIndex(d => Number(d.dayNumber) === Number(importedDay.dayNumber))
    if (byNum >= 0) return byNum
  }
  return -1
}

/**
 * Pure merge helper shared between UI preview stats and the IMPORT_ITINERARY reducer.
 */
export function mergeImportedItinerary(existingItinerary = [], importedDays = [], mode = 'merge', defaultParticipantIds = []) {
  const chosenDays = (importedDays || [])
    .filter(d => d.selected !== false)
    .map(d => ({
      ...d,
      activities: (d.activities || []).filter(a => a.selected !== false),
    }))
    .filter(d => d.activities.length > 0 || d.notes)

  if (chosenDays.length === 0) return existingItinerary

  const toDayRecord = (d, dayNumberOverride) => ({
    id: generateId(),
    date: d.date || '',
    dayNumber: dayNumberOverride ?? d.dayNumber,
    location: d.location || '',
    emoji: d.emoji || '📍',
    notes: d.notes || '',
    activities: sortActivities(d.activities.map(a => buildFinalActivity(a, defaultParticipantIds))),
  })

  if (mode === 'replace') {
    const sorted = sortItineraryDays(chosenDays)
    return sorted.map((d, idx) => toDayRecord(d, idx + 1))
  }

  if (mode === 'append') {
    const existing = Array.isArray(existingItinerary) ? existingItinerary : []
    const maxNum = existing.reduce((max, d) => Math.max(max, Number(d.dayNumber || 0)), 0)
    const appended = sortItineraryDays(chosenDays).map((d, idx) => toDayRecord(d, maxNum + idx + 1))
    return [...existing, ...appended]
  }

  // Default: 'merge'
  const next = (existingItinerary || []).map(d => ({
    ...d,
    activities: [...(d.activities || [])],
  }))

  for (const impDay of chosenDays) {
    const matchIdx = findMatchingDayIndex(next, impDay)
    if (matchIdx >= 0) {
      const target = next[matchIdx]
      const existingKeys = new Set((target.activities || []).map(activityDedupeKey))
      const additions = impDay.activities
        .filter(a => !existingKeys.has(activityDedupeKey(a)))
        .map(a => buildFinalActivity(a, defaultParticipantIds))

      const shouldFillLocation = !target.location || target.location === 'New Location'
      next[matchIdx] = {
        ...target,
        date: target.date || impDay.date || '',
        location: shouldFillLocation ? (impDay.location || target.location || '') : target.location,
        notes: target.notes || impDay.notes || '',
        activities: sortActivities([...(target.activities || []), ...additions]),
      }
    } else {
      next.push(toDayRecord(impDay))
    }
  }

  return sortItineraryDays(next)
}
