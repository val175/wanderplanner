import { AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { TOKENS } from './tokens'

const W = 1920
const H = 1080

function Panel({ children, style = {} }) {
    return (
        <div
            style={{
                borderRadius: 32,
                backgroundColor: 'rgba(255,255,255,0.86)',
                border: `1px solid rgba(224, 221, 214, 0.9)`,
                boxShadow: '0 24px 60px rgba(30, 25, 20, 0.10)',
                backdropFilter: 'blur(10px)',
                ...style,
            }}
        >
            {children}
        </div>
    )
}

function Badge({ children, tone = 'accent' }) {
    const tones = {
        accent: 'bg-accent/10 text-accent border-accent/20',
        muted: 'bg-[#F4EFE8] text-text-muted border-border',
        dark: 'bg-text-primary text-white border-text-primary',
    }
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${tones[tone] || tones.accent}`}>
            {children}
        </span>
    )
}

function StepBlock({ step, title, copy, active, frame, start }) {
    const reveal = interpolate(frame, [start, start + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
    const y = interpolate(frame, [start, start + 12], [18, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    })

    return (
        <div
            style={{
                opacity: reveal,
                transform: `translateY(${y}px)`,
                borderRadius: 24,
                backgroundColor: active ? 'rgba(217,119,87,0.08)' : '#FFFFFF',
                border: `1px solid ${active ? 'rgba(217,119,87,0.28)' : TOKENS.border}`,
                padding: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 12px 24px rgba(30,25,20,0.06)',
            }}
        >
            <div
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: active ? TOKENS.accent : '#F4EFE8',
                    color: active ? '#FFF' : TOKENS.textPrimary,
                    fontWeight: 800,
                    fontSize: 14,
                    flexShrink: 0,
                }}
            >
                {step}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: TOKENS.textPrimary }}>{title}</div>
                <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.5, color: TOKENS.textMuted }}>{copy}</div>
            </div>
            {active && (
                <Badge tone="accent">Live</Badge>
            )}
        </div>
    )
}

function Field({ label, value, frame, start, caret = false }) {
    const reveal = interpolate(frame, [start, start + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
    const y = interpolate(frame, [start, start + 12], [16, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
    })

    return (
        <div style={{ opacity: reveal, transform: `translateY(${y}px)` }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: TOKENS.textMuted, marginBottom: 8 }}>
                {label}
            </div>
            <div style={{ minHeight: 56, borderRadius: 18, border: `1px solid ${TOKENS.border}`, backgroundColor: '#FFF', padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 700, color: TOKENS.textPrimary }}>
                <span>{value}</span>
                {caret && <span style={{ width: 2, height: 20, borderRadius: 99, backgroundColor: TOKENS.accent }} />}
            </div>
        </div>
    )
}

function SceneIntro() {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const intro = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) })
    const lift = interpolate(frame, [0, 22], [22, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    const pulse = spring({ frame, fps, config: { damping: 14, stiffness: 120 } })

    return (
        <AbsoluteFill style={{ opacity: intro, background: 'radial-gradient(circle at 18% 18%, rgba(217,119,87,0.22), transparent 24%), radial-gradient(circle at 84% 18%, rgba(255,255,255,0.7), transparent 22%), linear-gradient(180deg, #EEE9E3 0%, #E9E1D8 100%)', fontFamily: TOKENS.fontSans }}>
            <div style={{ position: 'absolute', inset: 54, display: 'grid', gridTemplateColumns: '1.04fr 0.96fr', gap: 24 }}>
                <div style={{ transform: `translateY(${lift}px)` }}>
                    <Badge tone="dark">How-To Library</Badge>
                    <h1 style={{ margin: '18px 0 0', fontSize: 78, lineHeight: 0.96, letterSpacing: '-0.06em', color: TOKENS.textPrimary, maxWidth: 800 }}>
                        Create a new trip from a blank slate.
                    </h1>
                    <p style={{ margin: '18px 0 0', fontSize: 22, lineHeight: 1.6, color: TOKENS.textMuted, maxWidth: 700 }}>
                        Wanderplan turns a few details into a fully structured trip. Pick a mode, name the trip, add destinations, then review before you create it.
                    </p>

                    <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Badge tone="accent">Landscape 16:9</Badge>
                        <Badge tone="muted">Step-by-step flow</Badge>
                        <Badge tone="muted">Product tutorial</Badge>
                    </div>
                </div>

                <Panel style={{ padding: 24, transform: `scale(${0.98 + pulse * 0.02})`, transformOrigin: 'center center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>New trip modal</div>
                            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: TOKENS.textPrimary }}>How would you like to start?</div>
                        </div>
                        <div style={{ fontSize: 34 }}>✨</div>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ borderRadius: 22, backgroundColor: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.28)', padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(217,119,87,0.16)', display: 'grid', placeItems: 'center', fontSize: 26 }}>🪄</div>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800, color: TOKENS.textPrimary }}>Ask Wanda</div>
                                <div style={{ marginTop: 4, fontSize: 13, color: TOKENS.textMuted }}>Answer smart questions and let the trip build itself.</div>
                            </div>
                            <Badge tone="accent">Recommended</Badge>
                        </div>
                        <div style={{ borderRadius: 22, backgroundColor: '#FFF', border: `1px solid ${TOKENS.border}`, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: '#F5F1EA', display: 'grid', placeItems: 'center', fontSize: 26 }}>✏️</div>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800, color: TOKENS.textPrimary }}>Manual</div>
                                <div style={{ marginTop: 4, fontSize: 13, color: TOKENS.textMuted }}>Fill everything in yourself for full control.</div>
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>
        </AbsoluteFill>
    )
}

function SceneBuild() {
    const frame = useCurrentFrame()
    const fade = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) })

    return (
        <AbsoluteFill style={{ opacity: fade, background: 'radial-gradient(circle at 20% 18%, rgba(217,119,87,0.22), transparent 24%), linear-gradient(180deg, #EEE9E3 0%, #E9E1D8 100%)', fontFamily: TOKENS.fontSans }}>
            <div style={{ position: 'absolute', inset: 54, display: 'grid', gridTemplateColumns: '0.92fr 1.08fr', gap: 24 }}>
                <Panel style={{ padding: 24 }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <StepBlock frame={frame} start={4} step={1} title="Choose a starting mode" copy="Pick Wanda, Magic Import, or manual creation." active />
                        <StepBlock frame={frame} start={16} step={2} title="Name the trip" copy="Set a clear title, date range, traveler count, and currency." active />
                        <StepBlock frame={frame} start={28} step={3} title="Add destinations" copy="Start with the cities first, then expand into the full itinerary." />
                        <StepBlock frame={frame} start={40} step={4} title="Move to review" copy="Check the summary and create the trip when everything looks right." />
                    </div>
                </Panel>

                <div style={{ display: 'grid', gap: 18 }}>
                    <Panel style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Basics</div>
                                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: TOKENS.textPrimary }}>Trip details</div>
                            </div>
                            <Badge tone="accent">Step 2</Badge>
                        </div>
                        <div style={{ display: 'grid', gap: 12 }}>
                            <Field frame={frame} start={8} label="Trip name" value="Japan Spring Escape" caret />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <Field frame={frame} start={14} label="Start" value="Apr 28" />
                                <Field frame={frame} start={18} label="End" value="May 4" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <Field frame={frame} start={22} label="Travelers" value="4 people" />
                                <Field frame={frame} start={26} label="Currency" value="PHP" />
                            </div>
                        </div>
                    </Panel>

                    <Panel style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Destinations</div>
                                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: TOKENS.textPrimary }}>Route preview</div>
                            </div>
                            <Badge tone="muted">Step 3</Badge>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                            {['Tokyo', 'Kyoto', 'Osaka'].map((city, index) => (
                                <div key={city} style={{ borderRadius: 20, border: `1px solid ${TOKENS.border}`, backgroundColor: '#FFF', padding: 16, minHeight: 90 }}>
                                    <div style={{ fontSize: 26 }}>📍</div>
                                    <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: TOKENS.textPrimary }}>{city}</div>
                                    <div style={{ marginTop: 3, fontSize: 12, color: TOKENS.textMuted }}>Added</div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>
        </AbsoluteFill>
    )
}

function SceneOutro() {
    const frame = useCurrentFrame()
    const fade = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) })
    const lift = interpolate(frame, [0, 18], [18, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })

    return (
        <AbsoluteFill style={{ opacity: fade, background: 'radial-gradient(circle at 50% 18%, rgba(217,119,87,0.22), transparent 24%), linear-gradient(180deg, #EEE9E3 0%, #E8DED4 100%)', fontFamily: TOKENS.fontSans }}>
            <div style={{ position: 'absolute', inset: 54, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ transform: `translateY(${lift}px)`, textAlign: 'center', maxWidth: 980 }}>
                    <div style={{ fontSize: 88, lineHeight: 1, marginBottom: 18 }}>🗺️</div>
                    <Badge tone="dark">Trip created</Badge>
                    <h2 style={{ margin: '18px 0 0', fontSize: 74, lineHeight: 0.96, letterSpacing: '-0.06em', color: TOKENS.textPrimary }}>
                        A trip is ready in just a few steps.
                    </h2>
                    <p style={{ margin: '18px auto 0', fontSize: 22, lineHeight: 1.6, color: TOKENS.textMuted, maxWidth: 720 }}>
                        Once the basics are set, the rest of Wanderplan can take over with destinations, bookings, budgets, and collaboration.
                    </p>
                </div>
            </div>
        </AbsoluteFill>
    )
}

export default function NewTripLandscapeVideo() {
    return (
        <AbsoluteFill style={{ backgroundColor: TOKENS.bg, fontFamily: TOKENS.fontSans }}>
            <Sequence from={0} durationInFrames={90} premountFor={12}>
                <SceneIntro />
            </Sequence>
            <Sequence from={90} durationInFrames={90} premountFor={12}>
                <SceneBuild />
            </Sequence>
            <Sequence from={180} durationInFrames={90} premountFor={12}>
                <SceneOutro />
            </Sequence>
        </AbsoluteFill>
    )
}
