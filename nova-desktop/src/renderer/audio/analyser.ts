import type { AudioLevels } from '@shared/types'
import { EnvelopeTracker, computeBands, rmsFromTimeDomain } from './signal'

/**
 * Wraps a Web Audio `AnalyserNode` and turns raw frequency data into the
 * normalised {@link AudioLevels} the animation layer consumes.
 *
 * This is deliberately the ONLY place that touches the raw audio buffers.
 * A future speech-to-text pipeline can tap the same `MediaStream` (see
 * {@link AudioEngine.stream}) without any changes here or in the UI.
 */
export interface AnalyserOptions {
  /** EMA smoothing factor for the volume envelope (0–1, lower = smoother). */
  smoothingFactor: number
  /** Fractional overshoot of raw over smoothed RMS that counts as a peak. */
  peakThreshold: number
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0))
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0))

  /** Smoothed-envelope + onset detector (pure DSP, see signal.ts). */
  private envelope = new EnvelopeTracker()

  /** The live microphone stream — exposed for future STT consumers. */
  public stream: MediaStream | null = null

  constructor(private options: AnalyserOptions) {}

  /** Request the microphone and wire up the analyser graph. */
  async start(): Promise<void> {
    if (this.ctx) return
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false
      }
    })

    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.6

    const source = ctx.createMediaStreamSource(this.stream)
    source.connect(analyser)
    // Intentionally NOT connected to ctx.destination — we only analyse.

    this.ctx = ctx
    this.analyser = analyser
    this.source = source
    this.freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
    this.timeData = new Uint8Array(new ArrayBuffer(analyser.fftSize))
  }

  /** Whether the engine currently holds an open mic stream. */
  get isRunning(): boolean {
    return this.ctx !== null
  }

  /** Update tuning parameters live (e.g. from the settings panel). */
  setOptions(options: AnalyserOptions): void {
    this.options = options
  }

  /**
   * Sample the current frame. Call this once per animation frame.
   * Returns a fully-normalised {@link AudioLevels} snapshot.
   */
  sample(): AudioLevels {
    if (!this.analyser) {
      return { rms: 0, rawRms: 0, peak: false, bands: { low: 0, mid: 0, high: 0 } }
    }

    this.analyser.getByteFrequencyData(this.freqData)
    this.analyser.getByteTimeDomainData(this.timeData)

    // True loudness, then smooth + onset-detect, then band energy — all pure.
    const rawRms = rmsFromTimeDomain(this.timeData)
    const { rms, peak } = this.envelope.update(rawRms, this.options)
    const bands = computeBands(this.freqData)

    return { rms, rawRms, peak, bands }
  }

  /** Release the mic and tear down the audio graph. */
  async stop(): Promise<void> {
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    if (this.ctx) await this.ctx.close()
    this.ctx = null
    this.analyser = null
    this.source = null
    this.stream = null
    this.envelope.reset()
  }
}
