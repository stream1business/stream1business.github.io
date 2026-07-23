import type { AssistantState } from '@shared/types'

/**
 * LLM backend abstraction.
 *
 * The rest of the app only ever calls `assistant.sendMessage()`. Today it is a
 * local stub that fakes a "thinking → responding" cycle. Swapping in a real
 * backend (Anthropic API, a local model, etc.) means implementing this one
 * interface — the UI and animation layers never change.
 */
export interface AssistantResponse {
  text: string
}

export interface AssistantBackend {
  sendMessage(message: string): Promise<AssistantResponse>
}

/** Callback so the UI can reflect thinking/responding while a turn is in flight. */
export type StateListener = (state: AssistantState) => void

class StubAssistant implements AssistantBackend {
  async sendMessage(message: string): Promise<AssistantResponse> {
    // Simulate network + inference latency so the state machine can be exercised.
    await delay(600)
    return {
      text: `You said: "${message}". (NOVA's language backend is not wired up yet.)`
    }
  }
}

/**
 * Facade used by the UI. Drives the assistant-owned states (thinking →
 * responding → back to previous) around the backend call, and restores the
 * prior state (e.g. listening) when the turn completes.
 */
class Assistant {
  private backend: AssistantBackend = new StubAssistant()

  /** Swap the backend at runtime (e.g. once an API key is configured). */
  useBackend(backend: AssistantBackend): void {
    this.backend = backend
  }

  async ask(
    message: string,
    onState: StateListener,
    previousState: AssistantState
  ): Promise<AssistantResponse> {
    onState('thinking')
    const response = await this.backend.sendMessage(message)
    onState('responding')
    // Give the "responding" animation a beat to play. A real backend would
    // instead hold this state while TTS / streamed text plays back.
    await delay(1500)
    onState(previousState)
    return response
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const assistant = new Assistant()
