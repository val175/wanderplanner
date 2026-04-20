import { AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { TOKENS } from './tokens'

const TOTAL_STEPS = 4
const SCENE_DURATIONS = {
    intro: 84,
    basics: 84,
    destinations: 84,
    budget: 60,
    outro: 48,
}

const DEMO = {
    name: 'Japan Spring Escape',
    emoji: '🗺️',
    destination: 'Tokyo, Kyoto, Osaka',
    budget: '₱120k',
    travelers: 4,
}

function frameFade(frame, inStart, inEnd, outStart, outEnd) {
    const fadeIn = interpolate(frame, [inStart, inEnd], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
    const fadeOut = interpolate(frame, [outStart, outEnd], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
    })
    return Math.min(fadeIn, fadeOut)
}

function Background({ frame }) {
    const floatA = interpolate(frame, [0, 120], [0, -24], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    })
    const floatB = interpolate(frame, [0, 120], [0, 18], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    })

    return (
        <AbsoluteFill
            style={{
                background:
                    'radial-gradient(circle at 20% 18%, rgba(217, 119, 87, 0.24), transparent 28%), radial-gradient(circle at 82% 26%, rgba(255, 255, 255, 0.72), transparent 24%), linear-gradient(180deg, #EEE9E3 0%, #E9E1D8 100%)',
                fontFamily: TOKENS.fontSans,
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 'auto auto 72px -48px',
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(217,119,87,0.18), rgba(217,119,87,0))',
                    filter: 'blur(6px)',
                    transform: `translateY(${floatA}px)`,
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    inset: '96px -36px auto auto',
                    width: 240,
                    height: 240,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.72), rgba(255,255,255,0))',
                    filter: 'blur(8px)',
                    transform: `translateY(${floatB}px)`,
                }}
            />
        </AbsoluteFill>
    )
}

function AppChrome({ title, subtitle, step, total = TOTAL_STEPS }) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 20,
            }}
        >
            <div>
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: TOKENS.accent,
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                    }}
                >
                    <span>Wanderplan</span>
                    <span style={{ color: TOKENS.textMuted }}>•</span>
                    <span>New Trip</span>
                </div>
                <h1
                    style={{
                        margin: 0,
                        fontSize: 34,
                        lineHeight: 1,
                        fontWeight: 800,
                        letterSpacing: '-0.04em',
                        color: TOKENS.textPrimary,
                    }}
                >
                    {title}
                </h1>
                <p
                    style={{
                        margin: '10px 0 0',
                        fontSize: 16,
                        lineHeight: 1.5,
                        color: TOKENS.textMuted,
                        maxWidth: 560,
                    }}
                >
                    {subtitle}
                </p>
            </div>

            <div
                style={{
                    minWidth: 86,
                    padding: '12px 16px',
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    border: `1px solid ${TOKENS.border}`,
                    textAlign: 'right',
                    boxShadow: '0 16px 36px rgba(0,0,0,0.06)',
                }}
            >
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: TOKENS.textMuted, fontWeight: 700 }}>
                    Step
                </div>
                <div style={{ fontSize: 28, lineHeight: 1, marginTop: 4, fontWeight: 800, color: TOKENS.textPrimary }}>
                    {step}
                    <span style={{ fontSize: 18, color: TOKENS.textMuted, fontWeight: 600 }}>/</span>
                    <span style={{ fontSize: 18, color: TOKENS.textMuted, fontWeight: 600 }}>{total}</span>
                </div>
            </div>
        </div>
    )
}

function StepRail({ active }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => {
                const step = index + 1
                const completed = step < active
                const isActive = step === active
                return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {index > 0 && (
                            <div
                                style={{
                                    width: 46,
                                    height: 2,
                                    borderRadius: 999,
                                    backgroundColor: completed ? TOKENS.accent : TOKENS.border,
                                }}
                            />
                        )}
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 13,
                                fontWeight: 800,
                                color: completed || isActive ? '#FFFFFF' : TOKENS.textMuted,
                                backgroundColor: completed || isActive ? TOKENS.accent : '#F7F3EE',
                                border: `1px solid ${completed || isActive ? TOKENS.accent : TOKENS.border}`,
                                boxShadow: isActive ? '0 0 0 8px rgba(217,119,87,0.14)' : 'none',
                            }}
                        >
                            {completed ? '✓' : step}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function Panel({ children, width = '100%', padding = '28px', radius = 30, style = {} }) {
    return (
        <div
            style={{
                width,
                borderRadius: radius,
                backgroundColor: 'rgba(255,255,255,0.84)',
                border: `1px solid rgba(224, 221, 214, 0.9)`,
                boxShadow: '0 24px 60px rgba(30, 25, 20, 0.10)',
                backdropFilter: 'blur(10px)',
                padding,
                ...style,
            }}
        >
            {children}
        </div>
    )
}

