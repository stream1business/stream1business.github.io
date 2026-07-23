import { create } from 'zustand'
import type { AppSettings, AssistantState, AudioLevels } from '@shared/types'
import { personalityConfig } from '../config/personality.config'
import { DEFAULT_THEME_ID, getTheme, type NovaTheme } from '../config/themes'

/**
 * Central app store. Components subscribe to slices of this rather than passing
 * props around, so new features (hotkeys, wake-word, tray actions) can push
 * state in without the rendering components knowing about them.
 */
interface NovaStore {
  assistantState: AssistantState
  audioLevels: AudioLevels
  settings: AppSettings
  theme: NovaTheme
  micActive: boolean

  setAssistantState: (state: AssistantState) => void
  setAudioLevels: (levels: AudioLevels) => void
  setMicActive: (active: boolean) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  setTheme: (themeId: string) => void
}

const initialAudio: AudioLevels = {
  volume: 0,
  rawVolume: 0,
  onset: false,
  brightness: 0
}

const initialSettings: AppSettings = {
  orbSize: 560,
  alwaysOnTop: true,
  autoStartMic: false,
  themeId: personalityConfig.colorTheme || DEFAULT_THEME_ID
}

export const useNovaStore = create<NovaStore>((set) => ({
  assistantState: 'idle',
  audioLevels: initialAudio,
  settings: initialSettings,
  theme: getTheme(initialSettings.themeId),
  micActive: false,

  setAssistantState: (assistantState) => set({ assistantState }),
  setAudioLevels: (audioLevels) => set({ audioLevels }),
  setMicActive: (micActive) => set({ micActive }),
  updateSettings: (patch) =>
    set((s) => {
      const settings = { ...s.settings, ...patch }
      return { settings, theme: getTheme(settings.themeId) }
    }),
  setTheme: (themeId) =>
    set((s) => ({
      settings: { ...s.settings, themeId },
      theme: getTheme(themeId)
    }))
}))
