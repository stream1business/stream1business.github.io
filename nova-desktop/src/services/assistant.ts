import type { AssistantState } from '@shared/types'

/**
 * LLM backend abstraction.
 *
 * The UI only ever calls {@link Assistant.sendMessage}. Today that resolves to
 * a canned local reply; swapping in a real API (e.g. the Anthropic Messages
 * API) later means implementing this interface and changing one line in the
 * factory below — no UI changes required.
 */
export interface AssistantReply {
  text: string
}

export interface Assistant {
  /**
   * Send a user message and receive a reply.
   * @param message   The user's text (or transcribed speech).
   * @param onState   Optional callback so the caller can drive the orb's
   *                  state machine (`thinking` → `responding` → `listening`).
   */
  sendMessage(
    message: string,
    onState?: (state: AssistantState) => void
  ): Promise<AssistantReply>
}

/**
 * Local stub assistant. Simulates "thinking" then "responding" latency so the
 * full state machine can be exercised end-to-end without a network backend.
 */
export class StubAssistant implements Assistant {
  async sendMessage(
    message: string,
    onState?: (state: AssistantState) => void
  ): Promise<AssistantReply> {
    onState?.('thinking')
    await delay(900)
    onState?.('responding')
    await delay(1200)
    onState?.('listening')
    return { text: `You said: "${message}". (NOVA is running in offline stub mode.)` }
  }
}

/**
 * Placeholder for the future real backend. Wiring this up later only requires
 * filling in `sendMessage` with an actual `fetch` to the model provider and
 * returning it from {@link createAssistant}.
 *
 * Example shape (not enabled):
 *
 *   const res = await fetch('https://api.anthropic.com/v1/messages', { ... })
 */
export class RemoteAssistant implements Assistant {
  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  async sendMessage(
    _message: string,
    _onState?: (state: AssistantState) => void
  ): Promise<AssistantReply> {
    const configured = this.endpoint.length > 0 && this.apiKey.length > 0
    throw new Error(
      configured
        ? 'RemoteAssistant.sendMessage is not implemented yet. Wire up the fetch call here.'
        : 'RemoteAssistant needs an endpoint + API key before it can send messages.'
    )
  }
}

/** Factory: the single seam where the concrete backend is chosen. */
export function createAssistant(): Assistant {
  return new StubAssistant()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