function Field({ label, value, placeholder, width = '100%', frame, start = 0, caret = false }) {
    const reveal = interpolate(frame, [start, start + 16], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.2, 1, 0.3, 1),
    })
    const y = interpolate(frame, [start, start + 16], [16, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    })

    return (
        <div style={{ width, opacity: reveal, transform: `translateY(${y}px)` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.textMuted, marginBottom: 8 }}>{label}</div>
            <div
                style={{
                    minHeight: 58,
                    borderRadius: 18,
                    backgroundColor: '#FCFBF8',
                    border: `1px solid ${TOKENS.border}`,
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    color: value ? TOKENS.textPrimary : '#B8B2A9',
                    fontSize: 18,
                    fontWeight: 600,
                }}
            >
                <span>{value || placeholder}</span>
                {caret && (
                    <span
                        style={{
                            display: 'inline-block',
                            width: 2,
                            height: 22,
                            borderRadius: 99,
                            backgroundColor: TOKENS.accent,
                            animation: 'none',
                            opacity: interpolate(frame % 18, [0, 8, 17], [1, 0.2, 1]),
                        }}
                    />
                )}
            </div>
        </div>
    )
}

function ModeCard({ label, description, emoji, active, frame, start }) {
    const progress = interpolate(frame, [start, start + 14], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
    const x = interpolate(frame, [start, start + 14], [24, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    })

    return (
        <div
            style={{
                opacity: progress,
                transform: `translateX(${x}px)`,
                padding: '18px 20px',
                borderRadius: 22,
                border: `1px solid ${active ? 'rgba(217,119,87,0.42)' : TOKENS.border}`,
                background: active ? 'linear-gradient(135deg, rgba(217,119,87,0.12), rgba(255,255,255,0.92))' : '#FFFFFF',
                boxShadow: active ? '0 14px 30px rgba(217,119,87,0.14)' : '0 12px 24px rgba(30,25,20,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
            }}
        >
            <div
                style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: active ? 'rgba(217,119,87,0.16)' : '#F5F1EA',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 28,
                    flexShrink: 0,
                }}
            >
                {emoji}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: TOKENS.textPrimary }}>{label}</div>
                <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.45, color: TOKENS.textMuted }}>{description}</div>
            </div>
            {active && (
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: TOKENS.accent,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                    }}
                >
                    Recommended
                </div>
            )}
        </div>
    )
}

