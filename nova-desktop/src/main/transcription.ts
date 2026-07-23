import { ipcMain } from 'electron'

/**
 * Main-process speech-to-text backend.
 *
 * Records happen in the renderer (MediaRecorder); the audio bytes come here
 * over IPC, and this is the only place the STT API key lives. It POSTs to an
 * OpenAI-compatible `/audio/transcriptions` endpoint, so it works with OpenAI
 * Whisper out of the box and with any compatible service (e.g. Groq-hosted
 * Whisper) by pointing the base URL / model at it.
 *
 * Configuration (env vars):
 *   NOVA_STT_API_KEY   the key (falls back to OPENAI_API_KEY, then GROQ_API_KEY)
 *   NOVA_STT_BASE_URL  default https://api.openai.com/v1
 *   NOVA_STT_MODEL     default whisper-1
 */

function sttKey(): string {
  return (
    process.env.NOVA_STT_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.GROQ_API_KEY ??
    ''
  )
}

/** Map a recorder MIME type to a file extension the API will accept. */
function extensionFor(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export function registerTranscriptionIpc(): void {
  ipcMain.handle('nova:transcription-configured', () => sttKey().length > 0)

  ipcMain.handle(
    'nova:transcribe',
    async (_event, payload: { audio: ArrayBuffer; mimeType: string }) => {
      const key = sttKey()
      if (!key) {
        throw new Error(
          'Speech-to-text is not configured. Set NOVA_STT_API_KEY (or OPENAI_API_KEY) to enable Whisper.'
        )
      }

      const baseUrl = (process.env.NOVA_STT_BASE_URL ?? 'https://api.openai.com/v1').replace(
        /\/$/,
        ''
      )
      const model = process.env.NOVA_STT_MODEL ?? 'whisper-1'
      const mimeType = payload.mimeType || 'audio/webm'

      const form = new FormData()
      form.append('file', new Blob([payload.audio], { type: mimeType }), `audio.${extensionFor(mimeType)}`)
      form.append('model', model)
      form.append('response_format', 'json')

      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(
          `Transcription failed (${response.status}). ${detail.slice(0, 200)}`.trim()
        )
      }

      const data = (await response.json()) as { text?: string }
      return { text: data.text ?? '' }
    }
  )
}
