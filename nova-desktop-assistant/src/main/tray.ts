import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { IpcChannel } from '../shared/types'

let tray: Tray | null = null

/**
 * System-tray menu — the app's only persistent chrome. Kept intentionally
 * minimal: show/hide, open settings, toggle always-on-top, quit. New tray
 * actions (hotkeys, wake-word toggle) can be added here without touching the
 * renderer, since they route through IPC into the store.
 */
export function createTray(window: BrowserWindow): Tray {
  // A tiny transparent placeholder icon; replace with build/tray.png later.
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('NOVA')

  const rebuild = (): void => {
    const menu = Menu.buildFromTemplate([
      {
        label: window.isVisible() ? 'Hide NOVA' : 'Show NOVA',
        click: () => {
          if (window.isVisible()) window.hide()
          else window.show()
          rebuild()
        }
      },
      {
        label: 'Settings…',
        click: () => {
          window.show()
          window.webContents.send(IpcChannel.OpenSettings)
        }
      },
      {
        label: 'Always on top',
        type: 'checkbox',
        checked: window.isAlwaysOnTop(),
        click: (item) => window.setAlwaysOnTop(item.checked, 'screen-saver')
      },
      { type: 'separator' },
      { label: 'Quit NOVA', click: () => app.quit() }
    ])
    tray?.setContextMenu(menu)
  }

  rebuild()
  tray.on('click', () => {
    if (window.isVisible()) window.focus()
    else window.show()
    rebuild()
  })

  return tray
}
