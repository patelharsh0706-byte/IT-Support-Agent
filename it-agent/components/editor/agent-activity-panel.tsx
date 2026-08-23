import { ActivityPanel } from "@/components/shared/activity-panel"
import type { ActivityEvent, ActivityTerminalState } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

interface AgentActivityPanelProps {
  events: ActivityEvent[]
  terminalState?: ActivityTerminalState
  className?: string
}

/** Fixed right panel: pinned header + the shared activity stream body. */
export function AgentActivityPanel({
  events,
  terminalState,
  className,
}: AgentActivityPanelProps) {
  return (
    <aside
      className={cn(
        "flex w-full max-w-120 shrink-0 flex-col border-l border-border bg-surface",
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <h2 className="text-[15px] font-medium text-foreground">
          Agent Activity
        </h2>
      </div>
      <ActivityPanel events={events} terminalState={terminalState} />
    </aside>
  )
}
