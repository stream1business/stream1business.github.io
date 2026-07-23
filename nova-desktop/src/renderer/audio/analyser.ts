import type { AudioLevels } from '@shared/types'

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

  /** Smoothed RMS envelope (exponential moving average). */
  private emaRms = 0
  /** Refractory guard so a single onset doesn't fire many peaks. */
  private peakCooldown = 0

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

    // --- RMS from the time-domain signal (true loudness) ---
    let sumSquares = 0
    for (let i = 0; i < this.timeData.length; i++) {
      const centred = (this.timeData[i] - 128) / 128 // -1..1
      sumSquares += centred * centred
    }
    const rawRms = Math.min(1, Math.sqrt(sumSquares / this.timeData.length) * 3)

    // --- Exponential moving average so glow breathes, not flickers ---
    const a = this.options.smoothingFactor
    this.emaRms = a * rawRms + (1 - a) * this.emaRms

    // --- Onset / syllable-peak detection on the envelope ---
    let peak = false
    if (this.peakCooldown > 0) this.peakCooldown--
    const overshoot = rawRms - this.emaRms
    if (
      this.peakCooldown === 0 &&
      this.emaRms > 0.04 &&
      overshoot > this.options.peakThreshold * this.emaRms
    ) {
      peak = true
      this.peakCooldown = 6 // frames of refractory period
    }

    // --- Coarse 3-band frequency energy for extra visual texture ---
    const bands = this.computeBands()

    return { rms: this.emaRms, rawRms, peak, bands }
  }

  private computeBands(): { low: number; mid: number; high: number } {
    const n = this.freqData.length
    if (n === 0) return { low: 0, mid: 0, high: 0 }
    const lowEnd = Math.floor(n * 0.1)
    const midEnd = Math.floor(n * 0.4)

    const avg = (from: number, to: number): number => {
      let sum = 0
      for (let i = from; i < to; i++) sum += this.freqData[i]
      const count = Math.max(1, to - from)
      return sum / count / 255
    }

    return {
      low: avg(0, lowEnd),
      mid: avg(lowEnd, midEnd),
      high: avg(midEnd, n)
    }
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
    this.emaRms = 0
    this.peakCooldown = 0
  }
}
