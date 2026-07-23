import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

/**
 * Vitest runs the pure logic (audio DSP, animation math, config resolution) in
 * a plain Node environment — no Electron, no Web Audio, no DOM required. The
 * aliases mirror electron.vite.config.ts so tests import the same paths the app
 * does.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer'),
      '@shared': resolve('src/shared'),
      '@services': resolve('src/services')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false
  }
})