function DestinationChip({ city, country, delay, frame }) {
    const pop = interpolate(frame, [delay, delay + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
    const y = interpolate(frame, [delay, delay + 12], [18, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    })
    return (
        <div
            style={{
                opacity: pop,
                transform: `translateY(${y}px)`,
                padding: '16px 18px',
                borderRadius: 20,
                backgroundColor: '#FFFFFF',
                border: `1px solid ${TOKENS.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                boxShadow: '0 10px 24px rgba(30, 25, 20, 0.06)',
            }}
        >
            <div style={{ fontSize: 28 }}>📍</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: TOKENS.textPrimary }}>{city}</div>
                <div style={{ marginTop: 2, fontSize: 13, color: TOKENS.textMuted }}>{country}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.accent }}>Added</div>
        </div>
    )
}

function BudgetBar({ label, amount, max, frame, delay }) {
    const reveal = interpolate(frame, [delay, delay + 16], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
    const width = interpolate(frame, [delay + 4, delay + 24], [0, Math.min(1, amount / max)], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    })

    return (
        <div style={{ opacity: reveal }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.textPrimary }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TOKENS.textMuted }}>
                    {amount.toLocaleString()} / {max.toLocaleString()}
                </div>
            </div>
            <div style={{ height: 14, borderRadius: 999, backgroundColor: '#F0EAE2', overflow: 'hidden' }}>
                <div
                    style={{
                        width: `${Math.max(width * 100, 8)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #D97757 0%, #F0A585 100%)',
                    }}
                />
            </div>
        </div>
    )
}

function SceneIntro() {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const entrance = spring({ frame, fps, config: { damping: 16, stiffness: 120 } })
    const opacity = frameFade(frame, 0, 16, 66, 84)
    const modalX = interpolate(frame, [0, 26], [72, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })

    return (
        <AbsoluteFill style={{ opacity }}>
            <Background frame={frame} />
            <div style={{ position: 'absolute', inset: 56 }}>
                <AppChrome
                    step={1}
                    title="Create a trip in seconds"
                    subtitle="The new-trip flow starts with a quick choice. Wanda can help, or you can build everything manually."
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 24, alignItems: 'center', marginTop: 24 }}>
                    <div>
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '12px 16px',
                                borderRadius: 999,
                                backgroundColor: 'rgba(255,255,255,0.68)',
                                border: `1px solid ${TOKENS.border}`,
                                marginBottom: 20,
                                fontSize: 15,
                                fontWeight: 700,
                                color: TOKENS.textPrimary,
                            }}
                        >
                            <span style={{ fontSize: 18 }}>✨</span>
                            Pick the fastest starting point
                        </div>

                        <h2
                            style={{
                                margin: 0,
                                fontSize: 72,
                                lineHeight: 0.98,
                                letterSpacing: '-0.05em',
                                color: TOKENS.textPrimary,
                                maxWidth: 640,
                                transform: `translateY(${interpolate(frame, [0, 18], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
                                opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
                            }}
                        >
                            Plan the trip before the trip even starts.
                        </h2>

                        <p
                            style={{
                                margin: '18px 0 0',
                                fontSize: 20,
                                lineHeight: 1.6,
                                color: TOKENS.textMuted,
                                maxWidth: 540,
                                transform: `translateY(${interpolate(frame, [8, 24], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
                                opacity: interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
                            }}
                        >
                            Choose a mode, fill in the basics, and Wanderplan assembles the rest into a trip ready to share.
                        </p>
                    </div>

                    <div style={{ transform: `translateX(${modalX}px) scale(${0.96 + entrance * 0.04})`, transformOrigin: 'center center' }}>
                        <Panel padding="24px" radius={34} style={{ maxWidth: 420, marginLeft: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: TOKENS.textMuted, fontWeight: 800 }}>
                                        New Trip
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: TOKENS.textPrimary, marginTop: 4 }}>
                                        How would you like to start?
                                    </div>
                                </div>
                                <div style={{ fontSize: 34 }}>{DEMO.emoji}</div>
                            </div>

                            <div style={{ display: 'grid', gap: 12 }}>
                                <ModeCard
                                    frame={frame}
                                    start={4}
                                    emoji="🪄"
                                    label="Ask Wanda"
                                    description="Answer a few smart questions and let the planner build your trip."
                                    active
                                />
                                <ModeCard
                                    frame={frame}
                                    start={12}
                                    emoji="✨"
                                    label="Magic Import"
                                    description="Paste a link and pull a full itinerary from a guide or article."
                                />
                                <ModeCard
                                    frame={frame}
                                    start={20}
                                    emoji="✏️"
                                    label="Manual"
                                    description="Start from scratch and add each detail yourself."
                                />
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    )
}

function SceneBasics() {
    const frame = useCurrentFrame()
    const opacity = frameFade(frame, 0, 16, 66, 84)
    const cursorX = interpolate(frame, [16, 42], [0, 236], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.2, 1, 0.3, 1),
    })

    return (
        <AbsoluteFill style={{ opacity }}>
            <Background frame={frame + 24} />
            <div style={{ position: 'absolute', inset: 56 }}>
                <AppChrome
                    step={2}
                    title="Name the trip"
                    subtitle="Set the title, dates, travelers, and city vibe. This is the foundation every other step uses."
                />

                <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 24, marginTop: 20, alignItems: 'center' }}>
                    <Panel padding="28px" radius={34}>
                        <StepRail active={2} />

                        <div style={{ marginTop: 24, display: 'grid', gap: 18 }}>
                            <Field frame={frame} start={2} label="Trip name" value={DEMO.name} caret />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <Field frame={frame} start={8} label="Start date" value="Apr 28" />
                                <Field frame={frame} start={12} label="End date" value="May 4" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <Field frame={frame} start={16} label="Travelers" value={`${DEMO.travelers} people`} />
                                <Field frame={frame} start={20} label="Currency" value="PHP" />
                            </div>
                        </div>
                    </Panel>

                    <div style={{ display: 'grid', gap: 18 }}>
                        <div
                            style={{
                                fontSize: 17,
                                fontWeight: 800,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: TOKENS.textMuted,
                            }}
                        >
                            Example setup
                        </div>
                        <Panel padding="24px" radius={30} style={{ position: 'relative', overflow: 'hidden' }}>
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: -40,
                                    background:
                                        'radial-gradient(circle at 28% 18%, rgba(217,119,87,0.18), transparent 35%), radial-gradient(circle at 82% 70%, rgba(217,119,87,0.10), transparent 28%)',
                                }}
                            />
                            <div style={{ position: 'relative', display: 'grid', gap: 12 }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    Trip summary
                                </div>
                                <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.05em', color: TOKENS.textPrimary }}>
                                    {DEMO.emoji} {DEMO.name}
                                </div>
                                <div style={{ fontSize: 18, color: TOKENS.textMuted, lineHeight: 1.6 }}>
                                    A quick setup like this keeps the planning flow short and makes the later review feel almost instant.
                                </div>
                                <div
                                    style={{
                                        marginTop: 12,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '12px 16px',
                                        borderRadius: 999,
                                        backgroundColor: '#FFF',
                                        border: `1px solid ${TOKENS.border}`,
                                        width: 'fit-content',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: TOKENS.textPrimary,
                                    }}
                                >
                                    <span style={{ color: TOKENS.accent }}>Typing</span>
                                    <span
                                        style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            backgroundColor: TOKENS.accent,
                                            transform: `translateX(${cursorX}px)`,
                                        }}
                                    />
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    )
}

