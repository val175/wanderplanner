import { AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { TOKENS } from './tokens'

const W = 1920
const H = 1080

function Panel({ children, style = {} }) {
    return (
        <div
            style={{
                borderRadius: 32,
                backgroundColor: 'rgba(255,255,255,0.84)',
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

function StepPill({ active, step, label, frame, start }) {
    const reveal = interpolate(frame, [start, start + 12], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
    return (
        <div
            style={{
                opacity: reveal,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                borderRadius: 20,
                border: `1px solid ${active ? 'rgba(217,119,87,0.28)' : TOKENS.border}`,
                backgroundColor: active ? 'rgba(217,119,87,0.08)' : 'rgba(255,255,255,0.9)',
            }}
        >
            <div
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: active ? TOKENS.accent : '#F4EFE8',
                    color: active ? '#FFFFFF' : TOKENS.textPrimary,
                    fontSize: 13,
                    fontWeight: 800,
                    flexShrink: 0,
                }}
            >
                {step}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: TOKENS.textPrimary }}>{label}</div>
                <div style={{ fontSize: 12, color: TOKENS.textMuted, marginTop: 2 }}>
                    {active ? 'Live' : 'Queued'}
                </div>
            </div>
            {active && (
                <div
                    style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: TOKENS.accent,
                    }}
                >
                    Active
                </div>
            )}
        </div>
    )
}

function IdeaCard({ title, meta, selected, frame, start }) {
    const pop = interpolate(frame, [start, start + 12], [0, 1], {
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
                opacity: pop,
                transform: `translateY(${y}px)`,
                padding: 16,
                borderRadius: 20,
                backgroundColor: selected ? 'rgba(217,119,87,0.10)' : '#FFF',
                border: `1px solid ${selected ? 'rgba(217,119,87,0.34)' : TOKENS.border}`,
                boxShadow: '0 12px 24px rgba(30,25,20,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
            }}
        >
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: selected ? 'rgba(217,119,87,0.16)' : '#F5F1EA',
                    fontSize: 24,
                    flexShrink: 0,
                }}
            >
                🗳️
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: TOKENS.textPrimary }}>{title}</div>
                <div style={{ marginTop: 3, fontSize: 13, color: TOKENS.textMuted }}>{meta}</div>
            </div>
            {selected && (
                <div
                    style={{
                        padding: '7px 10px',
                        borderRadius: 999,
                        backgroundColor: TOKENS.accent,
                        color: '#FFF',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                    }}
                >
                    Selected
                </div>
            )}
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
        <AbsoluteFill style={{ opacity: intro, background: 'radial-gradient(circle at 18% 20%, rgba(217,119,87,0.22), transparent 25%), radial-gradient(circle at 84% 24%, rgba(255,255,255,0.72), transparent 24%), linear-gradient(180deg, #EEE9E3 0%, #E8DED4 100%)', fontFamily: TOKENS.fontSans }}>
            <div style={{ position: 'absolute', inset: 54, display: 'grid', gridTemplateColumns: '0.96fr 1.04fr', gap: 24 }}>
                <div style={{ transform: `translateY(${lift}px)`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            borderRadius: 999,
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            border: `1px solid ${TOKENS.border}`,
                            color: TOKENS.accent,
                            fontSize: 13,
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            marginBottom: 20,
                        }}
                    >
                        <span>How-To</span>
                        <span style={{ color: TOKENS.textMuted }}>•</span>
                        <span>Voting room</span>
                    </div>

                    <h1 style={{ margin: 0, fontSize: 74, lineHeight: 0.96, letterSpacing: '-0.06em', color: TOKENS.textPrimary, maxWidth: 650 }}>
                        Start a voting room in a few clicks.
                    </h1>
                    <p style={{ margin: '18px 0 0', fontSize: 21, lineHeight: 1.55, color: TOKENS.textMuted, maxWidth: 590 }}>
                        Create a proposal, pick two or more ideas, and publish the room so the group can vote without leaving the trip.
                    </p>
                </div>
                
                <Panel style={{ padding: 24, transform: `scale(${0.98 + pulse * 0.02})`, transformOrigin: 'center center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Voting Tab</div>
                            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: TOKENS.textPrimary }}>Create Proposal</div>
                        </div>
                        <div style={{ fontSize: 34 }}>🗳️</div>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ borderRadius: 22, backgroundColor: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.28)', padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(217,119,87,0.16)', display: 'grid', placeItems: 'center', fontSize: 26 }}>⚖️</div>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800, color: TOKENS.textPrimary }}>Compare Lodging</div>
                                <div style={{ marginTop: 4, fontSize: 13, color: TOKENS.textMuted }}>Let the group decide on the hotel.</div>
                            </div>
                        </div>
                        <div style={{ borderRadius: 22, backgroundColor: '#FFF', border: `1px solid ${TOKENS.border}`, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: '#F5F1EA', display: 'grid', placeItems: 'center', fontSize: 26 }}>📅</div>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800, color: TOKENS.textPrimary }}>Pick a Date</div>
                                <div style={{ marginTop: 4, fontSize: 13, color: TOKENS.textMuted }}>Vote on when to go.</div>
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>
        </AbsoluteFill>
    )
}

