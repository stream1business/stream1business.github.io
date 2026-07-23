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

/** One turn in the (stubbed) conversation with NOVA. */
export interface Exchange {
  prompt: string
  reply: string
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
  /** The most recent prompt/reply exchange, if any. */
  lastExchange: Exchange | null

  // --- actions ---
  setAssistantState: (state: AssistantState) => void
  setAudioLevels: (levels: AudioLevels) => void
  setThemeKey: (key: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  updatePersonality: (patch: Partial<PersonalityConfig>) => void
  setSettingsOpen: (open: boolean) => void
  setLastExchange: (exchange: Exchange | null) => void
}

const initialAudio: AudioLevels = {
  rms: 0,
  rawRms: 0,
  peak: false,
  bands: { low: 0, mid: 0, high: 0 }
}

const defaultSettings: Settings = {
  orbSize: 560,
  alwaysOnTop: true,
  clickThrough: true,
  themeKey: personalityConfig.colorTheme,
  micEnabled: false
}

// --------------------------------------------------------------- persistence ---
const PERSIST_KEY = 'nova.state.v1'

interface Persisted {
  settings?: Partial<Settings>
  personality?: Partial<PersonalityConfig>
}

/** Load persisted, user-tunable state. Never persists volatile/runtime fields. */
function loadPersisted(): Persisted {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : {}
  } catch {
    return {}
  }
}

const persisted = loadPersisted()

// `micEnabled` is a runtime capability, not a preference — never restore it on.
const initialSettings: Settings = { ...defaultSettings, ...persisted.settings, micEnabled: false }
const initialPersonality: PersonalityConfig = { ...personalityConfig, ...persisted.personality }
// Keep themeKey and the personality's colorTheme in agreement.
initialPersonality.colorTheme = initialSettings.themeKey

export const useNovaStore = create<NovaStore>((set) => ({
  assistantState: 'idle',
  audioLevels: initialAudio,
  personality: initialPersonality,
  theme: getTheme(initialSettings.themeKey),
  settings: initialSettings,
  settingsOpen: false,
  lastExchange: null,

  setAssistantState: (assistantState) => set({ assistantState }),
  setAudioLevels: (audioLevels) => set({ audioLevels }),
  setThemeKey: (key) =>
    set((s) => ({
      theme: getTheme(key),
      settings: { ...s.settings, themeKey: key },
      personality: { ...s.personality, colorTheme: key }
    })),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  updatePersonality: (patch) =>
    set((s) => ({ personality: { ...s.personality, ...patch } })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setLastExchange: (lastExchange) => set({ lastExchange })
}))

/**
 * Persist only the user-tunable slices, and only when they actually change.
 * `settings` / `personality` keep object identity across high-frequency audio
 * updates, so this comparison avoids writing to localStorage every frame.
 */
if (typeof localStorage !== 'undefined') {
  let lastSettings = initialSettings
  let lastPersonality = initialPersonality
  useNovaStore.subscribe((s) => {
    if (s.settings === lastSettings && s.personality === lastPersonality) return
    lastSettings = s.settings
    lastPersonality = s.personality
    try {
      const toSave: Persisted = { settings: s.settings, personality: s.personality }
      localStorage.setItem(PERSIST_KEY, JSON.stringify(toSave))
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
  })
}
