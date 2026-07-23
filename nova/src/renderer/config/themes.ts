/**
 * Swappable color themes ("skins") for NOVA.
 *
 * A theme is pure data — no component references it directly by name, they all
 * read the *active* theme from the store. To add a skin, append an entry here
 * (or load one from JSON) and expose its id in the settings panel.
 */
export interface NovaTheme {
  id: string
  label: string
  /** Fully transparent in-app; used as the mockup/background reference. */
  background: string
  /** Cool edge of the ring gradient. */
  ringCool: string
  /** Warm edge of the ring gradient. */
  ringWarm: string
  /** Deep braid shadow color. */
  ringShadow: string
  /** White-hot core of the text glow. */
  glowCore: string
  /** Outer falloff color of the text glow. */
  glowEdge: string
  /** Particle color (opacity is varied at render time). */
  particle: string
}

export const themes: Record<string, NovaTheme> = {
  novaDefault: {
    id: 'novaDefault',
    label: 'Nova Default',
    background: '#000000',
    ringCool: '#2DE1C2',
    ringWarm: '#8A4FFF',
    ringShadow: '#120826',
    glowCore: '#FFFFFF',
    glowEdge: '#B58CFF',
    particle: '#FFFFFF'
  },
  ember: {
    id: 'ember',
    label: 'Ember',
    background: '#000000',
    ringCool: '#FFB347',
    ringWarm: '#FF4E50',
    ringShadow: '#2A0A0A',
    glowCore: '#FFFFFF',
    glowEdge: '#FFB88C',
    particle: '#FFF3E0'
  },
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    background: '#000000',
    ringCool: '#6EE7B7',
    ringWarm: '#3B82F6',
    ringShadow: '#04122A',
    glowCore: '#FFFFFF',
    glowEdge: '#93C5FD',
    particle: '#ECFEFF'
  }
}

export const DEFAULT_THEME_ID = 'novaDefault'

export function getTheme(id: string): NovaTheme {
  return themes[id] ?? themes[DEFAULT_THEME_ID]
}
