import { useState, useRef, useCallback, useEffect } from 'react'
import { GoogleGenAI, Modality } from '@google/genai'
import { auth } from '../firebase/config'
import { triggerHaptic } from '../utils/haptics'

const LIVE_TOKEN_URL = 'https://wanderplan-rust.vercel.app/api/wanda-live-token'

async function fetchEphemeralToken(model) {
  const firebaseToken = await auth.currentUser?.getIdToken()
  if (!firebaseToken) throw new Error('Not authenticated')
  const res = await fetch(`${LIVE_TOKEN_URL}?model=${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${firebaseToken}` },
  })
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
  const { token } = await res.json()
  return token
}

// Models tried in order — falls back to next on model-not-found errors
const LIVE_MODELS = [
  'gemini-3.1-flash-live-preview', // Primary: Gemini 3.1 Flash Live
  'gemini-3-flash-preview',        // Fallback: Gemini 3 Flash Live (unlimited RPD)
  'gemini-2.0-flash-live-001',     // Final fallback: confirmed GA stable
]
const MIC_SAMPLE_RATE = 16000   // Gemini Live input requirement
const SPEAKER_SAMPLE_RATE = 24000 // Gemini Live output rate

export function useWandaLive() {
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState(null)

  const sessionRef = useRef(null)
  const audioCtxRef = useRef(null)
  const micStreamRef = useRef(null)
  const processorRef = useRef(null)
  const silentGainRef = useRef(null)
  const nextPlayTimeRef = useRef(0)
  const scheduledSourcesRef = useRef([])
  const isActiveRef = useRef(false)
  const modelIdxRef = useRef(0)
  const systemPromptRef = useRef('')
  const openLiveSessionRef = useRef(null) // ref so onclose can trigger fallback without stale closure

  // Cancel all buffered audio — called on interruption or session end
  const cancelPlayback = useCallback(() => {
    scheduledSourcesRef.current.forEach(src => {
      try { src.onended = null; src.stop(); src.disconnect() } catch (_) {}
    })
    scheduledSourcesRef.current = []
    nextPlayTimeRef.current = 0
    setIsSpeaking(false)
  }, [])

  // Decode a base64 PCM chunk from Gemini and schedule it for gapless playback
  const playPCMChunk = useCallback((base64Data) => {
    const ctx = audioCtxRef.current
    if (!ctx || !isActiveRef.current || ctx.state === 'closed') return

    // base64 → Uint8Array → Int16Array → Float32Array
    const binary = atob(base64Data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const int16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

    const buffer = ctx.createBuffer(1, float32.length, SPEAKER_SAMPLE_RATE)
    buffer.getChannelData(0).set(float32)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    // Gapless: schedule each chunk to start exactly where the previous one ends
    const now = ctx.currentTime
    const startAt = Math.max(now + 0.02, nextPlayTimeRef.current)
    source.start(startAt)
    nextPlayTimeRef.current = startAt + buffer.duration

    scheduledSourcesRef.current.push(source)
    setIsSpeaking(true)

    source.onended = () => {
      scheduledSourcesRef.current = scheduledSourcesRef.current.filter(s => s !== source)
      if (scheduledSourcesRef.current.length === 0) setIsSpeaking(false)
    }
  }, [])

  const endSession = useCallback(() => {
    isActiveRef.current = false
    cancelPlayback()

    if (processorRef.current) {
      try { processorRef.current.disconnect() } catch (_) {}
      processorRef.current = null
    }
    if (silentGainRef.current) {
      try { silentGainRef.current.disconnect() } catch (_) {}
      silentGainRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
    if (sessionRef.current) {
      try { sessionRef.current.close() } catch (_) {}
      sessionRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }

    setIsConnected(false)
    setIsListening(false)
    setIsSpeaking(false)
  }, [cancelPlayback])

  // Call this INSIDE a user gesture handler — required by iOS Safari for AudioContext + getUserMedia
  const startSession = useCallback(async (systemPrompt) => {
    setError(null)
    isActiveRef.current = true
    modelIdxRef.current = 0
    systemPromptRef.current = systemPrompt

    // Step 1: Create + resume AudioContext inside the gesture (iOS Safari audio unlock)
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC()
    audioCtxRef.current = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    // Step 2: Acquire mic inside the gesture (iOS Safari permission)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: MIC_SAMPLE_RATE,
        }
      })
      micStreamRef.current = stream
    } catch (err) {
      console.error('[WandaLive] Mic access denied:', err)
      setError('Microphone access is required.')
      ctx.close().catch(() => {})
      audioCtxRef.current = null
      isActiveRef.current = false
      return
    }

    // Step 3: Wire mic → PCM capture pipeline (stays open across model fallbacks)
    // ScriptProcessorNode: mic audio → downsample to 16kHz → base64 PCM → session.sendRealtimeInput
    // silentGain(0) → destination keeps onaudioprocess firing without mic bleed to speakers
    const actualRate = ctx.sampleRate
    const micSource = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const silentGain = ctx.createGain()
    silentGain.gain.value = 0

    processor.onaudioprocess = (ev) => {
      if (!sessionRef.current || !isActiveRef.current) return

      const inputData = ev.inputBuffer.getChannelData(0)
      const ratio = MIC_SAMPLE_RATE / actualRate
      const outLen = Math.floor(inputData.length * ratio)

      // Nearest-neighbour downsample (sufficient for voice at 16kHz)
      const int16 = new Int16Array(outLen)
      for (let i = 0; i < outLen; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, inputData[Math.floor(i / ratio)] * 32767))
      }

      // Uint8Array → binary string → base64
      const bytes = new Uint8Array(int16.buffer)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])

      try {
        sessionRef.current.sendRealtimeInput({
          audio: { data: btoa(bin), mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}` }
        })
      } catch (_) {}
    }

    micSource.connect(processor)
    processor.connect(silentGain)
    silentGain.connect(ctx.destination)
    processorRef.current = processor
    silentGainRef.current = silentGain

    // Step 4: Open Gemini Live session — stored in ref so onclose can call it for fallback
    // Uses v1beta (not v1alpha) since we're using the real API key, not an ephemeral token
    const openLiveSession = async (modelIdx) => {
      if (!isActiveRef.current) return
      const model = LIVE_MODELS[modelIdx]
      console.log(`[WandaLive] Trying model: ${model}`)

      let ephemeralToken
      try {
        ephemeralToken = await fetchEphemeralToken(model)
      } catch (err) {
        console.error('[WandaLive] Failed to fetch ephemeral token:', err)
        setError('Could not authenticate. Please try again.')
        isActiveRef.current = false
        return
      }

      const ai = new GoogleGenAI({ apiKey: ephemeralToken, httpOptions: { apiVersion: 'v1beta' } })
      let session
      try {
        session = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            ...(systemPromptRef.current && {
              systemInstruction: { parts: [{ text: systemPromptRef.current }] }
            }),
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }
            },
          },
          callbacks: {
            onopen() {
              console.log('[WandaLive] Session opened:', model)
              setIsConnected(true)
              setIsListening(true)
              triggerHaptic?.()
            },
            onmessage(message) {
              if (!isActiveRef.current) return

              // Receive audio chunks and queue them for gapless playback
              const parts = message.serverContent?.modelTurn?.parts ?? []
              for (const part of parts) {
                if (part.inlineData?.mimeType?.startsWith('audio/pcm')) {
                  playPCMChunk(part.inlineData.data)
                }
              }

              // Gemini finished its turn — resume listening
              if (message.serverContent?.turnComplete) {
                setIsListening(true)
              }

              // User's voice interrupted Gemini — discard buffered audio
              if (message.serverContent?.interrupted) {
                cancelPlayback()
                setIsListening(true)
              }
            },
            onerror(e) {
              console.error('[WandaLive] Session error:', e)
              setError('Connection lost. Tap to reconnect.')
              endSession()
            },
            onclose(e) {
              console.log('[WandaLive] Session closed:', e?.reason)
              if (!isActiveRef.current) return

              // Model not found — try next fallback
              const reason = e?.reason ?? ''
              const isModelError = reason.includes('is not found') || reason.includes('not found')
              const nextIdx = modelIdxRef.current + 1
              if (isModelError && nextIdx < LIVE_MODELS.length) {
                console.log(`[WandaLive] Model unavailable, falling back to: ${LIVE_MODELS[nextIdx]}`)
                modelIdxRef.current = nextIdx
                cancelPlayback()
                setIsConnected(false)
                setIsListening(false)
                sessionRef.current = null
                openLiveSessionRef.current(nextIdx)
              } else {
                endSession()
              }
            },
          },
        })
      } catch (err) {
        console.error('[WandaLive] Failed to connect to Gemini Live:', err)
        setError('Could not connect. Check your network.')
        isActiveRef.current = false
        return
      }
      sessionRef.current = session
    }

    openLiveSessionRef.current = openLiveSession
    await openLiveSession(0)
  }, [playPCMChunk, cancelPlayback, endSession])

  // Cleanup on unmount
  useEffect(() => () => endSession(), [endSession])

  return { isConnected, isListening, isSpeaking, error, startSession, endSession }
}
