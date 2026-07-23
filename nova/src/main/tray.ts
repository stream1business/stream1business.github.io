import { join } from 'path'
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'

/**
 * System tray with a minimal menu. Kept in its own module so the window code
 * stays focused. New tray actions (hotkeys, wake-word toggle) can be added here
 * and forwarded to the renderer over IPC without touching the window setup.
 */
let tray: Tray | null = null

export function createTray(win: BrowserWindow): Tray {
  // A 1x1 transparent image is a safe fallback if no icon asset is bundled.
  const iconPath = join(__dirname, '../../resources/trayTemplate.png')
  let image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    image = nativeImage.createEmpty()
  }

  tray = new Tray(image)
  tray.setToolTip('NOVA')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Settings…',
      click: () => win.webContents.send('nova:toggle-settings')
    },
    {
      label: 'Always on top',
      type: 'checkbox',
      checked: true,
      click: (item) => win.setAlwaysOnTop(item.checked, 'screen-saver')
    },
    { type: 'separator' },
    { label: 'Quit NOVA', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => win.webContents.send('nova:toggle-settings'))
  return tray
}
