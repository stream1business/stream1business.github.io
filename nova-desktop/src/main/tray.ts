import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import type { AssistantState } from '../shared/types'
import { sendSetState } from './ipc'
// electron-vite copies this asset into the build and rewrites the path so it
// resolves in both `dev` and packaged builds. Use the flat variant — the tray
// renders at ~16-18px where the detailed braided art turns to mush.
import trayIconPath from '../../resources/icon-small.png?asset'

/**
 * Builds a minimal system-tray menu. Because the window is frameless and
 * transparent, the tray is the primary "chrome" for quitting, toggling
 * always-on-top / click-through, and manually driving the state machine
 * (handy for demoing `thinking` / `responding` without a backend).
 */
export function createTray(getWindow: () => BrowserWindow | null): Tray {
  // The full-resolution app icon, downscaled to a crisp tray glyph.
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 })
  const tray = new Tray(icon)
  tray.setToolTip('NOVA')

  let alwaysOnTop = true
  let clickThrough = true

  const rebuild = (): void => {
    const setState = (state: AssistantState): void => sendSetState(getWindow(), state)

    const menu = Menu.buildFromTemplate([
      { label: 'NOVA', enabled: false },
      { type: 'separator' },
      {
        label: 'State',
        submenu: [
          { label: 'Idle', click: () => setState('idle') },
          { label: 'Listening', click: () => setState('listening') },
          { label: 'Speaking', click: () => setState('speaking') },
          { label: 'Thinking', click: () => setState('thinking') },
          { label: 'Responding', click: () => setState('responding') }
        ]
      },
      { type: 'separator' },
      {
        label: 'Always on top',
        type: 'checkbox',
        checked: alwaysOnTop,
        click: () => {
          alwaysOnTop = !alwaysOnTop
          getWindow()?.setAlwaysOnTop(alwaysOnTop, 'screen-saver')
          rebuild()
        }
      },
      {
        label: 'Click-through (ignore mouse outside ring)',
        type: 'checkbox',
        checked: clickThrough,
        click: () => {
          clickThrough = !clickThrough
          getWindow()?.setIgnoreMouseEvents(clickThrough, { forward: true })
          rebuild()
        }
      },
      {
        label: 'Center on screen',
        click: () => getWindow()?.center()
      },
      { type: 'separator' },
      { label: 'Quit NOVA', click: () => app.quit() }
    ])

    tray.setContextMenu(menu)
  }

  rebuild()
  return tray
}
