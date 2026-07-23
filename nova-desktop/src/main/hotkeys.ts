import { BrowserWindow, globalShortcut } from 'electron'

/**
 * Registers global (system-wide) keyboard shortcuts.
 *
 * Because NOVA is a frameless, taskbar-less floating orb, a global hotkey is
 * the natural way to summon or dismiss it without hunting for the tray. New
 * shortcuts (push-to-talk, wake-word bypass) can be added here without
 * touching the window or renderer code.
 *
 * Returns an unregister function to call on quit.
 */
export function registerHotkeys(getWindow: () => BrowserWindow | null): () => void {
  // Toggle the orb's visibility from anywhere.
  const TOGGLE = 'CommandOrControl+Shift+Space'

  const ok = globalShortcut.register(TOGGLE, () => {
    const win = getWindow()
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  if (!ok) {
    // Another app already owns the combo — non-fatal; the tray still works.
    console.warn(`[NOVA] could not register global shortcut "${TOGGLE}"`)
  }

  return () => globalShortcut.unregisterAll()
}
