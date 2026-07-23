# Resources

Drop packaging assets here.

- `trayTemplate.png` — the system-tray icon (macOS: a black template image,
  ~16×16 or 22×22 `@2x`). The app loads this at runtime; if it's missing, NOVA
  simply starts without a tray entry (the right-click menu and the small
  bottom-right hotspot still open settings).
- `icon.png` / `icon.icns` / `icon.ico` — app icons picked up by
  `electron-builder` when packaging.
