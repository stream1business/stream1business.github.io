import { app } from 'electron'
import electronUpdater from 'electron-updater'

/**
 * Wire up auto-updates.
 *
 * Deliberately defensive: it does nothing in development (there's no
 * `app-update.yml` in an unpackaged app), downloads updates quietly in the
 * background, and swallows any error — a missing or unreachable update feed
 * must never crash or interrupt the assistant. Updates install on next quit.
 */
export function initAutoUpdater(): void {
  if (!app.isPackaged) return

  const { autoUpdater } = electronUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('error', (err) => {
    console.warn('[NOVA] update check failed:', err instanceof Error ? err.message : err)
  })

  try {
    void autoUpdater.checkForUpdatesAndNotify()
  } catch (err) {
    console.warn('[NOVA] updater unavailable:', err)
  }
}
