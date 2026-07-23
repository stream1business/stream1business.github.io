import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import { IpcChannel, type AssistantState } from '../shared/types'
import { createTray } from './tray'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const primary = screen.getPrimaryDisplay()
  const { width } = primary.workAreaSize
  const winSize = 640

  mainWindow = new BrowserWindow({
    width: winSize,
    height: winSize,
    // Float the orb near the top-right of the primary display by default.
    x: width - winSize - 40,
    y: 60,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    // The HUD should not steal focus from whatever the user is doing.
    focusable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Stay above full-screen apps too.
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Start fully click-through; the renderer flips this off while the cursor is
  // over the orb (forward:true keeps mouse-move events flowing so it can tell).
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  // Open external links in the user's browser, never in the frameless window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.on(IpcChannel.Quit, () => app.quit())

  ipcMain.on(IpcChannel.SetIgnoreMouseEvents, (_e, ignore: boolean, options?: { forward?: boolean }) => {
    mainWindow?.setIgnoreMouseEvents(ignore, options)
  })

  ipcMain.on(IpcChannel.StateChanged, (_e, _state: AssistantState) => {
    // Hook point: reflect assistant state in the tray icon/tooltip later.
  })
}

app.whenReady().then(() => {
  createWindow()
  registerIpc()
  if (mainWindow) createTray(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Keep running in the tray even with no windows on Windows/Linux; on macOS the
// tray keeps the app alive as usual.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Intentionally not quitting: the tray icon keeps NOVA available.
  }
})
