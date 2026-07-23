/**
 * Speech-to-text service layer.
 *
 * This is the voice-pipeline hook point: the UI depends only on the
 * {@link TranscriptionService} interface, and {@link createTranscription}
 * picks a concrete backend. Today that's the browser's built-in Web Speech API
 * (no key, no extra deps). A future cloud backend — e.g. streaming the mic to
 * Whisper via the main process, exactly like `services/assistant.ts` does for
 * the LLM — can implement the same interface and be returned here, with zero
 * changes to the components or the animation layer.
 */

export interface TranscriptionHandlers {
  /** Interim (still-changing) transcript for live display. */
  onPartial?: (text: string) => void
  /** A finalised utterance, ready to act on. */
  onFinal?: (text: string) => void
  /** A recognition error (permission denied, no speech, network, …). */
  onError?: (message: string) => void
  /** Recognition ended (naturally or via stop). */
  onEnd?: () => void
}

export interface TranscriptionService {
  /** Whether this environment can actually transcribe. */
  readonly supported: boolean
  /** Begin listening. No-op if already running. */
  start(handlers: TranscriptionHandlers): void
  /** Stop and finalise the current utterance. */
  stop(): void
  /** Stop immediately, discarding any pending result. */
  abort(): void
}

// --- Minimal Web Speech API typings (not in the standard TS DOM lib) ---------
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionResultListLike {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResultLike
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string
  readonly message: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Human-readable messages for the Web Speech error codes we care about. */
const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was denied.',
  'service-not-allowed': 'Speech recognition is not permitted here.',
  'no-speech': "I didn't catch that — try again.",
  network: 'Speech recognition is unavailable (no network service).',
  aborted: '' // user-initiated; not surfaced as an error
}

/** Web Speech API implementation (Chromium's built-in recognizer). */
export class WebSpeechTranscription implements TranscriptionService {
  private readonly ctor = getRecognitionCtor()
  private recognition: SpeechRecognitionLike | null = null

  get supported(): boolean {
    return this.ctor !== null
  }

  start(handlers: TranscriptionHandlers): void {
    if (!this.ctor || this.recognition) return
    const rec = new this.ctor()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) final += text
        else interim += text
      }
      if (interim) handlers.onPartial?.(interim.trim())
      if (final) handlers.onFinal?.(final.trim())
    }

    rec.onerror = (event) => {
      const message = ERROR_MESSAGES[event.error] ?? `Speech error: ${event.error}`
      if (message) handlers.onError?.(message)
    }

    rec.onend = () => {
      this.recognition = null
      handlers.onEnd?.()
    }

    this.recognition = rec
    rec.start()
  }

  stop(): void {
    this.recognition?.stop()
  }

  abort(): void {
    this.recognition?.abort()
    this.recognition = null
  }
}

/** Fallback when no recognizer is available — reports unsupported. */
export class NullTranscription implements TranscriptionService {
  readonly supported = false
  start(handlers: TranscriptionHandlers): void {
    handlers.onError?.('Voice input is not available in this environment.')
    handlers.onEnd?.()
  }
  stop(): void {
    /* no-op */
  }
  abort(): void {
    /* no-op */
  }
}

/** Factory: the single seam where the concrete STT backend is chosen. */
export function createTranscription(): TranscriptionService {
  const service = new WebSpeechTranscription()
  return service.supported ? service : new NullTranscription()
}
