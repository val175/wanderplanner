import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { TOKENS } from '../tokens'

// IntroScene: frames 0–89
// Shows trip emoji, name, date range, traveler avatars
export default function IntroScene({ trip, travelerProfiles }) {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()

    const fadeOut = interpolate(frame, [70, 89], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    })

    const emojiScale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } })

    const nameOpacity = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const nameY = interpolate(frame, [12, 30], [28, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

    const dateOpacity = interpolate(frame, [22, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const dateY = interpolate(frame, [22, 40], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

    return (
        <AbsoluteFill
            style={{
                backgroundColor: TOKENS.bg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 40,
                opacity: fadeOut,
                fontFamily: TOKENS.fontSans,
            }}
        >
            {/* Emoji */}
            <div style={{ fontSize: 140, lineHeight: 1, transform: `scale(${emojiScale})` }}>
                {trip.emoji || '🎉'}
            </div>

            {/* Trip name */}
            <h1 style={{
                fontSize: 96,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                margin: 0,
                color: TOKENS.textPrimary,
                opacity: nameOpacity,
                transform: `translateY(${nameY}px)`,
                textAlign: 'center',
                padding: '0 80px',
            }}>
                {trip.name}
            </h1>

            {/* Date + Travelers */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                opacity: dateOpacity,
                transform: `translateY(${dateY}px)`,
            }}>
                {trip.dateLabel && (
                    <span style={{ fontSize: 32, color: TOKENS.textMuted, fontWeight: 500 }}>
                        {trip.dateLabel}
                    </span>
                )}

                {travelerProfiles && travelerProfiles.length > 0 && (
                    <>
                        {trip.dateLabel && (
                            <span style={{ fontSize: 28, color: TOKENS.border }}>•</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {travelerProfiles.map((p, i) => {
                                const avatarDelay = 35 + i * 6
                                const avatarOpacity = interpolate(frame, [avatarDelay, avatarDelay + 15], [0, 1], {
                                    extrapolateLeft: 'clamp',
                                    extrapolateRight: 'clamp',
                                })
                                const avatarX = interpolate(frame, [avatarDelay, avatarDelay + 15], [12, 0], {
                                    extrapolateLeft: 'clamp',
                                    extrapolateRight: 'clamp',
                                })
                                return (
                                    <div
                                        key={p.id}
                                        style={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: '50%',
                                            border: `3px solid ${TOKENS.bg}`,
                                            marginLeft: i > 0 ? -16 : 0,
                                            overflow: 'hidden',
                                            backgroundColor: TOKENS.bgSecondary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            opacity: avatarOpacity,
                                            transform: `translateX(${avatarX}px)`,
                                        }}
                                    >
                                        {p.photo ? (
                                            <img src={p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: 22, fontWeight: 700, color: TOKENS.accent }}>
                                                {p.name?.[0]?.toUpperCase() || '?'}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>
        </AbsoluteFill>
    )
}
