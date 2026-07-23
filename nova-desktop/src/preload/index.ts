import { contextBridge, ipcRenderer } from 'electron'
import type {
  AssistantMessage,
  AssistantReply,
  AssistantSendHandlers,
  AssistantState,
  NovaBridge,
  SecretName,
  SecretsStatus,
  TranscriptionResult
} from '../shared/types'

// Monotonic id so streamed deltas can be routed to the right in-flight request.
let requestCounterSeed = 0
const nextRequestId = (): string => `req-${Date.now()}-${++requestCounterSeed}`

/**
 * Secure preload bridge. Exposes a narrow, typed API on `window.nova` — the
 * renderer never touches `ipcRenderer` or Node directly (contextIsolation).
 */
const bridge: NovaBridge = {
  quit: () => ipcRenderer.send('nova:quit'),
  setAlwaysOnTop: (value: boolean) => ipcRenderer.send('nova:set-always-on-top', value),
  setClickThrough: (value: boolean) => ipcRenderer.send('nova:set-click-through', value),
  onSetState: (cb: (state: AssistantState) => void) => {
    const listener = (_e: unknown, state: AssistantState): void => cb(state)
    ipcRenderer.on('nova:set-state', listener)
    return () => ipcRenderer.removeListener('nova:set-state', listener)
  },
  assistant: {
    isConfigured: () => ipcRenderer.invoke('nova:assistant-configured') as Promise<boolean>,
    send: (messages: AssistantMessage[], handlers?: AssistantSendHandlers) => {
      const id = nextRequestId()
      const onDelta = (_e: unknown, payload: { id: string; text: string }): void => {
        if (payload.id === id) handlers?.onDelta?.(payload.text)
      }
      ipcRenderer.on('nova:assistant-delta', onDelta)
      return (ipcRenderer.invoke('nova:assistant-send', { id, messages }) as Promise<AssistantReply>)
        .finally(() => ipcRenderer.removeListener('nova:assistant-delta', onDelta))
    }
  },
  transcription: {
    isConfigured: () => ipcRenderer.invoke('nova:transcription-configured') as Promise<boolean>,
    transcribe: (audio: ArrayBuffer, mimeType: string) =>
      ipcRenderer.invoke('nova:transcribe', { audio, mimeType }) as Promise<TranscriptionResult>
  },
  secrets: {
    status: () => ipcRenderer.invoke('nova:secrets-status') as Promise<SecretsStatus>,
    set: (name: SecretName, value: string) =>
      ipcRenderer.invoke('nova:secrets-set', { name, value }) as Promise<SecretsStatus>
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('nova', bridge)
