import type { AssistantReply, AssistantState } from '@shared/types'

/**
 * LLM backend abstraction.
 *
 * The UI only ever calls {@link Assistant.sendMessage}. The concrete backend is
 * chosen once by {@link createAssistant}; swapping implementations requires no
 * UI changes.
 */
export interface SendOptions {
  /** Drive the orb's state machine (`thinking` → `responding` → `listening`). */
  onState?: (state: AssistantState) => void
  /** Receive the reply-so-far as it streams in (full text each call). */
  onDelta?: (fullText: string) => void
}

export interface Assistant {
  sendMessage(message: string, opts?: SendOptions): Promise<AssistantReply>
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Offline stub. Simulates the `thinking → responding → listening` latency and
 * "types" a canned reply so the full pipeline can be exercised with no backend.
 */
export class StubAssistant implements Assistant {
  async sendMessage(message: string, opts?: SendOptions): Promise<AssistantReply> {
    opts?.onState?.('thinking')
    await delay(700)
    opts?.onState?.('responding')

    const text = `You said: "${message}". I'm running in offline mode — set ANTHROPIC_API_KEY to hear a real reply.`
    // Stream it word-by-word so the UI behaves the same as the live backend.
    let shown = ''
    for (const word of text.split(' ')) {
      shown += (shown ? ' ' : '') + word
      opts?.onDelta?.(shown)
      await delay(40)
    }

    opts?.onState?.('listening')
    return { text }
  }
}

/**
 * Real backend. Proxies to the main process (which owns the Anthropic SDK and
 * the API key) via `window.nova.assistant`. Falls back to the stub when no key
 * is configured, and surfaces backend errors as the reply text.
 */
export class RemoteAssistant implements Assistant {
  private readonly fallback = new StubAssistant()

  async sendMessage(message: string, opts?: SendOptions): Promise<AssistantReply> {
    if (!(await window.nova.assistant.isConfigured())) {
      return this.fallback.sendMessage(message, opts)
    }

    opts?.onState?.('thinking')
    let firstDelta = true
    let streamed = ''
    try {
      const reply = await window.nova.assistant.send([{ role: 'user', content: message }], {
        onDelta: (chunk) => {
          if (firstDelta) {
            firstDelta = false
            opts?.onState?.('responding')
          }
          streamed += chunk
          opts?.onDelta?.(streamed)
        }
      })
      opts?.onState?.('listening')
      return reply
    } catch (err) {
      opts?.onState?.('listening')
      return { text: err instanceof Error ? err.message : 'NOVA ran into an error.' }
    }
  }
}

/** Factory: the single seam where the concrete backend is chosen. */
export function createAssistant(): Assistant {
  // The bridge only exists inside Electron; tests / plain-web contexts get the stub.
  if (typeof window !== 'undefined' && window.nova?.assistant) {
    return new RemoteAssistant()
  }
  return new StubAssistant()
}
