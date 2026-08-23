import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "@/components/editor/message-item"
import type { ChatMessage } from "@/lib/mock/types"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
})

// Local calendar-day key. Using `timestamp.slice(0, 10)` would group by the
// UTC date while the label below renders in local time — the two can
// disagree near midnight in timezones behind/ahead of UTC.
function dateKey(timestamp: string) {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

interface MessageListProps {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-[13px] text-muted-foreground">
        No messages yet.
      </div>
    )
  }

  const groups: { date: string; messages: ChatMessage[] }[] = []
  for (const message of messages) {
    const key = dateKey(message.timestamp)
    const lastGroup = groups[groups.length - 1]
    if (lastGroup?.date === key) {
      lastGroup.messages.push(message)
    } else {
      groups.push({ date: key, messages: [message] })
    }
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-4">
        {groups.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-3 py-3">
              <Separator className="flex-1" />
              <span className="shrink-0 text-[13px] text-muted-foreground">
                {dateFormatter.format(new Date(group.messages[0].timestamp))}
              </span>
              <Separator className="flex-1" />
            </div>
            {group.messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
