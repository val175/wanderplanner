import { AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { TOKENS } from './tokens'

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

function Field({ label, value, frame, start, width = '100%' }) {
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
        <div style={{ width, opacity: reveal, transform: `translateY(${y}px)` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                {label}
            </div>
            <div
                style={{
                    minHeight: 56,
                    borderRadius: 18,
                    border: `1px solid ${TOKENS.border}`,
                    backgroundColor: '#FFF',
                    padding: '15px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 17,
                    fontWeight: 700,
                    color: value ? TOKENS.textPrimary : '#B8B2A9',
                }}
            >
                {value || '—'}
            </div>
        </div>
    )
}

function ChecklistItem({ label, done, frame, start }) {
    const reveal = interpolate(frame, [start, start + 10], [0, 1], {
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
                gap: 12,
                padding: '12px 14px',
                borderRadius: 18,
                border: `1px solid ${done ? 'rgba(217,119,87,0.28)' : TOKENS.border}`,
                backgroundColor: done ? 'rgba(217,119,87,0.08)' : '#FFF',
            }}
        >
            <div
                style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: done ? TOKENS.accent : '#F4EFE8',
                    color: done ? '#FFF' : TOKENS.textPrimary,
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                }}
            >
                {done ? '✓' : '•'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TOKENS.textPrimary }}>{label}</div>
        </div>
    )
}

