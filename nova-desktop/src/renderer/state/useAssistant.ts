import { useCallback, useRef, useState } from 'react'
import { createAssistant } from '@services/assistant'
import { useNovaStore } from './store'

/**
 * React hook wrapping the {@link createAssistant} backend.
 *
 * This is the seam between the UI and the (currently stubbed) LLM. The UI only
 * calls `ask()`; the assistant drives the orb's state machine through its
 * `onState` callback (`thinking → responding → listening`) and the resulting
 * exchange is written to the store. Swapping in a real backend later requires
 * no changes here.
 */
export function useAssistant(): {
  ask: (text: string) => Promise<void>
  busy: boolean
} {
  // One assistant instance for the component's lifetime.
  const assistant = useRef(createAssistant())
  const setAssistantState = useNovaStore((s) => s.setAssistantState)
  const setLastExchange = useNovaStore((s) => s.setLastExchange)
  const setStreamingReply = useNovaStore((s) => s.setStreamingReply)
  const [busy, setBusy] = useState(false)

  const ask = useCallback(
    async (text: string) => {
      const prompt = text.trim()
      if (!prompt || busy) return
      setBusy(true)
      setStreamingReply('')
      try {
        const reply = await assistant.current.sendMessage(prompt, {
          onState: setAssistantState,
          onDelta: (full) => setStreamingReply(full)
        })
        setLastExchange({ prompt, reply: reply.text })
      } catch (err) {
        setLastExchange({
          prompt,
          reply: err instanceof Error ? `Error: ${err.message}` : 'Something went wrong.'
        })
        setAssistantState('listening')
      } finally {
        setStreamingReply(null)
        setBusy(false)
      }
    },
    [busy, setAssistantState, setLastExchange, setStreamingReply]
  )

  return { ask, busy }
}
