/**
 * Theming system for NOVA.
 *
 * Colors and typography are pulled from theme objects rather than hardcoded in
 * components, so new "skins" can be added by dropping another entry into
 * `themes`. Each theme is a plain object and could equally be loaded from JSON.
 */
export interface NovaTheme {
  key: string
  label: string
  /** Fully-transparent in-app; kept for mockups / opaque preview mode. */
  background: string
  ring: {
    /** Cool edge of the ring gradient. */
    cool: string
    /** Warm edge of the ring gradient. */
    warm: string
    /** Deep braid-shadow color. */
    shadow: string
  }
  text: {
    /** Gradient stops for the letterform fill. */
    gradient: [string, string]
    /** Angle of the text fill gradient, in degrees. */
    gradientAngle: number
    /** Hot core of the outer glow. */
    glowCore: string
    /** Outer edge color the glow fades toward. */
    glowEdge: string
  }
  /** Particle color; opacity is varied at render time. */
  particle: string
}

export const themes: Record<string, NovaTheme> = {
  novaDefault: {
    key: 'novaDefault',
    label: 'Nova Default',
    background: '#000000',
    ring: {
      cool: '#2DE1C2',
      warm: '#8A4FFF',
      shadow: '#120826'
    },
    text: {
      gradient: ['#2DE1C2', '#8A4FFF'],
      gradientAngle: 135,
      glowCore: '#FFFFFF',
      glowEdge: '#B58CFF'
    },
    particle: '#FFFFFF'
  },

  // Example alternate skin to demonstrate the theming system is data-driven.
  ember: {
    key: 'ember',
    label: 'Ember',
    background: '#000000',
    ring: {
      cool: '#FFB86B',
      warm: '#FF4D6D',
      shadow: '#2A0713'
    },
    text: {
      gradient: ['#FFD27D', '#FF4D6D'],
      gradientAngle: 135,
      glowCore: '#FFFFFF',
      glowEdge: '#FFB0A0'
    },
    particle: '#FFF2E0'
  }
}

export function getTheme(key: string): NovaTheme {
  return themes[key] ?? themes.novaDefault
}