function SceneDemo() {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const fade = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) })
    
    const selection = spring({ frame, fps, config: { damping: 14, stiffness: 110 } })
    const score = interpolate(frame, [30, 90], [0, 100], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.16, 1, 0.3, 1),
    })

    return (
        <AbsoluteFill style={{ opacity: fade, background: 'radial-gradient(circle at 18% 20%, rgba(217,119,87,0.22), transparent 25%), radial-gradient(circle at 84% 24%, rgba(255,255,255,0.72), transparent 24%), linear-gradient(180deg, #EEE9E3 0%, #E8DED4 100%)', fontFamily: TOKENS.fontSans }}>
            <div style={{ position: 'absolute', inset: 54, display: 'grid', gridTemplateColumns: '0.92fr 1.08fr', gap: 24 }}>
                <Panel style={{ padding: 24 }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <StepPill frame={frame} start={4} step={1} label="Open the Voting tab" active={frame < 20} />
                        <StepPill frame={frame} start={16} step={2} label="Name the proposal" active={frame >= 20 && frame < 40} />
                        <StepPill frame={frame} start={28} step={3} label="Select ideas to compare" active={frame >= 40 && frame < 60} />
                        <StepPill frame={frame} start={40} step={4} label="Publish the poll" active={frame >= 60} />
                    </div>
                </Panel>

                <Panel style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background:
                                'linear-gradient(180deg, rgba(255,255,255,0.60), rgba(255,255,255,0.92)), radial-gradient(circle at 20% 16%, rgba(217,119,87,0.12), transparent 22%), radial-gradient(circle at 78% 72%, rgba(217,119,87,0.10), transparent 25%)',
                        }}
                    />

                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    Voting room
                                </div>
                                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: TOKENS.textPrimary }}>
                                    Choose the better stay
                                </div>
                            </div>
                            <div
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(217,119,87,0.10)',
                                    color: TOKENS.accent,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                }}
                            >
                                Live preview
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: 12, flex: 1 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                                        Proposal title
                                    </div>
                                    <div style={{ borderRadius: 18, border: `1px solid ${TOKENS.border}`, backgroundColor: '#FFF', padding: '16px 18px', minHeight: 60, display: 'flex', alignItems: 'center', fontSize: 18, fontWeight: 700, color: TOKENS.textPrimary }}>
                                        Where should we stay in Kyoto?
                                    </div>
                                </div>
                                <div style={{ width: 170 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                                        Status
                                    </div>
                                    <div style={{ borderRadius: 18, border: `1px solid ${TOKENS.border}`, backgroundColor: '#FFF', padding: '16px 18px', minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: TOKENS.accent }}>
                                        Drafting
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: 12 }}>
                                <IdeaCard frame={frame} start={16} title="Boutique ryokan near Gion" meta="Quiet, traditional, close to the highlights" selected={selection > 0.35} />
                                <IdeaCard frame={frame} start={28} title="Modern hotel by Kyoto Station" meta="Easy transit, strong group convenience" selected={selection > 0.55} />
                                <IdeaCard frame={frame} start={40} title="Riverside apartment in Nakagyo" meta="More space, best for longer stays" selected={selection > 0.75} />
                            </div>

                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingTop: 10 }}>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                        Room progress
                                    </div>
                                    <div style={{ marginTop: 8, width: 300, height: 12, borderRadius: 999, backgroundColor: '#F0EAE2', overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.max(selection * 100, 14)}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #D97757, #F6B38B)' }} />
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                        Votes
                                    </div>
                                    <div style={{ marginTop: 4, fontSize: 30, fontWeight: 900, color: TOKENS.textPrimary }}>
                                        {Math.round(score)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>
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
                    <div style={{ fontSize: 88, lineHeight: 1, marginBottom: 18 }}>✔️</div>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            borderRadius: 999,
                            backgroundColor: 'rgba(255,255,255,0.7)',
                            border: `1px solid ${TOKENS.border}`,
                            color: TOKENS.textPrimary,
                            fontSize: 13,
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            marginBottom: 20,
                        }}
                    >
                        Poll published
                    </div>
                    <h2 style={{ margin: '0', fontSize: 74, lineHeight: 0.96, letterSpacing: '-0.06em', color: TOKENS.textPrimary }}>
                        The room is live and synced instantly.
                    </h2>
                    <p style={{ margin: '18px auto 0', fontSize: 22, lineHeight: 1.6, color: TOKENS.textMuted, maxWidth: 720 }}>
                        Travelers can now vote on their phones. Once a decision is reached, you can automatically convert the winner into a booking.
                    </p>
                </div>
            </div>
        </AbsoluteFill>
    )
}

export default function StartingVotingRoomVideo() {
    return (
        <AbsoluteFill style={{ backgroundColor: TOKENS.bg, fontFamily: TOKENS.fontSans }}>
            <Sequence from={0} durationInFrames={90} premountFor={12}>
                <SceneIntro />
            </Sequence>
            <Sequence from={90} durationInFrames={90} premountFor={12}>
                <SceneDemo />
            </Sequence>
            <Sequence from={180} durationInFrames={90} premountFor={12}>
                <SceneOutro />
            </Sequence>
        </AbsoluteFill>
    )
}
