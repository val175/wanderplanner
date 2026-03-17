import { useState, useRef, useEffect, useCallback } from 'react'
import { auth } from '../firebase/config'
import { triggerHaptic } from '../utils/haptics'

const TTS_URL = 'https://wanderplan-rust.vercel.app/api/tts'
const MAX_TTS_SENTENCES = 3

function truncateForSpeech(text) {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || []
  if (sentences.length <= MAX_TTS_SENTENCES) return text
  return sentences.slice(0, MAX_TTS_SENTENCES).join('').trim()
}

const isSTTSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

const MAX_STT_RETRIES = 12
const RETRY_DELAY_MS = 2000

export function useWalkieTalkie({ onTranscriptReady }) {
  const [isWalkieTalkieMode, setIsWalkieTalkieMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMicPreparing, setIsMicPreparing] = useState(false)
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  
  // Replace HTML5 Audio with Web Audio API context and source refs
  const audioCtxRef = useRef(null)
  const audioSourceRef = useRef(null)
  
  const isModeRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const sttRetryCountRef = useRef(0)
  const lastTTSEndTimeRef = useRef(0)
  const retryTimeoutRef = useRef(null)
  const startListeningRef = useRef(null)

  useEffect(() => { isModeRef.current = isWalkieTalkieMode }, [isWalkieTalkieMode])

  const cancelRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [])

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.onended = null
        audioSourceRef.current.stop()
        audioSourceRef.current.disconnect()
      } catch (e) {
        // Ignore if already stopped
      }
      audioSourceRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    if (!isSTTSupported || !isModeRef.current) {
      console.log('[WT] startListening blocked — isSTTSupported:', isSTTSupported, 'isModeRef:', isModeRef.current)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition
    finalTranscriptRef.current = ''
    const startedAt = Date.now()

    let watchdog = setTimeout(() => {
      if (recognitionRef.current === recognition) {
        console.warn('[WT] watchdog fired — recognition got no events for 10s')
        try { recognition.abort() } catch (_) {}
        setIsListening(false)
        setIsMicPreparing(false)
        sttRetryCountRef.current = 0
      }
    }, 10000)
    const clearWatchdog = () => { clearTimeout(watchdog); watchdog = null }

    recognition.onresult = (event) => {
      clearWatchdog()
      setIsMicPreparing(false)
      sttRetryCountRef.current = 0
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) {
        finalTranscriptRef.current = final
        console.log('[WT] onresult FINAL:', final)
      } else {
        console.log('[WT] onresult interim:', interim)
      }
      setTranscript(finalTranscriptRef.current || interim)
    }

    recognition.onend = () => {
      clearWatchdog()
      const final = finalTranscriptRef.current.trim()
      console.log('[WT] onend — final transcript:', final ? `"${final}"` : '(empty)')
      if (sttRetryCountRef.current === 0) {
        setIsListening(false)
        setIsMicPreparing(false)
      }
      if (!isModeRef.current) return
      if (final) {
        sttRetryCountRef.current = 0
        setTranscript('')
        onTranscriptReady(final)
      }
    }

    recognition.onerror = (event) => {
      clearWatchdog()
      const msSinceStart = Date.now() - startedAt

      const isSessionConflict = event.error === 'aborted' && msSinceStart < 8000
      if (isSessionConflict && isModeRef.current && sttRetryCountRef.current < MAX_STT_RETRIES) {
        sttRetryCountRef.current++
        console.log(`[WT] session conflict abort (${msSinceStart}ms) — retrying in ${RETRY_DELAY_MS}ms (${sttRetryCountRef.current}/${MAX_STT_RETRIES})`)
        setIsMicPreparing(true)

        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null
          if (!isModeRef.current) {
            setIsListening(false)
            setIsMicPreparing(false)
            sttRetryCountRef.current = 0
            return
          }
          if (navigator.mediaDevices?.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
              .then(stream => {
                stream.getTracks().forEach(t => t.stop())
                console.log(`[WT] retry ${sttRetryCountRef.current}: getUserMedia probe OK`)
                startListeningRef.current?.()
              })
              .catch(err => {
                console.warn(`[WT] retry ${sttRetryCountRef.current}: getUserMedia failed (${err.name}) — trying directly`)
                startListeningRef.current?.()
              })
          } else {
            startListeningRef.current?.()
          }
        }, RETRY_DELAY_MS)
        return
      }

      sttRetryCountRef.current = 0
      setIsListening(false)
      setIsMicPreparing(false)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[WT] onerror:', event.error, `(${msSinceStart}ms)`, '(unexpected)')
      } else {
        console.log('[WT] onerror:', event.error, `(${msSinceStart}ms)`, isSessionConflict ? '— max retries reached' : '(ignorable)')
      }
    }

    console.log('[WT] recognition.start() called')
    try {
      recognition.start()
      setIsListening(true)

      // Fire the haptic buzz to confirm the mic is ready
      if (typeof triggerHaptic === 'function') {
        triggerHaptic()
      } else if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    } catch (err) {
      console.error('[WT] recognition.start() error:', err)
    }
  }, [onTranscriptReady])

  useEffect(() => { startListeningRef.current = startListening }, [startListening])

  const speak = useCallback(async (text) => {
    if (!text?.trim() || !isModeRef.current) return

    stopAudio()
    setIsSpeaking(true)

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: truncateForSpeech(text) }),
      })

      if (!res.ok) {
        console.warn('[useWalkieTalkie] TTS failed:', res.status)
        setIsSpeaking(false)
        return
      }

      const { audioContent } = await res.json()
      if (!audioContent) {
        console.warn('[useWalkieTalkie] Empty audioContent')
        setIsSpeaking(false)
        return
      }

      // Safeguard: Initialize AudioContext if it wasn't captured on gesture
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        audioCtxRef.current = new AudioContext()
      }

      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      // Convert Base64 string directly to an ArrayBuffer for the Web Audio API
      const binary = atob(audioContent)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      // Decode the audio data asynchronously
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer)

      // Create a buffer source and connect it to the destination (speakers)
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      audioSourceRef.current = source

      source.onended = () => {
        lastTTSEndTimeRef.current = Date.now()
        console.log('[WT] AudioContext playback ended naturally')
        setIsSpeaking(false)
        audioSourceRef.current = null
      }

      source.start(0)

    } catch (err) {
      console.error('[useWalkieTalkie] speak error:', err)
      setIsSpeaking(false)
    }
  }, [stopAudio])

  const stopListening = useCallback(() => {
    cancelRetry()
    sttRetryCountRef.current = 0
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (_) {}
    }
    setIsListening(false)
    setIsMicPreparing(false)
  }, [cancelRetry])

  const toggleWalkieTalkieMode = useCallback(() => {
    setIsWalkieTalkieMode(prev => {
      if (prev) {
        cancelRetry()
        sttRetryCountRef.current = 0
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch (_) {}
        }
        stopAudio()
        
        // Clean up the AudioContext entirely when exiting Walkie Talkie mode
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {})
          audioCtxRef.current = null
        }
        
        setIsListening(false)
        setIsSpeaking(false)
        setIsMicPreparing(false)
        setTranscript('')
        isModeRef.current = false
      } else {
        isModeRef.current = true
      }
      return !prev
    })
  }, [stopAudio, cancelRetry])

  const startListeningFromGesture = useCallback(() => {
    stopAudio()
    setIsSpeaking(false)
    cancelRetry()
    sttRetryCountRef.current = 0

    setIsListening(true)
    setIsMicPreparing(false)

    // INITIALIZE AUDIO CONTEXT ON GESTURE
    // This unlocks the audio capabilities for iOS Safari immediately during the tap
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      audioCtxRef.current = new AudioContext()
    }

    const ctx = audioCtxRef.current

    const proceed = () => {
      if (lastTTSEndTimeRef.current > 0 && navigator.mediaDevices?.getUserMedia) {
        const msSinceLastTTS = Date.now() - lastTTSEndTimeRef.current
        console.log(`[WT] mic tap — ${msSinceLastTTS}ms since last TTS — probing session sequentially`)
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            stream.getTracks().forEach(t => t.stop())
            if (isModeRef.current) startListening()
          })
          .catch(err => {
            console.warn('[WT] getUserMedia probe failed:', err.name, '— starting directly')
            if (isModeRef.current) startListening()
          })
      } else {
        startListening()
      }
    }

    // iOS requires AudioContext to be resumed during a user gesture if it starts suspended
    if (ctx.state === 'suspended') {
      ctx.resume().then(proceed).catch(err => {
        console.warn('[WT] AudioContext resume rejected:', err)
        proceed()
      })
    } else {
      proceed()
    }
  }, [startListening, stopAudio, cancelRetry])

  useEffect(() => {
    return () => {
      isModeRef.current = false
      cancelRetry()
      sttRetryCountRef.current = 0
      try { recognitionRef.current?.abort() } catch (_) {}
      stopAudio()
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [stopAudio, cancelRetry])

  return {
    isWalkieTalkieMode,
    isListening,
    isSpeaking,
    isMicPreparing,
    transcript,
    isSTTSupported,
    toggleWalkieTalkieMode,
    startListening: startListeningFromGesture,
    stopListening,
    speak,
  }
}
