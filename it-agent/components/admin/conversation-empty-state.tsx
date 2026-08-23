import { MessagesSquare } from "lucide-react"

interface ConversationEmptyStateProps {
  title?: string
  description?: string
}

export function ConversationEmptyState({
  title = "Select a conversation",
  description = "Pick a case from the list to read the thread and reply.",
}: ConversationEmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-subtle text-muted-foreground">
        <MessagesSquare className="size-5" />
      </span>
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-[13px] text-muted-foreground">{description}</p>
    </div>
  )
}
