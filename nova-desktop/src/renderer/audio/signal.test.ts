import { describe, it, expect } from 'vitest'
import { EnvelopeTracker, computeBands, rmsFromTimeDomain } from './signal'

describe('rmsFromTimeDomain', () => {
  it('is 0 for an empty buffer', () => {
    expect(rmsFromTimeDomain(new Uint8Array(0))).toBe(0)
  })

  it('is 0 for pure silence (all samples at the 128 midpoint)', () => {
    const silence = new Uint8Array(1024).fill(128)
    expect(rmsFromTimeDomain(silence)).toBe(0)
  })

  it('clamps a full-swing square wave to 1', () => {
    // Alternating extremes → |centred| = 1 everywhere → rms 1 → *3 clamps to 1.
    const buf = new Uint8Array(1024)
    for (let i = 0; i < buf.length; i++) buf[i] = i % 2 === 0 ? 0 : 255
    expect(rmsFromTimeDomain(buf)).toBe(1)
  })

  it('grows monotonically with amplitude', () => {
    const at = (amp: number): number => {
      const buf = new Uint8Array(512)
      for (let i = 0; i < buf.length; i++) buf[i] = 128 + Math.round(Math.sin(i) * amp)
      return rmsFromTimeDomain(buf)
    }
    expect(at(10)).toBeLessThan(at(30))
    expect(at(30)).toBeLessThan(at(60))
  })
})

describe('computeBands', () => {
  it('returns zeros for an empty buffer', () => {
    expect(computeBands(new Uint8Array(0))).toEqual({ low: 0, mid: 0, high: 0 })
  })

  it('normalises a full-energy spectrum to 1 across every band', () => {
    const full = new Uint8Array(1000).fill(255)
    const bands = computeBands(full)
    expect(bands.low).toBeCloseTo(1, 5)
    expect(bands.mid).toBeCloseTo(1, 5)
    expect(bands.high).toBeCloseTo(1, 5)
  })

  it('isolates energy to the band it lives in', () => {
    // Put energy only in the lowest 10% of bins → low lit, mid/high dark.
    const buf = new Uint8Array(1000)
    for (let i = 0; i < 100; i++) buf[i] = 255
    const bands = computeBands(buf)
    expect(bands.low).toBeGreaterThan(0.9)
    expect(bands.mid).toBe(0)
    expect(bands.high).toBe(0)
  })
})

describe('EnvelopeTracker', () => {
  const opts = { smoothingFactor: 0.15, peakThreshold: 0.35 }

  it('smooths toward a sustained input rather than jumping', () => {
    const t = new EnvelopeTracker()
    const first = t.update(1, opts).rms
    expect(first).toBeCloseTo(0.15, 5) // one EMA step from 0
    // Converges toward the input over many frames.
    let rms = first
    for (let i = 0; i < 100; i++) rms = t.update(1, opts).rms
    expect(rms).toBeGreaterThan(0.99)
  })

  it('fires a peak on a sudden onset above the noise floor', () => {
    const t = new EnvelopeTracker()
    // Establish a modest envelope first.
    for (let i = 0; i < 20; i++) t.update(0.3, opts)
    const onset = t.update(0.9, opts) // big overshoot
    expect(onset.peak).toBe(true)
  })

  it('respects the refractory period after a peak', () => {
    const t = new EnvelopeTracker()
    for (let i = 0; i < 20; i++) t.update(0.3, opts)
    expect(t.update(0.9, opts).peak).toBe(true)
    // Immediately following frames cannot re-fire, even if still loud.
    for (let i = 0; i < EnvelopeTracker.REFRACTORY_FRAMES; i++) {
      expect(t.update(0.9, opts).peak).toBe(false)
    }
  })

  it('never fires below the minimum-energy floor', () => {
    const t = new EnvelopeTracker()
    let anyPeak = false
    // Tiny signal that stays under MIN_ENERGY.
    for (let i = 0; i < 50; i++) anyPeak = anyPeak || t.update(0.02, opts).peak
    expect(anyPeak).toBe(false)
  })

  it('reset() returns it to silence', () => {
    const t = new EnvelopeTracker()
    for (let i = 0; i < 30; i++) t.update(0.8, opts)
    t.reset()
    expect(t.update(0, opts).rms).toBe(0)
  })
})
