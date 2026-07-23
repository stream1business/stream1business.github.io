import { create } from 'zustand'
import type { AssistantState, AudioLevels } from '@shared/types'
import { personalityConfig, type PersonalityConfig } from '@renderer/config/personality.config'
import { getTheme, type NovaTheme } from '@renderer/config/theme.config'

/**
 * Central app store. Rendering components subscribe to slices of this rather
 * than talking to the audio/animation layers directly, so new features
 * (hotkeys, wake-word, tray actions) can push state in without any component
 * changes.
 */
export interface NovaStore {
  /** Current animation state-machine state. */
  assistantState: AssistantState
  /** Latest real-time audio measurements. */
  audioLevels: AudioLevels
  /** Whether the mic stream is currently active. */
  micActive: boolean
  /** Active theme, resolved from settings. */
  theme: NovaTheme
  /** Live, user-tunable settings (seeded from the personality config). */
  settings: PersonalityConfig

  setAssistantState: (state: AssistantState) => void
  setAudioLevels: (levels: AudioLevels) => void
  setMicActive: (active: boolean) => void
  setTheme: (themeId: string) => void
  updateSettings: (patch: Partial<PersonalityConfig>) => void
}

const idleAudio: AudioLevels = {
  volume: 0,
  rawVolume: 0,
  peak: false,
  bands: { low: 0, mid: 0, high: 0 }
}

export const useNovaStore = create<NovaStore>((set) => ({
  assistantState: 'idle',
  audioLevels: idleAudio,
  micActive: false,
  theme: getTheme(personalityConfig.colorTheme),
  settings: personalityConfig,

  setAssistantState: (assistantState) => {
    set({ assistantState })
    // Mirror state up to the main process for the tray, if the bridge exists.
    window.nova?.reportState(assistantState)
  },
  setAudioLevels: (audioLevels) => set({ audioLevels }),
  setMicActive: (micActive) => set({ micActive }),
  setTheme: (themeId) =>
    set((s) => ({
      theme: getTheme(themeId),
      settings: { ...s.settings, colorTheme: themeId }
    })),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } }))
}))

/** Non-hook accessor for use outside React (e.g. RAF loops). */
export const novaState = useNovaStore.getState
