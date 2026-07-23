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

/**
 * Cloud (Whisper) implementation. Records the mic with `MediaRecorder` and
 * hands the clip to the main process, which calls the transcription API. Unlike
 * the streaming Web Speech recognizer this is record-then-transcribe: there are
 * no interim results, and the utterance is finalised when {@link stop} is
 * called. Reliable regardless of Electron's Web Speech support.
 */
export class WhisperTranscription implements TranscriptionService {
  readonly supported = true
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private handlers: TranscriptionHandlers = {}

  /** Prefer a compressed format the transcription API accepts. */
  private pickMimeType(): string | undefined {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    return candidates.find((t) => MediaRecorder.isTypeSupported(t))
  }

  start(handlers: TranscriptionHandlers): void {
    this.handlers = handlers
    this.chunks = []
    void this.begin()
  }

  private async begin(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      this.handlers.onError?.('Microphone access was denied.')
      this.handlers.onEnd?.()
      return
    }
    const mimeType = this.pickMimeType()
    const rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    rec.onstop = () => void this.finish()
    this.recorder = rec
    rec.start()
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }

  private async finish(): Promise<void> {
    const mimeType = this.recorder?.mimeType || 'audio/webm'
    const blob = new Blob(this.chunks, { type: mimeType })
    this.recorder = null
    this.releaseStream()

    if (blob.size === 0) {
      this.handlers.onEnd?.()
      return
    }
    try {
      const audio = await blob.arrayBuffer()
      const { text } = await window.nova.transcription.transcribe(audio, mimeType)
      if (text) this.handlers.onFinal?.(text.trim())
    } catch (err) {
      this.handlers.onError?.(err instanceof Error ? err.message : 'Transcription failed.')
    } finally {
      this.handlers.onEnd?.()
    }
  }

  stop(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
  }

  abort(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null
      this.recorder.stop()
    }
    this.recorder = null
    this.chunks = []
    this.releaseStream()
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

/**
 * Factory: the single seam where the concrete STT backend is chosen.
 *
 * Prefers the cloud Whisper backend when it's configured (an API key is set in
 * the main process), since it's reliable everywhere. Otherwise falls back to
 * the browser's Web Speech recognizer, then to the no-op service. Async because
 * the "is the cloud backend configured?" check crosses the IPC bridge.
 */
export async function createTranscription(): Promise<TranscriptionService> {
  const bridge = typeof window !== 'undefined' ? window.nova?.transcription : undefined
  if (bridge && (await bridge.isConfigured())) {
    return new WhisperTranscription()
  }
  const webSpeech = new WebSpeechTranscription()
  return webSpeech.supported ? webSpeech : new NullTranscription()
}
