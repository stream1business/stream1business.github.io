import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

/**
 * The preload bridge — the *only* surface the renderer has into Electron.
 * Everything is funneled through named IPC channels defined in shared/types so
 * the two processes can't drift apart. contextIsolation stays on.
 */
const api = {
  quit: (): void => ipcRenderer.send(IPC.QUIT),
  minimize: (): void => ipcRenderer.send(IPC.MINIMIZE),
  toggleAlwaysOnTop: (on: boolean): void => ipcRenderer.send(IPC.TOGGLE_ALWAYS_ON_TOP, on),
  setIgnoreMouseEvents: (ignore: boolean): void =>
    ipcRenderer.send(IPC.SET_IGNORE_MOUSE_EVENTS, ignore),
  setOrbSize: (size: number): void => ipcRenderer.send(IPC.SET_ORB_SIZE, size),

  /** Tray → renderer: open/close the settings panel. Returns an unsubscribe fn. */
  onToggleSettings: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('nova:toggle-settings', listener)
    return () => ipcRenderer.removeListener('nova:toggle-settings', listener)
  }
}

contextBridge.exposeInMainWorld('nova', api)

export type NovaApi = typeof api
