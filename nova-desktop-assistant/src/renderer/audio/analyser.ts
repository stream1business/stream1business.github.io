import type { AudioLevels } from '@shared/types'

export interface AnalyserOptions {
  /** EMA smoothing factor for the volume envelope, 0..1 (lower = smoother). */
  smoothingFactor: number
  /** Raw-volume threshold above which an onset may be reported, 0..1. */
  onsetThreshold: number
}

/**
 * Wraps a Web Audio `AnalyserNode` and turns raw frequency data into the
 * higher-level measurements the animation layer consumes: a smoothed volume
 * envelope, per-band energy, and syllable-like onset detection.
 *
 * This class deliberately owns *only* analysis. The underlying `MediaStream`
 * lives in the mic hook, so the same stream can later be tee'd off to a
 * speech-to-text service without touching anything here.
 */
export class NovaAnalyser {
  private readonly analyser: AnalyserNode
  private readonly freq: Uint8Array<ArrayBuffer>
  private readonly time: Uint8Array<ArrayBuffer>
  private smoothedVolume = 0
  private prevVolume = 0
  private opts: AnalyserOptions

  constructor(context: AudioContext, source: AudioNode, opts: AnalyserOptions) {
    this.opts = opts
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.6
    source.connect(analyser)
    this.analyser = analyser
    this.freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
    this.time = new Uint8Array(new ArrayBuffer(analyser.fftSize))
  }

  updateOptions(opts: AnalyserOptions): void {
    this.opts = opts
  }

  /** Sample the current frame and return derived levels. Call ~30–60/s. */
  sample(): AudioLevels {
    this.analyser.getByteFrequencyData(this.freq)
    this.analyser.getByteTimeDomainData(this.time)

    // RMS from the time-domain signal centred on 128 (silence).
    let sumSquares = 0
    for (let i = 0; i < this.time.length; i++) {
      const v = (this.time[i] - 128) / 128
      sumSquares += v * v
    }
    const rms = Math.sqrt(sumSquares / this.time.length)
    // Perceptual boost — speech RMS is small, so scale into a usable 0..1.
    const rawVolume = Math.min(1, rms * 3.2)

    // Exponential moving average so the glow breathes rather than flickers.
    const a = this.opts.smoothingFactor
    this.smoothedVolume = a * rawVolume + (1 - a) * this.smoothedVolume

    // Onset detection: a sharp rise above threshold since the last frame.
    const rising = rawVolume - this.prevVolume
    const peak = rawVolume > this.opts.onsetThreshold && rising > 0.06
    this.prevVolume = rawVolume

    return {
      volume: this.smoothedVolume,
      rawVolume,
      peak,
      bands: this.computeBands()
    }
  }

  /** Average energy across low / mid / high thirds of the spectrum, 0..1. */
  private computeBands(): AudioLevels['bands'] {
    const n = this.freq.length
    const third = Math.floor(n / 3)
    const avg = (start: number, end: number): number => {
      let sum = 0
      for (let i = start; i < end; i++) sum += this.freq[i]
      return sum / ((end - start) * 255)
    }
    return {
      low: avg(0, third),
      mid: avg(third, third * 2),
      high: avg(third * 2, n)
    }
  }
}
