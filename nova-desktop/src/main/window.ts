import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Creates the frameless, transparent, always-on-top orb window.
 *
 * The window is sized a little larger than the orb so the glow has room to
 * bleed. It ignores mouse events by default (`setIgnoreMouseEvents(true, …)`)
 * so clicks pass through the transparent corners to the desktop below; the
 * renderer re-enables hit-testing only while the pointer is over the ring.
 */
export function createOrbWindow(): BrowserWindow {
  const primary = screen.getPrimaryDisplay()
  const { width, height } = primary.workAreaSize

  const winSize = 720 // generous canvas for orb + glow bleed

  const window = new BrowserWindow({
    width: winSize,
    height: winSize,
    x: Math.round(width - winSize - 24),
    y: Math.round(height - winSize - 24),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.setAlwaysOnTop(true, 'screen-saver')
  // Show across all workspaces / spaces where supported.
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Start click-through; the renderer toggles this via IPC when hovering the ring.
  window.setIgnoreMouseEvents(true, { forward: true })

  window.on('ready-to-show', () => window.show())

  // Open external links in the user's browser, never in-app.
  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer: dev server in development, built files in production.
  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
