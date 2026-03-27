import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { TOKENS } from '../tokens'

const VIBE_TAGS = [
    { label: 'Surf & Chill', emoji: '🏄' },
    { label: 'Foodie', emoji: '🍜' },
    { label: 'Café Hopping', emoji: '☕' },
    { label: 'Adventure', emoji: '🧗' },
    { label: 'Cultural', emoji: '🏛️' },
    { label: 'Roadtrip', emoji: '🚗' },
    { label: 'Budget', emoji: '💸' },
    { label: 'Luxury', emoji: '✨' },
    { label: 'Nature', emoji: '🌿' },
    { label: 'Party', emoji: '🎉' },
]

// OutroScene: frames 210–270 (durationInFrames 60)
// Vibes pills + star rating + Wanderplan wordmark
export default function OutroScene({ trip }) {
    const frame = useCurrentFrame()

    const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

    const vibes = (trip.vibes || []).slice(0, 6)
    const rating = trip.rating || 0

    return (
        <AbsoluteFill
            style={{
                backgroundColor: TOKENS.bg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: fadeIn,
                fontFamily: TOKENS.fontSans,
                padding: '0 100px',
                gap: 56,
            }}
        >
            {/* Star rating */}
            {rating > 0 && (
                <div style={{ display: 'flex', gap: 12 }}>
                    {[1, 2, 3, 4, 5].map(n => {
                        const starDelay = (n - 1) * 5
                        const starOpacity = interpolate(frame, [starDelay, starDelay + 12], [0, 1], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                        })
                        const starScale = interpolate(frame, [starDelay, starDelay + 12], [0.4, 1], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                        })
                        return (
                            <span
                                key={n}
                                style={{
                                    fontSize: 80,
                                    color: n <= rating ? '#facc15' : TOKENS.border,
                                    opacity: starOpacity,
                                    transform: `scale(${starScale})`,
                                    display: 'inline-block',
                                }}
                            >
                                ★
                            </span>
                        )
                    })}
                </div>
            )}

            {/* Vibes pills */}
            {vibes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                    {vibes.map((vibeLabel, i) => {
                        const vibe = VIBE_TAGS.find(v => v.label === vibeLabel)
                        const pillDelay = 15 + i * 7
                        const pillOpacity = interpolate(frame, [pillDelay, pillDelay + 14], [0, 1], {
                            extrapolateLeft: 'clamp',
                            extrapolateRight: 'clamp',
                        })
                        return (
                            <div
                                key={vibeLabel}
                                style={{
                                    backgroundColor: TOKENS.accent,
                                    borderRadius: 100,
                                    padding: '18px 40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    opacity: pillOpacity,
                                }}
                            >
                                <span style={{ fontSize: 32 }}>{vibe?.emoji || '✨'}</span>
                                <span style={{
                                    fontSize: 30,
                                    fontWeight: 600,
                                    color: '#FFFFFF',
                                    letterSpacing: '0.01em',
                                }}>
                                    {vibeLabel}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Wordmark */}
            <div style={{
                marginTop: 20,
                opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
            }}>
                <p style={{
                    fontSize: 52,
                    fontWeight: 700,
                    color: TOKENS.textPrimary,
                    margin: 0,
                    letterSpacing: '-0.02em',
                    fontStyle: 'italic',
                }}>
                    Wanderplan
                </p>
                <p style={{
                    fontSize: 26,
                    color: TOKENS.textMuted,
                    margin: 0,
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                }}>
                    wanderplan.app
                </p>
            </div>
        </AbsoluteFill>
    )
}
