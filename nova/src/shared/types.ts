/**
 * Types shared between the Electron main process and the renderer.
 * Keep this file dependency-free so it can be imported from either side.
 */

/**
 * The NOVA assistant state machine.
 *
 * - `idle`       — mic inactive, slow ambient pulse only
 * - `listening`  — mic active, waiting for speech, ring dims slightly
 * - `speaking`   — user is speaking; full reactive glow + pulse
 * - `thinking`   — NOVA is processing; rotation speeds up, steady pulse
 * - `responding` — NOVA is replying; glow flows around the ring
 */
export type AssistantState =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'thinking'
  | 'responding'

/** Real-time audio measurements derived from the microphone. */
export interface AudioLevels {
  /** Raw RMS volume for this frame, 0..1. */
  volume: number
  /** Exponentially-smoothed volume, 0..1 — use this for visuals. */
  smoothedVolume: number
  /** True on the frame an amplitude onset (syllable-like peak) is detected. */
  peak: boolean
  /** Normalized low/mid/high band energy, each 0..1. */
  bands: { low: number; mid: number; high: number }
}

export const emptyAudioLevels: AudioLevels = {
  volume: 0,
  smoothedVolume: 0,
  peak: false,
  bands: { low: 0, mid: 0, high: 0 }
}

/** IPC channel names, shared so main and renderer never disagree on strings. */
export const IpcChannels = {
  SetIgnoreMouseEvents: 'window:set-ignore-mouse-events',
  ToggleClickThrough: 'window:toggle-click-through',
  Quit: 'app:quit',
  OpenSettings: 'ui:open-settings',
  StateChanged: 'assistant:state-changed'
} as const

/** Shape of the API exposed to the renderer via the preload bridge. */
export interface NovaBridge {
  /** Let clicks pass through to the desktop when the cursor is off the orb. */
  setIgnoreMouseEvents: (ignore: boolean) => void
  /** Quit the whole app. */
  quit: () => void
  /** Subscribe to "open settings" requests from the tray/menu. */
  onOpenSettings: (cb: () => void) => () => void
}
