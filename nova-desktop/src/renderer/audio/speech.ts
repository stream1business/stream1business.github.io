/**
 * Text-to-speech service layer — NOVA speaking its replies aloud.
 *
 * The UI depends only on {@link SpeechService}; {@link getSpeechService} returns
 * a process-wide singleton so any part of the app can barge-in (cancel current
 * speech when a new question is asked or the mic opens). The default backend is
 * the browser's `speechSynthesis`, which — unlike `SpeechRecognition` — works
 * reliably in Electron because it uses the OS voices (offline, no key). A cloud
 * TTS backend (e.g. streamed audio from the main process) can implement the
 * same interface and be returned from {@link createSpeech}.
 */

export interface SpeechService {
  /** Whether this environment can synthesise speech. */
  readonly supported: boolean
  /** Speak `text`, resolving when playback ends (or is cancelled). */
  speak(text: string): Promise<void>
  /** Stop any current and queued speech immediately. */
  cancel(): void
}

/** `speechSynthesis`-backed implementation using the platform's voices. */
export class WebSpeechSynthesis implements SpeechService {
  readonly supported = true
  private readonly synth: SpeechSynthesis = window.speechSynthesis
  private voice: SpeechSynthesisVoice | null = null

  constructor() {
    this.selectVoice()
    // Voices often load asynchronously; re-select when they arrive.
    this.synth.addEventListener?.('voiceschanged', () => this.selectVoice())
  }

  /** Pick a pleasant English voice for NOVA, falling back to the default. */
  private selectVoice(): void {
    const voices = this.synth.getVoices()
    if (voices.length === 0) return
    const preferred = ['samantha', 'google us english', 'aria', 'jenny', 'zira', 'female']
    const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
    this.voice =
      english.find((v) => preferred.some((p) => v.name.toLowerCase().includes(p))) ??
      english[0] ??
      voices[0] ??
      null
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      const spoken = text.trim()
      if (!spoken) {
        resolve()
        return
      }
      this.synth.cancel() // never overlap utterances
      const utterance = new SpeechSynthesisUtterance(spoken)
      if (this.voice) utterance.voice = this.voice
      utterance.rate = 1.0
      utterance.pitch = 1.0
      // Both fire terminal — resolve on either so the caller never hangs.
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      this.synth.speak(utterance)
    })
  }

  cancel(): void {
    this.synth.cancel()
  }
}

/** No-op fallback when speech synthesis is unavailable. */
export class NullSpeech implements SpeechService {
  readonly supported = false
  async speak(): Promise<void> {
    /* nothing to say */
  }
  cancel(): void {
    /* no-op */
  }
}

/** Factory: the single seam where the concrete TTS backend is chosen. */
export function createSpeech(): SpeechService {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return new WebSpeechSynthesis()
  }
  return new NullSpeech()
}

let singleton: SpeechService | null = null

/** Process-wide speech service, so barge-in cancellation is shared. */
export function getSpeechService(): SpeechService {
  if (!singleton) singleton = createSpeech()
  return singleton
}
