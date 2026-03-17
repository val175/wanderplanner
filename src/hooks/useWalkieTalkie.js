import { useState, useRef, useEffect, useCallback } from 'react'
import { auth } from '../firebase/config'

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

const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsgU291bmQgRWZmZWN0cyBMaWJyYXJ5//uQwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAA5TFNBTUU9My45OXIxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const MAX_STT_RETRIES = 12
const RETRY_DELAY_MS = 2000

export function useWalkieTalkie({ onTranscriptReady }) {
  const [isWalkieTalkieMode, setIsWalkieTalkieMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMicPreparing, setIsMicPreparing] = useState(false)
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  const nextTTSAudioRef = useRef(null)
  const playbackRef = useRef(null)
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
    if (playbackRef.current) {
      playbackRef.current.onended = null
      playbackRef.current.onerror = null
      playbackRef.current.pause()
      // Aggressively detach the media source to release the iOS audio session
      playbackRef.current.removeAttribute('src')
      playbackRef.current.load()
      playbackRef.current = null
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
    recognition.start()
    setIsListening(true)
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

      const { audioContent, mimeType } = await res.json()
      if (!audioContent) {
        console.warn('[useWalkieTalkie] Empty audioContent')
        setIsSpeaking(false)
        return
      }

      const binary = atob(audioContent)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' })
      const blobUrl = URL.createObjectURL(blob)

      const audio = nextTTSAudioRef.current
      nextTTSAudioRef.current = null

      if (!audio) {
        console.warn('[useWalkieTalkie] No pre-activated audio element — mic was not tapped')
        URL.revokeObjectURL(blobUrl)
        setIsSpeaking(false)
        return
      }

      playbackRef.current = audio
      audio.src = blobUrl
      audio.volume = 1

      audio.onended = () => {
        URL.revokeObjectURL(blobUrl)
        // Aggressively detach the media source to release the iOS audio session
        audio.removeAttribute('src')
        audio.load()
        lastTTSEndTimeRef.current = Date.now()
        console.log('[WT] TTS audio ended naturally — stamped lastTTSEndTime')
        setIsSpeaking(false)
      }
      audio.onerror = () => {
        console.warn('[useWalkieTalkie] Audio playback error code:', audio.error?.code, audio.error?.message)
        URL.revokeObjectURL(blobUrl)
        audio.removeAttribute('src')
        audio.load()
        setIsSpeaking(false)
      }

      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('[useWalkieTalkie] Play rejected:', err.name, err.message)
          URL.revokeObjectURL(blobUrl)
          audio.removeAttribute('src')
          audio.load()
          setIsSpeaking(false)
        })
      }
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
        if (nextTTSAudioRef.current) {
          nextTTSAudioRef.current.pause()
          nextTTSAudioRef.current.removeAttribute('src')
          nextTTSAudioRef.current.load()
          nextTTSAudioRef.current = null
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

    if (nextTTSAudioRef.current) {
      nextTTSAudioRef.current.pause()
      nextTTSAudioRef.current.removeAttribute('src')
      nextTTSAudioRef.current.load()
      nextTTSAudioRef.current = null
    }

    setIsListening(true)
    setIsMicPreparing(false)

    const ttsAudio = new Audio()
    ttsAudio.src = SILENT_MP3
    ttsAudio.volume = 0

    // Called *after* the audio session successfully unlocks
    const proceed = () => {
      ttsAudio.pause()
      // Safely detach the silent source so it doesn't hold the Playback category
      ttsAudio.removeAttribute('src')
      ttsAudio.load()
      ttsAudio.volume = 1
      nextTTSAudioRef.current = ttsAudio

      // Safely probe the microphone now that we know play() is finished locking the session
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

    const playPromise = ttsAudio.play()
    if (playPromise !== undefined) {
      playPromise.then(proceed).catch(err => {
        console.warn('[WT] activateAudio play rejected:', err.name, err.message)
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
      if (nextTTSAudioRef.current) {
        nextTTSAudioRef.current.pause()
        nextTTSAudioRef.current.removeAttribute('src')
        nextTTSAudioRef.current.load()
        nextTTSAudioRef.current = null
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
