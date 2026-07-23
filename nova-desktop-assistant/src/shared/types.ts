/**
 * Types shared between the Electron main process and the renderer.
 * Keep this file free of runtime imports from either side so it can be pulled
 * into both bundles cleanly.
 */

/** The five states of NOVA's animation state machine. */
export type AssistantState =
  | 'idle' // mic inactive, slow ambient pulse only
  | 'listening' // mic active, waiting for speech
  | 'speaking' // user is speaking, full reactive glow + pulse
  | 'thinking' // NOVA is processing, uniform faster rotation
  | 'responding' // NOVA is replying, glow flows around the ring

/** Real-time audio measurements fed to the animation layer. */
export interface AudioLevels {
  /** Smoothed RMS volume, normalised roughly to 0..1. */
  volume: number
  /** Raw (unsmoothed) RMS volume, 0..1 — useful for onset detection. */
  rawVolume: number
  /** True on the frame a syllable-like amplitude onset is detected. */
  peak: boolean
  /** Normalised low/mid/high band energy, 0..1 each. */
  bands: { low: number; mid: number; high: number }
}

/** Names of IPC channels, kept in one place to avoid stringly-typed drift. */
export const IpcChannel = {
  Quit: 'nova:quit',
  ToggleClickThrough: 'nova:toggle-click-through',
  SetIgnoreMouseEvents: 'nova:set-ignore-mouse-events',
  OpenSettings: 'nova:open-settings',
  StateChanged: 'nova:state-changed'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

/** Shape of the API the preload script exposes on `window.nova`. */
export interface NovaBridge {
  quit(): void
  /** Toggle whether the transparent window passes clicks through to the desktop. */
  setIgnoreMouseEvents(ignore: boolean, options?: { forward?: boolean }): void
  /** Ask the main process to open the native settings/tray menu. */
  openSettings(): void
  /** Report the current assistant state up to the main process (for tray UI). */
  reportState(state: AssistantState): void
  /** Subscribe to open-settings requests coming from the tray menu. */
  onOpenSettings(callback: () => void): () => void
  platform: NodeJS.Platform
}
