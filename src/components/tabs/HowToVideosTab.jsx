import { lazy, useMemo, useState, Suspense } from 'react'
import NewTripLandscapeVideo from '../../remotion/NewTripLandscapeVideo'
import StartingVotingRoomVideo from '../../remotion/StartingVotingRoomVideo'
import AddingBookingVideo from '../../remotion/AddingBookingVideo'
import TabHeader from '../common/TabHeader'
import Card from '../shared/Card'

const RemotionPlayer = lazy(() =>
    import('@remotion/player').then(m => ({ default: m.Player }))
)

const LIBRARY = [
    {
        id: 'create-trip',
        title: 'How to Create a New Trip',
        subtitle: 'Start from scratch, pick a mode, and build the trip foundation.',
        status: 'Published',
        duration: '0:09',
        tag: 'How-To',
        component: NewTripLandscapeVideo,
        durationInFrames: 270,
        width: 1920,
        height: 1080,
        props: {},
        accent: 'from-[#D97757] via-[#E39A7C] to-[#F5C7B4]',
    },
    {
        id: 'starting-voting-room',
        title: 'Starting a Voting Room',
        subtitle: 'Show how to open a vote, select ideas, and launch a poll for the group.',
        status: 'Published',
        duration: '0:09',
        tag: 'How-To',
        component: StartingVotingRoomVideo,
        durationInFrames: 270,
        width: 1920,
        height: 1080,
        props: {},
        accent: 'from-[#D97757] via-[#E39A7C] to-[#F5C7B4]',
    },
    {
        id: 'adding-booking',
        title: 'Adding a Booking',
        subtitle: 'Walk through adding a hotel or flight and saving it to the trip.',
        status: 'Published',
        duration: '0:09',
        tag: 'How-To',
        component: AddingBookingVideo,
        durationInFrames: 270,
        width: 1920,
        height: 1080,
        props: {},
        accent: 'from-[#111111] via-[#2B2B2B] to-[#4D4D4D]',
    },
]

