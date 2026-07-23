import { app, ipcMain, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { SecretName, SecretsStatus } from '../shared/types'

/**
 * Secure API-key storage for the packaged app.
 *
 * A double-clicked app can't see shell environment variables, so keys entered
 * in Settings are persisted here — encrypted with the OS keychain via Electron
 * `safeStorage` when available. The renderer can set a key and query status,
 * but the plaintext key is **never** sent back to the renderer; only the main
 * process reads it, to build the API clients.
 *
 * Resolution order for an effective key: a stored key wins, else an environment
 * variable (so `ANTHROPIC_API_KEY=… npm run dev` still works).
 */

interface StoredEntry {
  /** Whether `data` is `safeStorage`-encrypted (vs. base64 plaintext fallback). */
  enc: boolean
  data: string
}
type Store = Partial<Record<SecretName, StoredEntry>>

const ENV_FALLBACKS: Record<SecretName, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  stt: ['NOVA_STT_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY']
}

let cache: Store | null = null

const storePath = (): string => join(app.getPath('userData'), 'nova-secrets.json')

function load(): Store {
  if (cache) return cache
  try {
    cache = existsSync(storePath()) ? (JSON.parse(readFileSync(storePath(), 'utf8')) as Store) : {}
  } catch {
    cache = {}
  }
  return cache
}

function persist(store: Store): void {
  cache = store
  try {
    writeFileSync(storePath(), JSON.stringify(store), { mode: 0o600 })
  } catch (err) {
    console.warn('[NOVA] could not save secrets:', err)
  }
}

function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/** Decrypt a stored key, or '' if none / undecryptable. */
function storedValue(name: SecretName): string {
  const entry = load()[name]
  if (!entry) return ''
  try {
    return entry.enc
      ? safeStorage.decryptString(Buffer.from(entry.data, 'base64'))
      : Buffer.from(entry.data, 'base64').toString('utf8')
  } catch {
    return ''
  }
}

/** The key the API clients should use: stored first, then env fallbacks. */
export function getEffectiveKey(name: SecretName): string {
  const stored = storedValue(name)
  if (stored) return stored
  for (const envVar of ENV_FALLBACKS[name]) {
    const value = process.env[envVar]
    if (value) return value
  }
  return ''
}

function setSecret(name: SecretName, value: string): void {
  const store: Store = { ...load() }
  const trimmed = value.trim()
  if (!trimmed) {
    delete store[name]
  } else if (encryptionAvailable()) {
    store[name] = { enc: true, data: safeStorage.encryptString(trimmed).toString('base64') }
  } else {
    // No OS keychain (e.g. a headless Linux box): fall back to obfuscated
    // plaintext so the feature still works, but it's not encrypted at rest.
    store[name] = { enc: false, data: Buffer.from(trimmed, 'utf8').toString('base64') }
  }
  persist(store)
}

function status(): SecretsStatus {
  const state = (name: SecretName): SecretsStatus['anthropic'] => {
    const stored = storedValue(name).length > 0
    const fromEnv = !stored && ENV_FALLBACKS[name].some((e) => Boolean(process.env[e]))
    return { configured: stored || fromEnv, stored, fromEnv }
  }
  return {
    anthropic: state('anthropic'),
    stt: state('stt'),
    encryptionAvailable: encryptionAvailable()
  }
}

export function registerSecretsIpc(): void {
  ipcMain.handle('nova:secrets-status', () => status())
  ipcMain.handle('nova:secrets-set', (_e, payload: { name: SecretName; value: string }) => {
    setSecret(payload.name, payload.value)
    return status()
  })
}
