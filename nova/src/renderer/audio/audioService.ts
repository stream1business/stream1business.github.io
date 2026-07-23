import type { AudioLevels } from '@shared/types'

/**
 * Local, service-free audio analysis layer.
 *
 * This class owns the mic `MediaStream`, the Web Audio graph and the
 * per-frame analysis that turns raw samples into {@link AudioLevels}. It does
 * NOT do any speech-to-text — but it is deliberately structured so a future
 * voice pipeline can tap the very same `MediaStream` (see {@link getStream})
 * and pipe it to Whisper/etc. without changing any animation code.
 */
export interface AudioServiceOptions {
  /** EMA smoothing factor for the volume envelope (0..1, lower = smoother). */
  smoothingFactor: number
  /** Onset detection sensitivity (0..1, higher = more peaks). */
  onsetSensitivity: number
  /** FFT size for the AnalyserNode (power of two). */
  fftSize?: number
}

export class AudioService {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null

  private freqData = new Uint8Array(0)
  private timeData = new Uint8Array(0)

  private smoothed = 0
  private prevSmoothed = 0
  private options: AudioServiceOptions

  constructor(options: AudioServiceOptions) {
    this.options = { fftSize: 1024, ...options }
  }

  /** Whether the mic graph is currently live. */
  get active(): boolean {
    return this.stream !== null
  }

  /** The underlying mic stream — the tap point for a future STT pipeline. */
  getStream(): MediaStream | null {
    return this.stream
  }

  updateOptions(patch: Partial<AudioServiceOptions>): void {
    this.options = { ...this.options, ...patch }
  }

  /** Request mic permission and build the analysis graph. */
  async start(): Promise<void> {
    if (this.active) return

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    })

    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = this.options.fftSize ?? 1024
    analyser.smoothingTimeConstant = 0.6

    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    // Intentionally not connected to ctx.destination — we analyse, not play back.

    this.stream = stream
    this.ctx = ctx
    this.analyser = analyser
    this.source = source
    this.freqData = new Uint8Array(analyser.frequencyBinCount)
    this.timeData = new Uint8Array(analyser.fftSize)
  }

  /** Tear down the graph and release the mic. */
  async stop(): Promise<void> {
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    if (this.ctx && this.ctx.state !== 'closed') {
      await this.ctx.close()
    }
    this.ctx = null
    this.analyser = null
    this.source = null
    this.stream = null
    this.smoothed = 0
    this.prevSmoothed = 0
  }

  /**
   * Analyse the current frame. Call this once per animation frame. Returns a
   * fresh {@link AudioLevels}; when the mic is inactive it returns silence.
   */
  sample(): AudioLevels {
    const analyser = this.analyser
    if (!analyser) {
      // Decay smoothly toward silence when inactive.
      this.smoothed *= 0.9
      return {
        volume: 0,
        smoothedVolume: this.smoothed,
        peak: false,
        bands: { low: 0, mid: 0, high: 0 }
      }
    }

    analyser.getByteTimeDomainData(this.timeData)
    analyser.getByteFrequencyData(this.freqData)

    // --- RMS volume from the time-domain signal ---------------------------
    let sumSq = 0
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128 // -1..1
      sumSq += v * v
    }
    const rms = Math.sqrt(sumSq / this.timeData.length)
    // Perceptual boost — quiet speech should still register visibly.
    const volume = Math.min(1, rms * 2.2)

    // --- Exponential moving average ---------------------------------------
    const a = this.options.smoothingFactor
    this.prevSmoothed = this.smoothed
    this.smoothed = this.smoothed + a * (volume - this.smoothed)

    // --- Onset / syllable detection ---------------------------------------
    // A peak is a sharp positive jump in the smoothed envelope above a floor.
    const delta = this.smoothed - this.prevSmoothed
    const threshold = 0.012 * (1.2 - this.options.onsetSensitivity)
    const peak = delta > threshold && this.smoothed > 0.06

    // --- Frequency bands (low/mid/high) -----------------------------------
    const bands = this.computeBands()

    return { volume, smoothedVolume: this.smoothed, peak, bands }
  }

  private computeBands(): AudioLevels['bands'] {
    const data = this.freqData
    const n = data.length
    if (n === 0) return { low: 0, mid: 0, high: 0 }

    const lowEnd = Math.floor(n * 0.1)
    const midEnd = Math.floor(n * 0.4)

    let low = 0
    let mid = 0
    let high = 0
    for (let i = 0; i < n; i++) {
      const v = data[i] / 255
      if (i < lowEnd) low += v
      else if (i < midEnd) mid += v
      else high += v
    }
    return {
      low: low / Math.max(1, lowEnd),
      mid: mid / Math.max(1, midEnd - lowEnd),
      high: high / Math.max(1, n - midEnd)
    }
  }
}