// ── Badge — conforms to design system badge spec ──────────────────────────────
// text-xs, font-semibold, rounded-[var(--radius-pill)], px-2.5 py-0.5
function Badge({ children, tone = 'default' }) {
    const tones = {
        default:  'bg-bg-secondary text-text-secondary border-border',
        accent:   'bg-accent/10 text-accent border-accent/20',
        dark:     'bg-text-primary text-bg-primary border-text-primary',
        muted:    'bg-bg-secondary text-text-muted border-border',
    }
    return (
        <span className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-semibold tracking-wider ${tones[tone] || tones.default}`}>
            {children}
        </span>
    )
}

// ── Playlist card ─────────────────────────────────────────────────────────────
function VideoCard({ video, isActive, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`group w-full text-left rounded-[var(--radius-lg)] border p-3 transition-all duration-200 ${
                isActive
                    ? 'border-accent/40 bg-bg-card shadow-md'
                    : 'border-border bg-bg-card hover:border-accent/25 hover:bg-bg-hover'
            }`}
        >
            <div className="flex items-center gap-3">
                {/* Thumbnail */}
                <div className={`relative aspect-[16/9] w-[136px] shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-gradient-to-br ${video.accent}`}>
                    {video.component ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] bg-bg-card/90 text-text-primary shadow-md transition-transform group-hover:scale-105">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.5),transparent_38%)]" />
                    )}
                </div>

                {/* Meta */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="truncate text-sm font-semibold text-text-primary">{video.title}</h3>
                        <Badge tone={video.status === 'Published' ? 'accent' : 'muted'}>{video.status}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">
                        {video.subtitle}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Badge tone="default">{video.tag}</Badge>
                        <Badge tone="muted">{video.duration}</Badge>
                    </div>
                </div>
            </div>
        </button>
    )
}

// ── Featured player panel ─────────────────────────────────────────────────────
function LibraryHero({ selected }) {
    const FeaturedComponent = selected.component

    return (
        <Card className="p-4 sm:p-5 border-border bg-bg-card">
            {/* Header row */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight text-text-primary">
                        {selected.title}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
                        {selected.subtitle}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={selected.status === 'Published' ? 'accent' : 'muted'}>{selected.status}</Badge>
                    <Badge tone="default">{selected.duration}</Badge>
                </div>
            </div>

            {/* Video frame */}
            <div className="overflow-hidden rounded-[var(--radius-lg)] bg-bg-primary border border-border/50">
                <div className="overflow-hidden rounded-[var(--radius-md)] bg-bg-primary">
                    {FeaturedComponent ? (
                        <Suspense
                            fallback={
                                <div className="flex aspect-[16/9] items-center justify-center bg-bg-secondary text-sm text-text-muted">
                                    Loading video…
                                </div>
                            }
                        >
                            <RemotionPlayer
                                component={FeaturedComponent}
                                inputProps={selected.props}
                                durationInFrames={selected.durationInFrames}
                                compositionWidth={selected.width}
                                compositionHeight={selected.height}
                                fps={30}
                                controls
                                loop
                                style={{ width: '100%', aspectRatio: '16 / 9' }}
                            />
                        </Suspense>
                    ) : (
                        <div className="flex aspect-[16/9] items-center justify-center bg-bg-secondary px-8 text-center">
                            <div>
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-pill)] bg-bg-hover text-2xl">
                                    🎥
                                </div>
                                <h3 className="text-base font-semibold text-text-primary">Coming soon</h3>
                                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                                    This slot is reserved for the next how-to video we generate.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function HowToVideosTab() {
    const [selectedId, setSelectedId] = useState(LIBRARY[0].id)
    const selected = useMemo(
        () => LIBRARY.find(video => video.id === selectedId) || LIBRARY[0],
        [selectedId]
    )

    const published = LIBRARY.filter(v => v.status === 'Published').length

    return (
        <div className="space-y-5 pb-8 animate-tab-enter">
            {/* ── Hero banner ── */}
            <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-bg-card shadow-sm">
                <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr]">
                    {/* Left: copy */}
                    <div className="flex min-h-[160px] flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="dark">How-To Library</Badge>
                                <Badge tone="accent">Live previews</Badge>
                                <Badge tone="default">Remotion player</Badge>
                            </div>
                            <div className="max-w-2xl space-y-2">
                                <h1 className="font-heading text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                                    A home for every how-to video we ship.
                                </h1>
                                <p className="max-w-xl text-sm leading-relaxed text-text-muted">
                                    This tab acts like a mini YouTube for Wanderplan. Each how-to video gets a landscape thumbnail, a player, and a place to grow as we generate more guides.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-2 text-text-secondary">
                            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Featured today:</span>
                            <span className="rounded-[var(--radius-pill)] border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                                How to Create a New Trip
                            </span>
                        </div>
                    </div>

                    {/* Right: stats card */}
                    <Card className="self-end p-4 border-border bg-bg-secondary">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Library stats</p>
                                <p className="mt-1 text-sm font-semibold text-text-primary">{published} published</p>
                            </div>
                            <Badge tone="accent">Public</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-[var(--radius-md)] border border-border bg-bg-card p-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Format</p>
                                <p className="mt-1.5 text-sm font-semibold text-text-primary">Landscape player</p>
                            </div>
                            <div className="rounded-[var(--radius-md)] border border-border bg-bg-card p-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Pacing</p>
                                <p className="mt-1.5 text-sm font-semibold text-text-primary">Short demos</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </section>

            {/* ── Player + Playlist ── */}
            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <LibraryHero selected={selected} />

                <aside className="space-y-4">
                    <Card className="p-4 sm:p-5 border-border bg-bg-card">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-base font-semibold tracking-tight text-text-primary">Playlist</h2>
                                <p className="mt-0.5 text-xs text-text-muted">Switch videos like a real library.</p>
                            </div>
                            <Badge tone="accent">{LIBRARY.length} videos</Badge>
                        </div>

                        <div className="grid gap-3">
                            {LIBRARY.map(video => (
                                <VideoCard
                                    key={video.id}
                                    video={video}
                                    isActive={video.id === selected.id}
                                    onClick={() => setSelectedId(video.id)}
                                />
                            ))}
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    )
}
