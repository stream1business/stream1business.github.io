import type { AssistantState } from '@shared/types'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantReply {
  content: string
}

/**
 * LLM backend abstraction.
 *
 * The UI only ever calls `sendMessage()`. Today it's a local stub that fakes a
 * "thinking → responding" round-trip; later this same interface can wrap a real
 * API call (e.g. the Anthropic API) with zero changes to the UI layer.
 */
export interface AssistantBackend {
  sendMessage(
    message: string,
    history?: AssistantMessage[],
    onState?: (state: AssistantState) => void
  ): Promise<AssistantReply>
}

const STUB_REPLIES = [
  "I'm here. This is a local stub — wire me to a real model in services/assistant.ts.",
  'Heard you. No backend is connected yet, so this is a canned response.',
  'Standing by. Swap this stub for an API call and I come alive.'
]

/**
 * Local, no-network stub backend. Emulates realistic state transitions so the
 * animation state machine can be exercised end-to-end before any real model is
 * connected.
 */
export class StubAssistantBackend implements AssistantBackend {
  private turn = 0

  async sendMessage(
    _message: string,
    _history: AssistantMessage[] = [],
    onState?: (state: AssistantState) => void
  ): Promise<AssistantReply> {
    onState?.('thinking')
    await delay(900)
    onState?.('responding')
    const content = STUB_REPLIES[this.turn % STUB_REPLIES.length]
    this.turn += 1
    // Rough "speaking time" proportional to reply length.
    await delay(Math.min(4000, 700 + content.length * 25))
    onState?.('listening')
    return { content }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** The active backend. Swap this line to change implementations app-wide. */
export const assistant: AssistantBackend = new StubAssistantBackend()
