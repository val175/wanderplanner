import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { TOKENS } from '../tokens'

// CitiesScene: frames 75–164
// Destination city cards slide up in sequence
export default function CitiesScene({ trip }) {
    const frame = useCurrentFrame()

    const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const fadeOut = interpolate(frame, [72, 89], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

    const destinations = trip.destinations || []
    // Deduplicate by city
    const cities = [...new Map(destinations.map(d => [d.city, d])).values()].slice(0, 5)

    return (
        <AbsoluteFill
            style={{
                backgroundColor: TOKENS.bg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: Math.min(fadeIn, fadeOut),
                fontFamily: TOKENS.fontSans,
                padding: '0 100px',
                gap: 28,
            }}
        >
            <p style={{
                fontSize: 36,
                fontWeight: 600,
                color: TOKENS.textMuted,
                margin: 0,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
            }}>
                Destinations
            </p>

            {cities.map((dest, i) => {
                const cardDelay = i * 12
                const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 18], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                })
                const cardY = interpolate(frame, [cardDelay, cardDelay + 18], [32, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                })

                return (
                    <div
                        key={dest.city}
                        style={{
                            backgroundColor: TOKENS.bgCard,
                            borderRadius: 24,
                            padding: '36px 60px',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 28,
                            opacity: cardOpacity,
                            transform: `translateY(${cardY}px)`,
                            boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
                        }}
                    >
                        <span style={{ fontSize: 52 }}>{dest.emoji || '📍'}</span>
                        <div>
                            <p style={{
                                fontSize: 52,
                                fontWeight: 700,
                                color: TOKENS.textPrimary,
                                margin: 0,
                                letterSpacing: '-0.01em',
                            }}>
                                {dest.city}
                            </p>
                            {dest.country && (
                                <p style={{
                                    fontSize: 30,
                                    color: TOKENS.textMuted,
                                    margin: 0,
                                    marginTop: 4,
                                    fontWeight: 500,
                                }}>
                                    {dest.country}
                                </p>
                            )}
                        </div>
                    </div>
                )
            })}
        </AbsoluteFill>
    )
}
