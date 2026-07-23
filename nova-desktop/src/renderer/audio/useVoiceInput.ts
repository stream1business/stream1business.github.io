import { useCallback, useEffect, useRef, useState } from 'react'
import { createTranscription, type TranscriptionService } from './transcription'
import { useNovaStore } from '@renderer/state/store'

/**
 * React hook for speaking to NOVA.
 *
 * Owns the transcription lifecycle and surfaces the interim transcript for live
 * display. When an utterance finalises it invokes `onFinal(text)` — the caller
 * wires that to `useAssistant().ask`, so speech flows straight into the LLM.
 * While listening it holds the orb in the `listening` state; the assistant call
 * then drives `thinking → responding`.
 */
export function useVoiceInput(onFinal: (text: string) => void): {
  supported: boolean
  listening: boolean
  interim: string
  error: string | null
  start: () => void
  stop: () => void
} {
  const serviceRef = useRef<TranscriptionService | null>(null)
  if (!serviceRef.current) serviceRef.current = createTranscription()

  const setAssistantState = useNovaStore((s) => s.setAssistantState)

  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Keep the latest onFinal without re-subscribing recognition callbacks.
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  const start = useCallback(() => {
    const service = serviceRef.current
    if (!service || listening) return
    setError(null)
    setInterim('')
    setListening(true)
    setAssistantState('listening')
    service.start({
      onPartial: (text) => setInterim(text),
      onFinal: (text) => {
        setInterim('')
        setListening(false)
        if (text) onFinalRef.current(text)
      },
      onError: (message) => {
        setInterim('')
        setListening(false)
        if (message) setError(message)
      },
      onEnd: () => setListening(false)
    })
  }, [listening, setAssistantState])

  const stop = useCallback(() => {
    serviceRef.current?.stop()
    setListening(false)
  }, [])

  // Abort recognition if the component unmounts mid-listen.
  useEffect(() => {
    return () => serviceRef.current?.abort()
  }, [])

  return {
    supported: serviceRef.current.supported,
    listening,
    interim,
    error,
    start,
    stop
  }
}
