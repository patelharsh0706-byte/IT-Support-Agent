import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { ChatMessage } from "@/lib/mock/types"

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface MessageItemProps {
  message: ChatMessage
}

export function MessageItem({ message }: MessageItemProps) {
  return (
    <div className="flex gap-3 py-3">
      <Avatar size="sm" className="mt-0.5">
        <AvatarFallback>{initials(message.authorName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-medium text-foreground">
            {message.authorName}
          </span>
          <span className="shrink-0 text-[13px] text-muted-foreground">
            {timeFormatter.format(new Date(message.timestamp))}
          </span>
        </div>
        <p className="mt-0.5 text-[15px] text-foreground">{message.content}</p>
      </div>
    </div>
  )
}
