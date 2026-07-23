import { create } from 'zustand'
import type { AssistantState, AudioLevels } from '@shared/types'
import { emptyAudioLevels } from '@shared/types'
import {
  personalityConfig,
  type PersonalityConfig
} from '@renderer/config/personality.config'
import { getTheme, type NovaTheme } from '@renderer/config/theme.config'

/**
 * User-adjustable runtime settings. These start from the personality config but
 * can be overridden live from the SettingsPanel without editing config files.
 */
export interface Settings {
  micEnabled: boolean
  /** Orb diameter in px. */
  orbSize: number
  /** Global glow master, 0..1. */
  glowMaster: number
  /** When true, the window ignores clicks outside the orb. */
  clickThrough: boolean
  themeKey: string
}

export interface NovaStore {
  assistantState: AssistantState
  audioLevels: AudioLevels
  personality: PersonalityConfig
  theme: NovaTheme
  settings: Settings

  // --- actions -----------------------------------------------------------
  setAssistantState: (s: AssistantState) => void
  setAudioLevels: (levels: AudioLevels) => void
  updateSettings: (patch: Partial<Settings>) => void
  setTheme: (key: string) => void
}

export const useNovaStore = create<NovaStore>((set) => ({
  assistantState: 'idle',
  audioLevels: emptyAudioLevels,
  personality: personalityConfig,
  theme: getTheme(personalityConfig.colorTheme),
  settings: {
    micEnabled: false,
    orbSize: 560,
    glowMaster: 1,
    clickThrough: true,
    themeKey: personalityConfig.colorTheme
  },

  setAssistantState: (assistantState) => set({ assistantState }),
  setAudioLevels: (audioLevels) => set({ audioLevels }),
  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),
  setTheme: (key) =>
    set((state) => ({
      theme: getTheme(key),
      settings: { ...state.settings, themeKey: key }
    }))
}))

/**
 * Non-reactive snapshot accessor for hot animation loops (requestAnimationFrame)
 * that must not trigger React re-renders on every frame.
 */
export const novaSnapshot = () => useNovaStore.getState()
