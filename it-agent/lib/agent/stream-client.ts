import type { chatMessages, serviceRequests } from "@/lib/sqlite/schema"

type ChatMessageRow = typeof chatMessages.$inferSelect
type ServiceRequestRow = typeof serviceRequests.$inferSelect

/**
 * Client-side reader for the NDJSON stream `app/api/chat/route.ts` produces.
 *
 * Kept out of the component so the parsing — partial lines, split chunks — is
 * in one testable place rather than tangled with React state.
 */

export type ChatStreamEvent =
  | { type: "accepted"; message: ChatMessageRow }
  | { type: "activity"; event: { stage: string; status: string; detail: string; at: string } }
  | {
      type: "result"
      outcome: "resolved" | "escalated"
      issue: string
      priority: string | null
      escalationReason: string | null
      message: ChatMessageRow
      /** The ticket as stored after the turn — status, issue, priority. */
      serviceRequest: ServiceRequestRow | null
    }
  | { type: "error"; error: string }

/**
 * Splits a byte stream into whole JSON lines. A chunk boundary can land
 * mid-line, so the tail is buffered until its newline arrives — reading each
 * chunk as if it were a complete line silently drops messages.
 */
export async function* readChatStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      // The last element is either "" (chunk ended on a newline) or a partial
      // line; either way it belongs to the next chunk.
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          yield JSON.parse(trimmed) as ChatStreamEvent
        } catch {
          // A malformed line loses one event, not the whole turn.
        }
      }
    }

    const tail = buffer.trim()
    if (tail) {
      try {
        yield JSON.parse(tail) as ChatStreamEvent
      } catch {
        /* ignore */
      }
    }
  } finally {
    reader.releaseLock()
  }
}
