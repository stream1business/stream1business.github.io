import { BrowserWindow, ipcMain, app } from 'electron'
import type { AssistantState } from '../shared/types'

/**
 * Registers the IPC surface used by the preload bridge.
 * All channels are namespaced under `nova:` to avoid collisions.
 */
export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.on('nova:quit', () => {
    app.quit()
  })

  ipcMain.on('nova:set-always-on-top', (_e, value: boolean) => {
    const win = getWindow()
    if (win) win.setAlwaysOnTop(value, 'screen-saver')
  })

  // Toggle whether transparent regions pass clicks through to the desktop.
  ipcMain.on('nova:set-click-through', (_e, value: boolean) => {
    const win = getWindow()
    if (win) win.setIgnoreMouseEvents(value, { forward: true })
  })
}

/** Push a state change requested from the tray menu into the renderer. */
export function sendSetState(win: BrowserWindow | null, state: AssistantState): void {
  win?.webContents.send('nova:set-state', state)
}
