/**
 * Pure DSP helpers for turning raw Web Audio buffers into the normalised
 * signals the animation layer consumes.
 *
 * Deliberately free of any Web Audio / DOM types so it can be unit-tested in a
 * plain Node environment. {@link AudioEngine} composes these; nothing else
 * should re-implement loudness, smoothing, or onset logic.
 */

/**
 * Root-mean-square loudness of a time-domain buffer.
 *
 * Samples are unsigned bytes centred on 128 (the Web Audio convention for
 * `getByteTimeDomainData`). The result is scaled by 3 and clamped to 0–1 so
 * ordinary speech lands in a usable range rather than hugging zero.
 */
export function rmsFromTimeDomain(timeData: ArrayLike<number>): number {
  const n = timeData.length
  if (n === 0) return 0
  let sumSquares = 0
  for (let i = 0; i < n; i++) {
    const centred = (timeData[i] - 128) / 128 // -1..1
    sumSquares += centred * centred
  }
  return Math.min(1, Math.sqrt(sumSquares / n) * 3)
}

/** Normalised low/mid/high band energies from a frequency-magnitude buffer. */
export function computeBands(freqData: ArrayLike<number>): {
  low: number
  mid: number
  high: number
} {
  const n = freqData.length
  if (n === 0) return { low: 0, mid: 0, high: 0 }
  const lowEnd = Math.floor(n * 0.1)
  const midEnd = Math.floor(n * 0.4)

  const avg = (from: number, to: number): number => {
    let sum = 0
    for (let i = from; i < to; i++) sum += freqData[i]
    return sum / Math.max(1, to - from) / 255
  }

  return {
    low: avg(0, lowEnd),
    mid: avg(lowEnd, midEnd),
    high: avg(midEnd, n)
  }
}

export interface EnvelopeOptions {
  /** EMA smoothing factor (0–1). Lower = smoother / slower to react. */
  smoothingFactor: number
  /** Fractional overshoot of raw over smoothed RMS that counts as a peak. */
  peakThreshold: number
}

export interface EnvelopeResult {
  /** The smoothed (EMA) RMS envelope. */
  rms: number
  /** Whether a syllable-onset peak fired this frame. */
  peak: boolean
}

/**
 * Tracks a smoothed loudness envelope and detects syllable-like onsets.
 *
 * Onset detection compares the instantaneous RMS against the smoothed envelope;
 * a sufficiently large positive overshoot fires a peak, after which a short
 * refractory period suppresses further peaks so one syllable yields one kick.
 */
export class EnvelopeTracker {
  private ema = 0
  private cooldown = 0

  /** Frames of refractory suppression after a peak. */
  static readonly REFRACTORY_FRAMES = 6
  /** Envelope must exceed this before any peak can fire (ignores noise floor). */
  static readonly MIN_ENERGY = 0.04

  /** Advance one frame with the current raw RMS. */
  update(rawRms: number, opts: EnvelopeOptions): EnvelopeResult {
    const a = opts.smoothingFactor
    this.ema = a * rawRms + (1 - a) * this.ema

    let peak = false
    if (this.cooldown > 0) this.cooldown--
    const overshoot = rawRms - this.ema
    if (
      this.cooldown === 0 &&
      this.ema > EnvelopeTracker.MIN_ENERGY &&
      overshoot > opts.peakThreshold * this.ema
    ) {
      peak = true
      this.cooldown = EnvelopeTracker.REFRACTORY_FRAMES
    }
    return { rms: this.ema, peak }
  }

  /** Reset to silence (e.g. when the mic stops). */
  reset(): void {
    this.ema = 0
    this.cooldown = 0
  }
}
