import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { TOKENS } from '../tokens'

// StatsScene: frames 150–224
// Animated stat counters for activities, daily spend, km
function AnimatedNumber({ value, label, icon, frame, startFrame }) {
    const progress = interpolate(frame, [startFrame, startFrame + 30], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    })
    const displayValue = Math.round(value * progress)
    const cardOpacity = interpolate(frame, [startFrame - 6, startFrame + 10], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    })
    const cardY = interpolate(frame, [startFrame - 6, startFrame + 10], [20, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    })

    return (
        <div style={{
            backgroundColor: TOKENS.bgCard,
            borderRadius: 24,
            padding: '44px 60px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            opacity: cardOpacity,
            transform: `translateY(${cardY}px)`,
            boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
        }}>
            <span style={{ fontSize: 60 }}>{icon}</span>
            <div>
                <p style={{
                    fontSize: 72,
                    fontWeight: 700,
                    color: TOKENS.accent,
                    margin: 0,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                }}>
                    {displayValue.toLocaleString()}
                </p>
                <p style={{
                    fontSize: 28,
                    color: TOKENS.textMuted,
                    margin: 0,
                    marginTop: 8,
                    fontWeight: 500,
                }}>
                    {label}
                </p>
            </div>
        </div>
    )
}

export default function StatsScene({ stats, km, trip }) {
    const frame = useCurrentFrame()

    const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const fadeOut = interpolate(frame, [58, 74], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

    const currency = trip?.currency || 'USD'
    const currencySymbol = { USD: '$', EUR: '€', GBP: '£', PHP: '₱', JPY: '¥', AUD: 'A$', SGD: 'S$', THB: '฿' }[currency] || currency

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
                By the numbers
            </p>

            <AnimatedNumber
                value={stats?.totalActivities || 0}
                label="activities"
                icon="🏃"
                frame={frame}
                startFrame={8}
            />

            {stats?.costPerDay > 0 && (
                <AnimatedNumber
                    value={stats.costPerDay}
                    label={`${currencySymbol} per day`}
                    icon="💰"
                    frame={frame}
                    startFrame={22}
                />
            )}

            {km > 0 && (
                <AnimatedNumber
                    value={km}
                    label="km traveled"
                    icon="✈️"
                    frame={frame}
                    startFrame={36}
                />
            )}
        </AbsoluteFill>
    )
}
