import { describe, it, expect } from 'vitest'
import { rotationSpeedDegPerSec } from './rotation'
import { personalityConfig } from '@renderer/config/personality.config'

const cfg = personalityConfig
const base = 360 / cfg.baseRotationSpeed // degrees per second at idle

describe('rotationSpeedDegPerSec', () => {
  it('spins at the base rate when idle', () => {
    expect(rotationSpeedDegPerSec('idle', cfg, 0)).toBeCloseTo(base, 5)
  })

  it('thinking spins fastest (uniform, mic-independent)', () => {
    const thinking = rotationSpeedDegPerSec('thinking', cfg, 0)
    expect(thinking).toBeCloseTo(base * cfg.thinkingRotationMultiplier, 5)
    expect(thinking).toBeGreaterThan(rotationSpeedDegPerSec('speaking', cfg, 1))
    expect(thinking).toBeGreaterThan(rotationSpeedDegPerSec('responding', cfg, 0))
  })

  it('speaking speed increases with loudness', () => {
    const quiet = rotationSpeedDegPerSec('speaking', cfg, 0)
    const loud = rotationSpeedDegPerSec('speaking', cfg, 0.5)
    expect(loud).toBeGreaterThan(quiet)
  })

  it('speaking speed is capped by the active multiplier', () => {
    // rms is clamped via min(1, rms*2), so beyond rms=0.5 it should not grow.
    const atHalf = rotationSpeedDegPerSec('speaking', cfg, 0.5)
    const atMax = rotationSpeedDegPerSec('speaking', cfg, 5)
    expect(atMax).toBeCloseTo(atHalf, 5)
    expect(atMax).toBeCloseTo(base * cfg.activeRotationMultiplier, 5)
  })

  it('listening drifts just above idle', () => {
    const listening = rotationSpeedDegPerSec('listening', cfg, 0)
    expect(listening).toBeGreaterThan(base)
    expect(listening).toBeLessThan(base * cfg.activeRotationMultiplier)
  })
})
