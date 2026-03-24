// ── XP & Level System ─────────────────────────────────────────
// All logic is client-side; only the resulting profile.xp / profile.level
// fields are persisted to Firestore (one write, no extra collections).

export const XP_LEVELS = [
  {
    level: 1,
    xpRequired: 0,
    title: 'Wanderer',
    frameColor: '#94a3b8',       // slate
    markerColor: '#94a3b8',
    wandaPersonality: 'friendly',
    emoji: '🧭',
  },
  {
    level: 2,
    xpRequired: 100,
    title: 'Explorer',
    frameColor: '#f59e0b',       // amber
    markerColor: '#f59e0b',
    wandaPersonality: 'friendly',
    emoji: '🗺️',
  },
  {
    level: 3,
    xpRequired: 250,
    title: 'Adventurer',
    frameColor: '#10b981',       // emerald
    markerColor: '#10b981',
    wandaPersonality: 'adventurous',
    emoji: '⛺',
  },
  {
    level: 4,
    xpRequired: 500,
    title: 'Globetrotter',
    frameColor: '#6366f1',       // indigo
    markerColor: '#6366f1',
    wandaPersonality: 'adventurous',
    emoji: '✈️',
  },
  {
    level: 5,
    xpRequired: 900,
    title: 'Voyager',
    frameColor: '#ec4899',       // pink
    markerColor: '#ec4899',
    wandaPersonality: 'witty',
    emoji: '🚀',
  },
  {
    level: 6,
    xpRequired: 1400,
    title: 'Pathfinder',
    frameColor: '#f97316',       // orange
    markerColor: '#f97316',
    wandaPersonality: 'witty',
    emoji: '🏆',
  },
  {
    level: 7,
    xpRequired: 2000,
    title: 'Legend',
    // CSS gradient stored as a string; use with background-image or keep
    // the solid fallback for border/box-shadow.
    frameColor: '#f59e0b',       // gold solid (fallback)
    frameGradient: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
    markerColor: '#f59e0b',
    wandaPersonality: 'legendary',
    emoji: '👑',
  },
]

/** Returns the level object the user currently occupies. */
export function getLevelForXp(xp = 0) {
  // Walk backward until we find the highest threshold the user has passed.
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].xpRequired) return XP_LEVELS[i]
  }
  return XP_LEVELS[0]
}

/** Returns the *next* level object, or null if the user is at max level. */
export function getNextLevel(xp = 0) {
  const current = getLevelForXp(xp)
  const next = XP_LEVELS.find(l => l.xpRequired > (current.xpRequired ?? 0))
  return next || null
}

/**
 * Returns progress info between current and next level.
 * @returns {{ pct: number, current: number, needed: number }}
 */
export function getXpProgress(xp = 0) {
  const current = getLevelForXp(xp)
  const next = getNextLevel(xp)
  if (!next) return { pct: 100, current: 0, needed: 0 }      // max level
  const xpIntoLevel = xp - current.xpRequired
  const xpSpan = next.xpRequired - current.xpRequired
  return {
    pct: Math.min(100, Math.round((xpIntoLevel / xpSpan) * 100)),
    current: xpIntoLevel,
    needed: xpSpan,
  }
}
