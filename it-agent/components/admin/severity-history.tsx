import { SeverityBadge } from "@/components/shared/severity-badge"
import type { SeverityChange } from "@/lib/mock/types"

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

interface SeverityHistoryProps {
  history: SeverityChange[]
}

/** Full audit list of severity changes — never just the current value. */
export function SeverityHistory({ history }: SeverityHistoryProps) {
  if (history.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No severity changes recorded.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {history.map((change) => (
        <li key={change.id} className="flex flex-col gap-1 py-2.5">
          <div className="flex items-center gap-2 text-[13px]">
            {change.from ? <SeverityBadge severity={change.from} /> : (
              <span className="text-muted-foreground">—</span>
            )}
            <span className="text-muted-foreground">→</span>
            <SeverityBadge severity={change.to} />
            <span className="ml-auto text-[12px] text-muted-foreground">
              {dateTimeFormatter.format(new Date(change.changedAt))}
            </span>
          </div>
          {change.reason ? (
            <p className="text-[13px] text-muted-foreground">{change.reason}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
