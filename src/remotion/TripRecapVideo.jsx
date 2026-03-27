import { AbsoluteFill, Sequence } from 'remotion'
import { TOKENS } from './tokens'
import IntroScene from './scenes/IntroScene'
import CitiesScene from './scenes/CitiesScene'
import StatsScene from './scenes/StatsScene'
import OutroScene from './scenes/OutroScene'

// Total: 270 frames @ 30fps = 9 seconds
// Scene timing (with overlaps for cross-fades):
//   IntroScene:   0  – 89  (3.0s)
//   CitiesScene:  75 – 164 (3.0s, overlaps intro fade-out)
//   StatsScene:   150– 224 (2.5s, overlaps cities fade-out)
//   OutroScene:   210– 270 (2.0s, overlaps stats fade-out)
export default function TripRecapVideo({ trip, stats, km, travelerProfiles }) {
    return (
        <AbsoluteFill style={{ backgroundColor: TOKENS.bg, fontFamily: TOKENS.fontSans }}>
            <Sequence from={0} durationInFrames={90}>
                <IntroScene trip={trip} travelerProfiles={travelerProfiles} />
            </Sequence>

            {(trip?.destinations?.length > 0) && (
                <Sequence from={75} durationInFrames={90}>
                    <CitiesScene trip={trip} />
                </Sequence>
            )}

            <Sequence from={150} durationInFrames={75}>
                <StatsScene stats={stats} km={km} trip={trip} />
            </Sequence>

            <Sequence from={210} durationInFrames={60}>
                <OutroScene trip={trip} />
            </Sequence>
        </AbsoluteFill>
    )
}
