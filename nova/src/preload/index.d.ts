import type { NovaApi } from './index'

declare global {
  interface Window {
    /** Bridge exposed by the preload script (see src/preload/index.ts). */
    nova?: NovaApi
  }
}

export {}
