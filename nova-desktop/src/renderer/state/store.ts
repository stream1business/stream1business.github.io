import { create } from 'zustand'
import type { AssistantState, AudioLevels } from '@shared/types'
import { personalityConfig, type PersonalityConfig } from '@renderer/config/personality.config'
import { getTheme, type NovaTheme } from '@renderer/config/themes'

/**
 * Central application store.
 *
 * Rendering components subscribe to slices of this state; new features
 * (hotkeys, wake-word detection, tray actions, a real LLM backend) can read
 * and mutate the same store without reaching into the components.
 */
export interface Settings {
  /** Orb diameter in CSS pixels. */
  orbSize: number
  /** Whether the window stays above all others. */
  alwaysOnTop: boolean
  /** Whether transparent regions pass clicks to the desktop below. */
  clickThrough: boolean
  /** Active theme key. */
  themeKey: string
  /** Whether the mic should be captured on launch. */
  micEnabled: boolean
}

export interface NovaStore {
  /** Current state-machine node. */
  assistantState: AssistantState
  /** Latest audio measurements. */
  audioLevels: AudioLevels
  /** Personality tuning (defaults, overridable at runtime). */
  personality: PersonalityConfig
  /** Resolved active theme object. */
  theme: NovaTheme
  /** User-facing settings. */
  settings: Settings
  /** Whether the settings panel is open. */
  settingsOpen: boolean

  // --- actions ---
  setAssistantState: (state: AssistantState) => void
  setAudioLevels: (levels: AudioLevels) => void
  setThemeKey: (key: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  updatePersonality: (patch: Partial<PersonalityConfig>) => void
  setSettingsOpen: (open: boolean) => void
}

const initialAudio: AudioLevels = {
  rms: 0,
  rawRms: 0,
  peak: false,
  bands: { low: 0, mid: 0, high: 0 }
}

export const useNovaStore = create<NovaStore>((set) => ({
  assistantState: 'idle',
  audioLevels: initialAudio,
  personality: personalityConfig,
  theme: getTheme(personalityConfig.colorTheme),
  settings: {
    orbSize: 560,
    alwaysOnTop: true,
    clickThrough: true,
    themeKey: personalityConfig.colorTheme,
    micEnabled: false
  },
  settingsOpen: false,

  setAssistantState: (assistantState) => set({ assistantState }),
  setAudioLevels: (audioLevels) => set({ audioLevels }),
  setThemeKey: (key) =>
    set((s) => ({
      theme: getTheme(key),
      settings: { ...s.settings, themeKey: key }
    })),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  updatePersonality: (patch) =>
    set((s) => ({ personality: { ...s.personality, ...patch } })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen })
}))
