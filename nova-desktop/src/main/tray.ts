import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import type { AssistantState } from '../shared/types'
import { sendSetState } from './ipc'

/**
 * Builds a minimal system-tray menu. Because the window is frameless and
 * transparent, the tray is the primary "chrome" for quitting, toggling
 * always-on-top / click-through, and manually driving the state machine
 * (handy for demoing `thinking` / `responding` without a backend).
 */
export function createTray(getWindow: () => BrowserWindow | null): Tray {
  // A 1x1 transparent image keeps this dependency-free; replace with a real
  // icon in resources/ for production packaging.
  const icon = nativeImage.createEmpty()
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
