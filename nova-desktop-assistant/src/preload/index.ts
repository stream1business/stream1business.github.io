import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type AssistantState, type NovaBridge } from '../shared/types'

/**
 * The one and only bridge between renderer and main. Everything the UI can ask
 * the OS to do goes through here, behind context isolation.
 */
const bridge: NovaBridge = {
  quit: () => ipcRenderer.send(IpcChannel.Quit),
  setIgnoreMouseEvents: (ignore, options) =>
    ipcRenderer.send(IpcChannel.SetIgnoreMouseEvents, ignore, options),
  openSettings: () => ipcRenderer.send(IpcChannel.OpenSettings),
  reportState: (state: AssistantState) => ipcRenderer.send(IpcChannel.StateChanged, state),
  onOpenSettings: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(IpcChannel.OpenSettings, listener)
    return () => ipcRenderer.removeListener(IpcChannel.OpenSettings, listener)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('nova', bridge)
