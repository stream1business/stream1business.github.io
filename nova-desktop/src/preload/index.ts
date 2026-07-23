import { contextBridge, ipcRenderer } from 'electron'
import type { AssistantState, NovaBridge } from '../shared/types'

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
  platform: process.platform
}

contextBridge.exposeInMainWorld('nova', bridge)
