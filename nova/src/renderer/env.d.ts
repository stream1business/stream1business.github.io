/// <reference types="vite/client" />

import type { NovaBridge } from '@shared/types'

declare global {
  interface Window {
    /** API exposed by the Electron preload bridge (see src/main/preload.ts). */
    nova?: NovaBridge
  }
}

// Allow the non-standard Electron drag-region CSS property in inline styles.
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

export {}
