import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConversationMessage } from "@/components/admin/conversation-message"
import type { CaseThreadMessage } from "@/lib/mock/case-thread"
import { cn } from "@/lib/utils"

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

interface ConversationThreadProps {
  messages: CaseThreadMessage[]
  className?: string
}

export function ConversationThread({ messages, className }: ConversationThreadProps) {
  const groups: { date: string; messages: CaseThreadMessage[] }[] = []
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
    <ScrollArea className={cn("min-h-0 w-full min-w-0 flex-1", className)}>
      <div className="flex flex-col px-4 py-4">
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
              <ConversationMessage key={message.id} message={message} />
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
