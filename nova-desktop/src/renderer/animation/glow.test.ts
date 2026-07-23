import { describe, it, expect } from 'vitest'
import { computeGlow, computeTargetScale } from './glow'
import { personalityConfig } from '@renderer/config/personality.config'
import type { AudioLevels } from '@shared/types'

const cfg = personalityConfig

const silent: AudioLevels = { rms: 0, rawRms: 0, peak: false, bands: { low: 0, mid: 0, high: 0 } }
const loud: AudioLevels = { rms: 0.6, rawRms: 0.6, peak: false, bands: { low: 0.5, mid: 0.5, high: 0.5 } }

describe('computeGlow', () => {
  it('keeps intensity and opacity within 0–1 across all states and time', () => {
    const states = ['idle', 'listening', 'speaking', 'thinking', 'responding'] as const
    for (const state of states) {
      for (let t = 0; t < 12; t += 0.25) {
        const g = computeGlow(loud, state, cfg, t)
        expect(g.intensity).toBeGreaterThanOrEqual(0)
        expect(g.intensity).toBeLessThanOrEqual(1)
        expect(g.opacity).toBeGreaterThanOrEqual(0)
        expect(g.opacity).toBeLessThanOrEqual(1)
        expect(g.blur).toBeGreaterThan(0)
      }
    }
  })

  it('idle glow oscillates (the slow breathing pulse)', () => {
    // Sample across a full idle pulse period; intensity should vary.
    const samples: number[] = []
    for (let t = 0; t <= cfg.idlePulseSpeed; t += cfg.idlePulseSpeed / 8) {
      samples.push(computeGlow(silent, 'idle', cfg, t).intensity)
    }
    const spread = Math.max(...samples) - Math.min(...samples)
    expect(spread).toBeGreaterThan(0.1)
  })

  it('speaking glow rises with loudness', () => {
    const quiet = computeGlow(silent, 'speaking', cfg, 1).intensity
    const shout = computeGlow(loud, 'speaking', cfg, 1).intensity
    expect(shout).toBeGreaterThan(quiet)
  })

  it('blur scales with intensity', () => {
    const g = computeGlow(loud, 'speaking', cfg, 1)
    // blur = 12 + intensity*48
    expect(g.blur).toBeCloseTo(12 + g.intensity * 48, 5)
  })
})

describe('computeTargetScale', () => {
  it('is exactly 1 while idle (no pulse)', () => {
    expect(computeTargetScale(loud, 'idle', cfg)).toBe(1)
  })

  it('swells above 1 with sustained volume when active', () => {
    expect(computeTargetScale(loud, 'speaking', cfg)).toBeGreaterThan(1)
  })

  it('kicks harder on a syllable peak than without one', () => {
    const noPeak = computeTargetScale({ ...loud, peak: false }, 'speaking', cfg)
    const withPeak = computeTargetScale({ ...loud, peak: true }, 'speaking', cfg)
    expect(withPeak).toBeGreaterThan(noPeak)
  })

  it('scales the kick with pulseSensitivity', () => {
    const low = computeTargetScale({ ...silent, peak: true }, 'speaking', { ...cfg, pulseSensitivity: 0.2 })
    const high = computeTargetScale({ ...silent, peak: true }, 'speaking', { ...cfg, pulseSensitivity: 0.9 })
    expect(high).toBeGreaterThan(low)
  })
})
