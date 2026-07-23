import { describe, it, expect } from 'vitest'
import { getTheme, themes } from './themes'

describe('getTheme', () => {
  it('resolves a known theme key to that theme', () => {
    expect(getTheme('emberForge').key).toBe('emberForge')
  })

  it('falls back to novaDefault for an unknown key', () => {
    expect(getTheme('does-not-exist').key).toBe('novaDefault')
  })

  it('every theme defines the full colour + type contract', () => {
    for (const theme of Object.values(themes)) {
      for (const hex of [theme.coolEdge, theme.warmEdge, theme.deepShadow, theme.glowCore, theme.glowEdge, theme.particle]) {
        expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
      expect(theme.fontFamily).toContain('Orbitron')
      expect(theme.letterSpacing).toMatch(/em$/)
      expect(theme.textGradientAngle).toBeGreaterThanOrEqual(0)
    }
  })
})
