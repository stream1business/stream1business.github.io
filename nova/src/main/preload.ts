import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type NovaBridge } from '../shared/types'

/**
 * The preload bridge: the ONLY surface the renderer uses to talk to Electron.
 * Everything is funneled through typed, named channels so the contract stays in
 * `shared/types.ts` and both sides can't drift.
 */
const bridge: NovaBridge = {
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send(IpcChannels.SetIgnoreMouseEvents, ignore),

  quit: () => ipcRenderer.send(IpcChannels.Quit),

  onOpenSettings: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on(IpcChannels.OpenSettings, handler)
    ipcRenderer.on(IpcChannels.ToggleClickThrough, handler)
    return () => {
      ipcRenderer.removeListener(IpcChannels.OpenSettings, handler)
      ipcRenderer.removeListener(IpcChannels.ToggleClickThrough, handler)
    }
  }
}

contextBridge.exposeInMainWorld('nova', bridge)
