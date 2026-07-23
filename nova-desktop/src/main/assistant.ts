import Anthropic from '@anthropic-ai/sdk'
import { ipcMain } from 'electron'
import { getEffectiveKey } from './secrets'
import type { AssistantMessage } from '../shared/types'

/**
 * Main-process LLM backend.
 *
 * This is the only place the Anthropic SDK and the API key live — the renderer
 * reaches it exclusively through the `nova:assistant-*` IPC channels, so the
 * key is never exposed to web content. Replies stream back token-by-token via
 * `nova:assistant-delta` events; the `invoke` resolves with the full text.
 */

// NOVA's persona. Kept terse because replies are meant to be spoken aloud.
const SYSTEM_PROMPT = `You are NOVA, a friendly, calm desktop voice assistant.
Speak in the first person. Keep replies short and conversational — usually one
or two sentences, since they are read aloud. Be warm and direct; skip preambles
like "Sure" or "Certainly" and get straight to the point. If you don't know
something, say so plainly.`

const MODEL = 'claude-opus-4-8'

let client: Anthropic | null = null
let clientKey = ''

/**
 * Construct (or reuse) the client for the current effective key. Returns null
 * when no key is configured. Rebuilds if the key changed at runtime (e.g. the
 * user just entered one in Settings).
 */
function getClient(): Anthropic | null {
  const key = getEffectiveKey('anthropic')
  if (!key) return null
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key })
    clientKey = key
  }
  return client
}

/** Register the assistant IPC handlers. Call once on app ready. */
export function registerAssistantIpc(): void {
  ipcMain.handle('nova:assistant-configured', () => getClient() !== null)

  ipcMain.handle(
    'nova:assistant-send',
    async (event, payload: { id: string; messages: AssistantMessage[] }) => {
      const anthropic = getClient()
      if (!anthropic) {
        throw new Error(
          'NOVA has no backend configured. Set the ANTHROPIC_API_KEY environment variable to enable replies.'
        )
      }

      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: payload.messages.map((m) => ({ role: m.role, content: m.content }))
      })

      // Forward each text delta to the requesting renderer as it arrives.
      stream.on('text', (delta) => {
        // The window may have been closed mid-stream; guard the send.
        if (!event.sender.isDestroyed()) {
          event.sender.send('nova:assistant-delta', { id: payload.id, text: delta })
        }
      })

      const final = await stream.finalMessage()
      const text = final.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
      return { text }
    }
  )
}
