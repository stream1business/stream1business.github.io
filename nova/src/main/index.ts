import { join } from 'path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { IPC } from '../shared/types'
import { createTray } from './tray'

/**
 * Electron main process. Owns the frameless, transparent, always-on-top window,
 * the tray, and every IPC handler. Kept intentionally thin — all app logic
 * lives in the renderer; main only manages the window/OS surface.
 */
let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 640,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Transparent windows must not be backgrounded/throttled or the animation
      // stutters when unfocused.
      backgroundThrottling: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  // Start click-through; the renderer flips this off while the pointer is over
  // the orb (and forwards moves so it can detect re-entry).
  win.setIgnoreMouseEvents(true, { forward: true })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerIpc(win: BrowserWindow): void {
  ipcMain.on(IPC.QUIT, () => app.quit())
  ipcMain.on(IPC.MINIMIZE, () => win.minimize())
  ipcMain.on(IPC.TOGGLE_ALWAYS_ON_TOP, (_e, on: boolean) => {
    win.setAlwaysOnTop(on, 'screen-saver')
  })
  ipcMain.on(IPC.SET_IGNORE_MOUSE_EVENTS, (_e, ignore: boolean) => {
    win.setIgnoreMouseEvents(ignore, { forward: true })
  })
  ipcMain.on(IPC.SET_ORB_SIZE, (_e, _size: number) => {
    // The window is fixed at max orb size; the orb scales within it. Hook left
    // here for future dynamic window resizing.
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.stream1business.nova')

  app.on('browser-window-created', (_e, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createWindow()
  registerIpc(mainWindow)
  createTray(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      registerIpc(mainWindow)
    }
  })
})

// Keep running in the tray after all windows close (except on macOS default).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
