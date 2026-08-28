import { describe, expect, it } from "vitest"

import { readChatStream, type ChatStreamEvent } from "./stream-client"

/**
 * The parser, tested against the awkward cases a real network produces:
 * a line split across two chunks, several events in one chunk, and a final
 * line with no trailing newline.
 */

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
}

async function collect(chunks: string[]): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = []
  for await (const e of readChatStream(streamOf(chunks))) out.push(e)
  return out
}

const activity = (stage: string) =>
  JSON.stringify({ type: "activity", event: { stage, status: "ok", detail: "d", at: "t" } })

describe("readChatStream", () => {
  it("reads whole lines", async () => {
    const events = await collect([`${activity("classify")}\n${activity("verify")}\n`])
    expect(events).toHaveLength(2)
  })

  it("reassembles a line split across chunks", async () => {
    const line = activity("classify")
    const events = await collect([line.slice(0, 20), `${line.slice(20)}\n`])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: "activity" })
  })

  it("yields a final line with no trailing newline", async () => {
    const events = await collect([`${activity("classify")}\n`, activity("confirm")])
    expect(events).toHaveLength(2)
  })

  it("skips a malformed line without losing the rest", async () => {
    const events = await collect([`not json\n${activity("classify")}\n`])
    expect(events).toHaveLength(1)
  })

  it("ignores blank lines", async () => {
    expect(await collect([`\n\n${activity("classify")}\n\n`])).toHaveLength(1)
  })
})
