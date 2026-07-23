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

/** One turn of conversation sent to the assistant backend. */
export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

/** A completed assistant reply. */
export interface AssistantReply {
  text: string
}

/** Handlers for a streaming assistant request. */
export interface AssistantSendHandlers {
  /** Called with each incremental text chunk as it streams in. */
  onDelta?: (chunk: string) => void
}

/**
 * The assistant channel on the bridge. The real LLM call runs in the main
 * process (Node) — the renderer never holds the API key or touches the SDK.
 */
export interface AssistantBridge {
  /** Whether a backend is configured (i.e. ANTHROPIC_API_KEY is set). */
  isConfigured: () => Promise<boolean>
  /** Send a conversation and stream back the reply. */
  send: (
    messages: AssistantMessage[],
    handlers?: AssistantSendHandlers
  ) => Promise<AssistantReply>
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
  /** The LLM backend, proxied to the main process. */
  assistant: AssistantBridge
  /** Report the current platform (win32 / darwin / linux). */
  platform: string
}

declare global {
  interface Window {
    nova: NovaBridge
  }
}
