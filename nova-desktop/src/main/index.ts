import { app, BrowserWindow, Tray } from 'electron'
import { createOrbWindow } from './window'
import { createTray } from './tray'
import { registerIpc } from './ipc'
import { registerHotkeys } from './hotkeys'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let unregisterHotkeys: (() => void) | null = null

const getWindow = (): BrowserWindow | null => mainWindow

// Single-instance lock: focus the existing orb instead of spawning a second.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Hide the dock icon on macOS — NOVA lives in the tray + floating orb.
    if (process.platform === 'darwin') app.dock?.hide()

    registerIpc(getWindow)
    mainWindow = createOrbWindow()
    tray = createTray(getWindow)
    unregisterHotkeys = registerHotkeys(getWindow)

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createOrbWindow()
      }
    })
  })

  // Keep running in the tray even when the window is closed.
  app.on('window-all-closed', () => {
    // No-op: NOVA is a tray-resident app. Quit only via the tray menu.
  })

  app.on('before-quit', () => {
    unregisterHotkeys?.()
    tray?.destroy()
  })
}
