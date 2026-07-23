import type { AssistantState } from '@shared/types'
import { useNovaStore } from '@renderer/state/store'

/**
 * Assistant backend abstraction.
 *
 * Today this is a local stub: it just drives the state machine through a
 * plausible `thinking → responding → listening` cycle so the UI can be
 * exercised. Swapping in a real LLM (e.g. the Anthropic API) later means
 * implementing {@link AssistantBackend.sendMessage} — no UI or animation code
 * needs to change, because everything reacts to the store.
 */
export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantBackend {
  /** Send a user message and receive the assistant's reply. */
  sendMessage(text: string, history?: AssistantMessage[]): Promise<string>
}

/** Helper to set assistant state from non-React code. */
function setState(state: AssistantState): void {
  useNovaStore.getState().setAssistantState(state)
}

/**
 * Local echo/stub backend. Simulates latency and playback so the
 * `thinking`/`responding` states are visible without any network calls.
 */
export class StubAssistantBackend implements AssistantBackend {
  async sendMessage(text: string): Promise<string> {
    setState('thinking')
    await delay(1400)

    const reply = `You said: "${text}". (NOVA stub — wire a real backend into services/assistant.ts.)`

    setState('responding')
    // Simulate the length of spoken playback.
    await delay(Math.min(4000, 900 + reply.length * 25))

    // Return to listening if the mic is on, otherwise idle.
    setState(useNovaStore.getState().settings.micEnabled ? 'listening' : 'idle')
    return reply
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * The single instance the UI talks to. Replace `new StubAssistantBackend()`
 * with a real implementation (e.g. `new AnthropicBackend(apiKey)`) to go live.
 */
export const assistant: AssistantBackend = new StubAssistantBackend()
