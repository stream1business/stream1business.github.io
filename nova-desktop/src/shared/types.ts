/**
 * Types shared between the Electron main process and the renderer.
 * Keep this file free of runtime imports from either side so it can be
 * consumed by both without pulling in Node or DOM globals.
 */

/**
 * The finite state machine that drives NOVA's visual behaviour.
 *
 * - `idle`       — mic inactive, slow ambient pulse only
 * - `listening`  — mic active, waiting for speech, ring dims slightly
 * - `speaking`   — user is talking; full reactive glow + pulse
 * - `thinking`   — NOVA is processing; uniform faster spin, steady pulse
 * - `responding` — NOVA is replying; glow flows around the ring
 */
export type AssistantState =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'thinking'
  | 'responding'

/** Real-time audio measurements sampled from the microphone. */
export interface AudioLevels {
  /** Root-mean-square volume, smoothed via EMA. Range 0–1. */
  rms: number
  /** Raw (unsmoothed) RMS volume for onset detection. Range 0–1. */
  rawRms: number
  /** Whether an amplitude peak (syllable onset) was detected this frame. */
  peak: boolean
  /** Normalised low/mid/high frequency band energies. Range 0–1 each. */
  bands: { low: number; mid: number; high: number }
}

/** Channels exposed by the preload bridge on `window.nova`. */
export interface NovaBridge {
  /** Ask the main process to quit the app. */
  quit: () => void
  /** Toggle the always-on-top flag. */
  setAlwaysOnTop: (value: boolean) => void
  /** Toggle whether the transparent regions ignore mouse events. */
  setClickThrough: (value: boolean) => void
  /** Subscribe to state-change requests coming from the tray menu. */
  onSetState: (cb: (state: AssistantState) => void) => () => void
  /** Report the current platform (win32 / darwin / linux). */
  platform: string
}

declare global {
  interface Window {
    nova: NovaBridge
  }
}
