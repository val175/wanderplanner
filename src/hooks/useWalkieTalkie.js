import { useState, useRef, useEffect, useCallback } from 'react'
import { auth } from '../firebase/config'

const isSTTSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

export function useWalkieTalkie({ onTranscriptReady }) {
  const [isWalkieTalkieMode, setIsWalkieTalkieMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  const audioRef = useRef(null)
  const isModeRef = useRef(false) // mirror of isWalkieTalkieMode for use inside callbacks
  const finalTranscriptRef = useRef('')

  // Keep isModeRef in sync
  useEffect(() => {
    isModeRef.current = isWalkieTalkieMode
  }, [isWalkieTalkieMode])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
  }, [])

  const stopListeningImpl = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (_) {}
    }
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!isSTTSupported || !isModeRef.current) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition
    finalTranscriptRef.current = ''

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) finalTranscriptRef.current = final
      setTranscript(finalTranscriptRef.current || interim)
    }

    recognition.onend = () => {
      setIsListening(false)
      const final = finalTranscriptRef.current.trim()
      if (final) {
        setTranscript('')
        onTranscriptReady(final)
      }
    }

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('[useWalkieTalkie] STT error:', event.error)
      }
      setIsListening(false)
    }

    recognition.start()
    setIsListening(true)
  }, [onTranscriptReady])

  const speak = useCallback(async (text) => {
    if (!text?.trim() || !isModeRef.current) return

    stopAudio()
    setIsSpeaking(true)

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('https://wanderplan-rust.vercel.app/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        console.warn('[useWalkieTalkie] TTS fetch failed:', res.status)
        setIsSpeaking(false)
        if (isModeRef.current) startListening()
        return
      }

      const { audioContent, mimeType } = await res.json()
      if (!audioContent) {
        setIsSpeaking(false)
        if (isModeRef.current) startListening()
        return
      }

      const audio = new Audio(`data:${mimeType || 'audio/wav'};base64,${audioContent}`)
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        audioRef.current = null
        if (isModeRef.current) startListening()
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        audioRef.current = null
        if (isModeRef.current) startListening()
      }

      await audio.play()
    } catch (err) {
      console.error('[useWalkieTalkie] speak error:', err)
      setIsSpeaking(false)
      if (isModeRef.current) startListening()
    }
  }, [stopAudio, startListening])

  const stopListening = useCallback(() => {
    stopListeningImpl()
  }, [stopListeningImpl])

  const toggleWalkieTalkieMode = useCallback(() => {
    setIsWalkieTalkieMode(prev => {
      if (prev) {
        // Turning off — clean up everything
        stopListeningImpl()
        stopAudio()
        setIsListening(false)
        setIsSpeaking(false)
        setTranscript('')
        isModeRef.current = false
      } else {
        isModeRef.current = true
      }
      return !prev
    })
  }, [stopListeningImpl, stopAudio])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isModeRef.current = false
      try { recognitionRef.current?.abort() } catch (_) {}
      stopAudio()
    }
  }, [stopAudio])

  return {
    isWalkieTalkieMode,
    isListening,
    isSpeaking,
    transcript,
    isSTTSupported,
    toggleWalkieTalkieMode,
    startListening,
    stopListening,
    speak,
  }
}
