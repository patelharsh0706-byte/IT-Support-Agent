import { formatDuration } from "@/lib/format-duration"

interface CaseClocksProps {
  createdAt: string
  escalatedAt: string | null
}

/**
 * Two clocks, never collapsed into one: case age always runs from the
 * first post/request; time-in-escalation is absent (not zero) until the
 * case escalates, then runs and never resets on reply.
 */
export function CaseClocks({ createdAt, escalatedAt }: CaseClocksProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="min-w-0 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-[12px] text-muted-foreground">Case age</p>
        <p className="mt-1 text-[20px] font-semibold text-foreground">
          {formatDuration(createdAt)}
        </p>
      </div>
      <div className="min-w-0 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-[12px] text-muted-foreground">Time in escalation</p>
        <p className="mt-1 text-[20px] font-semibold text-foreground">
          {escalatedAt ? formatDuration(escalatedAt) : "—"}
        </p>
      </div>
    </div>
  )
}