function SceneDestinations() {
    const frame = useCurrentFrame()
    const opacity = frameFade(frame, 0, 16, 66, 84)
    const path = interpolate(frame, [24, 56], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })

    const destinations = [
        { city: 'Tokyo', country: 'Japan' },
        { city: 'Kyoto', country: 'Japan' },
        { city: 'Osaka', country: 'Japan' },
    ]

    return (
        <AbsoluteFill style={{ opacity }}>
            <Background frame={frame + 48} />
            <div style={{ position: 'absolute', inset: 56 }}>
                <AppChrome
                    step={3}
                    title="Add destinations"
                    subtitle="One city at a time. The trip can stay simple or branch into a multi-stop itinerary."
                />

                <div style={{ display: 'grid', gridTemplateColumns: '0.96fr 1.04fr', gap: 24, marginTop: 20, alignItems: 'stretch' }}>
                    <Panel padding="28px" radius={34}>
                        <StepRail active={3} />
                        <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
                            {destinations.map((dest, index) => (
                                <DestinationChip key={dest.city} city={dest.city} country={dest.country} delay={8 + index * 10} frame={frame} />
                            ))}
                        </div>
                    </Panel>

                    <Panel padding="24px" radius={34} style={{ position: 'relative', overflow: 'hidden' }}>
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                background:
                                    'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.90)), radial-gradient(circle at 40% 22%, rgba(217,119,87,0.16), transparent 25%), radial-gradient(circle at 72% 70%, rgba(217,119,87,0.11), transparent 26%)',
                            }}
                        />
                        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    City flow
                                </div>
                                <div style={{ marginTop: 10, fontSize: 38, fontWeight: 900, letterSpacing: '-0.05em', color: TOKENS.textPrimary }}>
                                    Build the route first, details later.
                                </div>
                            </div>

                            <div style={{ marginTop: 22, display: 'grid', gap: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ fontSize: 22 }}>🧭</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: TOKENS.textPrimary }}>
                                            <span>Route progress</span>
                                            <span>{Math.round(path * 100)}%</span>
                                        </div>
                                        <div style={{ marginTop: 8, height: 12, borderRadius: 999, backgroundColor: '#F0EAE2', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.max(path * 100, 10)}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #D97757, #F6B38B)' }} />
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        padding: '18px 20px',
                                        borderRadius: 22,
                                        backgroundColor: '#FFF',
                                        border: `1px solid ${TOKENS.border}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ fontSize: 14, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Destinations preview
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: TOKENS.textPrimary }}>
                                        Tokyo • Kyoto • Osaka
                                    </div>
                                    <div style={{ color: TOKENS.textMuted, fontSize: 15, lineHeight: 1.55 }}>
                                        Wanderplan can shape the rest of the trip around the cities you choose here.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </AbsoluteFill>
    )
}

function SceneBudget() {
    const frame = useCurrentFrame()
    const opacity = frameFade(frame, 0, 12, 42, 60)

    return (
        <AbsoluteFill style={{ opacity }}>
            <Background frame={frame + 72} />
            <div style={{ position: 'absolute', inset: 56 }}>
                <AppChrome
                    step={4}
                    title="Set the budget and review"
                    subtitle="A few budget buckets and a quick review are enough to turn the outline into something bookable."
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr', gap: 24, marginTop: 20, alignItems: 'stretch' }}>
                    <Panel padding="28px" radius={34}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <StepRail active={4} />
                            <div style={{ fontSize: 16, fontWeight: 800, color: TOKENS.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Almost done
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: 20, marginTop: 6 }}>
                            <BudgetBar frame={frame} delay={8} label="Flights" amount={42000} max={70000} />
                            <BudgetBar frame={frame} delay={18} label="Hotels" amount={38000} max={60000} />
                            <BudgetBar frame={frame} delay={28} label="Food & fun" amount={26000} max={50000} />
                        </div>
                    </Panel>

                    <Panel padding="24px" radius={34} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Review
                            </div>
                            <div style={{ marginTop: 8, fontSize: 34, lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.05em', color: TOKENS.textPrimary }}>
                                Trip ready to create
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gap: 14,
                                padding: 18,
                                borderRadius: 24,
                                backgroundColor: '#FCFBF8',
                                border: `1px solid ${TOKENS.border}`,
                            }}
                        >
                            <SummaryRow label="Trip" value={DEMO.name} />
                            <SummaryRow label="Route" value={DEMO.destination} />
                            <SummaryRow label="Travelers" value={`${DEMO.travelers} people`} />
                            <SummaryRow label="Budget" value={DEMO.budget} />
                        </div>

                        <div
                            style={{
                                padding: '18px 20px',
                                borderRadius: 22,
                                background: 'linear-gradient(135deg, rgba(217,119,87,0.14), rgba(255,255,255,0.92))',
                                border: '1px solid rgba(217,119,87,0.22)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                            }}
                        >
                            <div style={{ fontSize: 28 }}>✅</div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: TOKENS.textPrimary }}>Everything is selected</div>
                                <div style={{ fontSize: 13, color: TOKENS.textMuted, marginTop: 2 }}>
                                    The review step confirms the trip before it gets created.
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </AbsoluteFill>
    )
}

function SummaryRow({ label, value }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: TOKENS.textMuted }}>
                {label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TOKENS.textPrimary, textAlign: 'right' }}>{value}</div>
        </div>
    )
}

function SceneOutro() {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const opacity = interpolate(frame, [0, 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
    const lift = interpolate(frame, [0, 18], [24, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    })
    const scale = spring({ frame, fps, config: { damping: 14, stiffness: 110 } })

    return (
        <AbsoluteFill
            style={{
                background:
                    'radial-gradient(circle at 50% 22%, rgba(217,119,87,0.24), transparent 22%), linear-gradient(180deg, #EEE9E3 0%, #E7DDD2 100%)',
                opacity,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: TOKENS.fontSans,
            }}
        >
            <div style={{ textAlign: 'center', transform: `translateY(${lift}px) scale(${0.96 + scale * 0.04})`, maxWidth: 760, padding: '0 64px' }}>
                <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 18 }}>{DEMO.emoji}</div>
                <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, color: TOKENS.accent, marginBottom: 10 }}>
                    Trip created
                </div>
                <h2 style={{ margin: 0, fontSize: 78, lineHeight: 0.98, letterSpacing: '-0.05em', color: TOKENS.textPrimary }}>
                    That’s how a new trip comes together.
                </h2>
                <p style={{ margin: '18px auto 0', fontSize: 22, lineHeight: 1.6, color: TOKENS.textMuted, maxWidth: 600 }}>
                    Start with a name, add a few places, define your budget, and you’re ready to plan the actual adventure.
                </p>

                <div
                    style={{
                        margin: '28px auto 0',
                        width: 'fit-content',
                        padding: '14px 22px',
                        borderRadius: 999,
                        backgroundColor: TOKENS.textPrimary,
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: 800,
                        letterSpacing: '0.02em',
                    }}
                >
                    Open the trip and keep planning
                </div>
            </div>
        </AbsoluteFill>
    )
}

export default function NewTripWalkthroughVideo() {
    return (
        <AbsoluteFill style={{ backgroundColor: TOKENS.bg, fontFamily: TOKENS.fontSans }}>
            <Sequence from={0} durationInFrames={SCENE_DURATIONS.intro} premountFor={12}>
                <SceneIntro />
            </Sequence>
            <Sequence from={72} durationInFrames={SCENE_DURATIONS.basics} premountFor={12}>
                <SceneBasics />
            </Sequence>
            <Sequence from={144} durationInFrames={SCENE_DURATIONS.destinations} premountFor={12}>
                <SceneDestinations />
            </Sequence>
            <Sequence from={228} durationInFrames={SCENE_DURATIONS.budget} premountFor={12}>
                <SceneBudget />
            </Sequence>
            <Sequence from={288} durationInFrames={SCENE_DURATIONS.outro} premountFor={12}>
                <SceneOutro />
            </Sequence>
        </AbsoluteFill>
    )
}
