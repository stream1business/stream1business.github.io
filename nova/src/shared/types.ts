/**
 * Types shared between the Electron main process and the renderer.
 * Keep this file free of runtime imports so it can be consumed from both sides.
 */

/** The finite states NOVA can occupy. Drives every animation variant. */
export type AssistantState =
  | 'idle' // mic inactive, slow ambient pulse only
  | 'listening' // mic active, waiting for speech
  | 'speaking' // user is speaking — full reactive glow + pulse
  | 'thinking' // NOVA is processing a response
  | 'responding' // NOVA is playing back / streaming its own response

/** Real-time audio measurements produced by the analysis layer. */
export interface AudioLevels {
  /** Smoothed RMS volume, 0..1. */
  volume: number
  /** Raw (unsmoothed) RMS volume, 0..1 — useful for onset detection. */
  rawVolume: number
  /** True on the frame a syllable-like amplitude onset is detected. */
  onset: boolean
  /** Rough spectral centroid, 0..1 — brightness of the current sound. */
  brightness: number
}

/** Window / behavior settings the user can tune at runtime. */
export interface AppSettings {
  /** Orb diameter in px. */
  orbSize: number
  /** Keep the window above all others. */
  alwaysOnTop: boolean
  /** Start capturing the microphone automatically on launch. */
  autoStartMic: boolean
  /** Active theme id (see themes.ts). */
  themeId: string
}

/** IPC channel names, centralized so main + renderer can't drift apart. */
export const IPC = {
  QUIT: 'nova:quit',
  MINIMIZE: 'nova:minimize',
  TOGGLE_ALWAYS_ON_TOP: 'nova:toggle-always-on-top',
  SET_IGNORE_MOUSE_EVENTS: 'nova:set-ignore-mouse-events',
  SET_ORB_SIZE: 'nova:set-orb-size',
  STATE_FROM_TRAY: 'nova:state-from-tray'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
