import type { NovaBridge } from '../shared/types'

declare global {
  interface Window {
    nova: NovaBridge
  }
}

export {}
