import { useCallback, useEffect, useRef, useState } from 'react'
import { createTranscription, type TranscriptionService } from './transcription'
import { getSpeechService } from './speech'
import { useNovaStore } from '@renderer/state/store'

/**
 * React hook for speaking to NOVA.
 *
 * Owns the transcription lifecycle and surfaces the interim transcript for live
 * display. When an utterance finalises it invokes `onFinal(text)` — the caller
 * wires that to `useAssistant().ask`, so speech flows straight into the LLM.
 * While listening it holds the orb in the `listening` state; the assistant call
 * then drives `thinking → responding`.
 *
 * The concrete backend (cloud Whisper vs. browser Web Speech) is resolved on
 * mount. Whisper is record-then-transcribe, so after `stop()` there's a short
 * `transcribing` phase with no interim text; Web Speech streams interim results
 * and finalises on its own.
 */
export function useVoiceInput(onFinal: (text: string) => void): {
  supported: boolean
  listening: boolean
  transcribing: boolean
  interim: string
  error: string | null
  start: () => void
  stop: () => void
} {
  const serviceRef = useRef<TranscriptionService | null>(null)
  const [supported, setSupported] = useState(false)
  const setAssistantState = useNovaStore((s) => s.setAssistantState)

  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Keep the latest onFinal without re-subscribing recognition callbacks.
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  // Resolve the backend once on mount (the choice crosses the IPC bridge).
  useEffect(() => {
    let alive = true
    void createTranscription().then((service) => {
      if (!alive) {
        service.abort()
        return
      }
      serviceRef.current = service
      setSupported(service.supported)
    })
    return () => {
      alive = false
      serviceRef.current?.abort()
    }
  }, [])

  const start = useCallback(() => {
    const service = serviceRef.current
    if (!service || listening || transcribing) return
    getSpeechService().cancel() // barge-in: stop NOVA speaking when you start talking
    setError(null)
    setInterim('')
    setListening(true)
    setAssistantState('listening')
    service.start({
      onPartial: (text) => setInterim(text),
      onFinal: (text) => {
        setInterim('')
        setListening(false)
        setTranscribing(false)
        if (text) onFinalRef.current(text)
      },
      onError: (message) => {
        setInterim('')
        setListening(false)
        setTranscribing(false)
        if (message) setError(message)
      },
      onEnd: () => {
        setListening(false)
        setTranscribing(false)
      }
    })
  }, [listening, transcribing, setAssistantState])

  const stop = useCallback(() => {
    if (!listening) return
    serviceRef.current?.stop()
    // Recording has ended; a cloud backend now transcribes before onFinal fires.
    setListening(false)
    setTranscribing(true)
  }, [listening])

  return { supported, listening, transcribing, interim, error, start, stop }
}