function SceneIntro() {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const intro = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) })
    const lift = interpolate(frame, [0, 24], [26, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
    const pulse = spring({ frame, fps, config: { damping: 14, stiffness: 120 } })

    return (
        <AbsoluteFill style={{ opacity: intro, background: 'radial-gradient(circle at 20% 20%, rgba(217,119,87,0.20), transparent 24%), radial-gradient(circle at 84% 18%, rgba(255,255,255,0.72), transparent 24%), linear-gradient(180deg, #EEE9E3 0%, #E9E0D7 100%)', fontFamily: TOKENS.fontSans }}>
            <div style={{ position: 'absolute', inset: 54, display: 'grid', gridTemplateColumns: '0.94fr 1.06fr', gap: 24 }}>
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
                        <span>Bookings</span>
                    </div>
                    <h1 style={{ margin: 0, fontSize: 72, lineHeight: 0.96, letterSpacing: '-0.06em', color: TOKENS.textPrimary, maxWidth: 620 }}>
                        Add a booking without leaving the trip.
                    </h1>
                    <p style={{ margin: '18px 0 0', fontSize: 21, lineHeight: 1.55, color: TOKENS.textMuted, maxWidth: 580 }}>
                        Capture flights, hotels, and reservations in one place, then attach the key details to keep the trip organized.
                    </p>
                </div>
                
                <Panel style={{ padding: 24, transform: `scale(${0.98 + pulse * 0.02})`, transformOrigin: 'center center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Bookings Vault</div>
                            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: TOKENS.textPrimary }}>Add New</div>
                        </div>
                        <div style={{ fontSize: 34 }}>📄</div>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ borderRadius: 22, backgroundColor: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.28)', padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(217,119,87,0.16)', display: 'grid', placeItems: 'center', fontSize: 26 }}>📷</div>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800, color: TOKENS.textPrimary }}>Smart Scan</div>
                                <div style={{ marginTop: 4, fontSize: 13, color: TOKENS.textMuted }}>Upload a PDF or image and auto-fill details.</div>
                            </div>
                        </div>
                        <div style={{ borderRadius: 22, backgroundColor: '#FFF', border: `1px solid ${TOKENS.border}`, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: '#F5F1EA', display: 'grid', placeItems: 'center', fontSize: 26 }}>⌨️</div>
                            <div>
                                <div style={{ fontSize: 17, fontWeight: 800, color: TOKENS.textPrimary }}>Manual Entry</div>
                                <div style={{ marginTop: 4, fontSize: 13, color: TOKENS.textMuted }}>Type in the specifics yourself.</div>
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
    
    const fill = spring({ frame, fps, config: { damping: 14, stiffness: 120 } })

    return (
        <AbsoluteFill style={{ opacity: fade, background: 'radial-gradient(circle at 20% 20%, rgba(217,119,87,0.20), transparent 24%), radial-gradient(circle at 84% 18%, rgba(255,255,255,0.72), transparent 24%), linear-gradient(180deg, #EEE9E3 0%, #E9E0D7 100%)', fontFamily: TOKENS.fontSans }}>
            <div style={{ position: 'absolute', inset: 54, display: 'grid', gridTemplateColumns: '0.94fr 1.06fr', gap: 24 }}>
                <Panel style={{ padding: 24 }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <ChecklistItem frame={frame} start={4} label="Open the Bookings tab" done={frame > 0} />
                        <ChecklistItem frame={frame} start={16} label="Choose a category" done={frame > 16} />
                        <ChecklistItem frame={frame} start={28} label="Upload or type the details" done={frame > 28} />
                        <ChecklistItem frame={frame} start={40} label="Review and save to the trip" done={frame > 60} />
                    </div>
                </Panel>

                <Panel style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background:
                                'linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.92)), radial-gradient(circle at 18% 22%, rgba(217,119,87,0.10), transparent 22%), radial-gradient(circle at 80% 72%, rgba(217,119,87,0.08), transparent 25%)',
                        }}
                    />

                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 0.78fr', gap: 18, height: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                        Add booking
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: TOKENS.textPrimary }}>
                                        Hotel reservation
                                    </div>
                                </div>
                                <div style={{ padding: '10px 14px', borderRadius: 999, backgroundColor: 'rgba(217,119,87,0.10)', color: TOKENS.accent, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Review mode
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: 12 }}>
                                <Field frame={frame} start={8} label="Booking name" value="Kyoto boutique hotel" />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <Field frame={frame} start={14} label="Category" value="Hotel" />
                                    <Field frame={frame} start={20} label="Estimated cost" value="₱38,000" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <Field frame={frame} start={26} label="Travel date" value="May 1" />
                                    <Field frame={frame} start={32} label="Status" value="Confirmed" />
                                </div>
                                <Field frame={frame} start={38} label="Traveler assignment" value="Ava, Noah, Mia, Ken" />
                            </div>

                            <div style={{ marginTop: 'auto', paddingTop: 18 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                                    Save progress
                                </div>
                                <div style={{ width: '100%', height: 14, borderRadius: 999, backgroundColor: '#F0EAE2', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.max(fill * 100, 10)}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #D97757, #F6B38B)' }} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: 14 }}>
                            <div
                                style={{
                                    borderRadius: 24,
                                    backgroundColor: '#FFF',
                                    border: `1px solid ${TOKENS.border}`,
                                    padding: 16,
                                    boxShadow: '0 12px 24px rgba(30,25,20,0.06)',
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    Receipt scan
                                </div>
                                <div style={{ marginTop: 12, borderRadius: 18, border: '1px dashed rgba(217,119,87,0.34)', backgroundColor: 'rgba(217,119,87,0.06)', padding: 16, minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 30 }}>📄</div>
                                        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: TOKENS.textPrimary }}>
                                            Drag a receipt or booking PDF here
                                        </div>
                                        <div style={{ marginTop: 4, fontSize: 12, color: TOKENS.textMuted }}>
                                            Auto-fill the key fields from the document.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                style={{
                                    borderRadius: 24,
                                    backgroundColor: '#FFF',
                                    border: `1px solid ${TOKENS.border}`,
                                    padding: 16,
                                    boxShadow: '0 12px 24px rgba(30,25,20,0.06)',
                                    display: 'grid',
                                    gap: 12,
                                }}
                            >
                                <div style={{ fontSize: 12, fontWeight: 800, color: TOKENS.textMuted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    Final check
                                </div>
                                <div style={{ display: 'grid', gap: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                                        <span style={{ color: TOKENS.textMuted, fontWeight: 700 }}>Trip</span>
                                        <span style={{ color: TOKENS.textPrimary, fontWeight: 800, textAlign: 'right' }}>Japan Spring Escape</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                                        <span style={{ color: TOKENS.textMuted, fontWeight: 700 }}>Attached docs</span>
                                        <span style={{ color: TOKENS.textPrimary, fontWeight: 800, textAlign: 'right' }}>1 file</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                                        <span style={{ color: TOKENS.textMuted, fontWeight: 700 }}>Travelers</span>
                                        <span style={{ color: TOKENS.textPrimary, fontWeight: 800, textAlign: 'right' }}>4</span>
                                    </div>
                                </div>
                                <div style={{ marginTop: 4, borderRadius: 18, backgroundColor: TOKENS.accent, color: '#FFF', padding: '14px 16px', textAlign: 'center', fontWeight: 800, fontSize: 15 }}>
                                    Save booking
                                </div>
                                <div style={{ fontSize: 12, color: TOKENS.textMuted, lineHeight: 1.5, textAlign: 'center' }}>
                                    The booking becomes part of the trip immediately after save.
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
                    <div style={{ fontSize: 88, lineHeight: 1, marginBottom: 18 }}>✈️</div>
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
                        Booking saved
                    </div>
                    <h2 style={{ margin: '0', fontSize: 74, lineHeight: 0.96, letterSpacing: '-0.06em', color: TOKENS.textPrimary }}>
                        The trip is instantly updated.
                    </h2>
                    <p style={{ margin: '18px auto 0', fontSize: 22, lineHeight: 1.6, color: TOKENS.textMuted, maxWidth: 720 }}>
                        The booking is securely stored in your vault and automatically updates your group's budget and itinerary timeline.
                    </p>
                </div>
            </div>
        </AbsoluteFill>
    )
}

export default function AddingBookingVideo() {
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
