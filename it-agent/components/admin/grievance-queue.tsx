import { QueueRow } from "@/components/admin/queue-row"
import { sortCases } from "@/lib/admin/conversation-views"
import { queueGridColsClass as gridColsClass } from "@/lib/admin/queue-grid"
import type { GrievanceCase } from "@/lib/mock/types"

interface GrievanceQueueProps {
  cases: GrievanceCase[]
}

/** Priority band (current severity) first, then oldest-first within band. */
export function GrievanceQueue({ cases }: GrievanceQueueProps) {
  const sorted = sortCases(cases, "priority")

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        className={`${gridColsClass} border-b border-border px-4 py-2.5 text-[12px] font-medium text-muted-foreground`}
      >
        <span>Grievance</span>
        <span>Severity</span>
        <span>Age</span>
        <span>Escalated</span>
        <span>Customer</span>
        <span>Contacted by</span>
      </div>

      {sorted.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
          No open grievances.
        </p>
      ) : (
        sorted.map((grievanceCase) => (
          <QueueRow key={grievanceCase.id} grievanceCase={grievanceCase} />
        ))
      )}
    </div>
  )
}
