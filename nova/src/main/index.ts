import { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { IpcChannels } from '../shared/types'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = !app.isPackaged

function createWindow(): void {
  const primary = screen.getPrimaryDisplay()
  const { width, height } = primary.workAreaSize

  const winSize = 720 // generous square canvas for the orb + flares/particles

  mainWindow = new BrowserWindow({
    width: winSize,
    height: winSize,
    x: Math.round(width - winSize - 40),
    y: Math.round(height - winSize - 40),
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    fullscreenable: false,
    // On macOS this keeps the window truly borderless & background-transparent.
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // getUserMedia works in the renderer; no extra flags needed on modern Electron.
      sandbox: false
    }
  })

  // Float above normal windows without stealing focus aggressively.
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Load the renderer (dev server in dev, built file in prod).
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function createTray(): void {
  // A tray entry gives users a way to reach settings/quit for a chromeless app.
  // An empty image still yields a clickable slot; a real icon can be dropped in
  // at resources/trayTemplate.png later without code changes.
  try {
    tray = new Tray(join(__dirname, '../../resources/trayTemplate.png'))
  } catch {
    tray = new Tray(join(process.resourcesPath ?? '.', 'trayTemplate.png'))
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Settings',
      click: () => mainWindow?.webContents.send(IpcChannels.OpenSettings)
    },
    {
      label: 'Toggle Click-through',
      click: () =>
        mainWindow?.webContents.send(IpcChannels.ToggleClickThrough)
    },
    { type: 'separator' },
    { label: 'Quit NOVA', click: () => app.quit() }
  ])
  tray?.setToolTip('NOVA')
  tray?.setContextMenu(menu)
  tray?.on('click', () =>
    mainWindow?.webContents.send(IpcChannels.OpenSettings)
  )
}

function registerIpc(): void {
  ipcMain.on(
    IpcChannels.SetIgnoreMouseEvents,
    (_evt, ignore: boolean) => {
      // `forward: true` lets us keep receiving move events to detect re-entry.
      mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
    }
  )

  ipcMain.on(IpcChannels.Quit, () => app.quit())
}

app.whenReady().then(() => {
  createWindow()
  registerIpc()
  // Tray is best-effort; a missing icon shouldn't crash the app.
  try {
    createTray()
  } catch (err) {
    console.warn('[NOVA] Tray unavailable:', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Keep running in the tray when all windows are closed (except on macOS norm).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
