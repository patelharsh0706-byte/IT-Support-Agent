import Link from "next/link"

import { DashboardMetricCard } from "@/components/admin/dashboard-metric-card"
import { computeDashboardMetrics, getGrievanceCaseDetail } from "@/lib/sqlite/queries"

// Neither this page nor its query functions call a Next.js dynamic API
// (no auth() call, no searchParams), so Next would otherwise prerender it
// statically at build time and freeze the DB read — wrong for a dashboard
// whose own component doc comment says "always matches a live query, never
// an app-level counter."
export const dynamic = "force-dynamic"

export default async function GrievanceDashboardPage() {
  const {
    openBySeverity,
    oldestUnansweredCaseId,
    oldestUnansweredAgeHours,
    escalationsPastThreshold,
    closedAccountOpenGrievanceCount,
  } = await computeDashboardMetrics()

  const totalOpen = openBySeverity.high + openBySeverity.medium + openBySeverity.low
  const oldestCase = oldestUnansweredCaseId
    ? await getGrievanceCaseDetail(oldestUnansweredCaseId)
    : null

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <h1 className="mb-4 font-heading text-[22px] font-semibold text-foreground">
        Dashboard
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          label="Open grievances by severity"
          value={String(totalOpen)}
          detail={`${openBySeverity.high} High · ${openBySeverity.medium} Medium · ${openBySeverity.low} Low`}
        />

        <DashboardMetricCard
          label="Oldest unanswered case"
          value={
            oldestUnansweredAgeHours != null
              ? `${Math.round(oldestUnansweredAgeHours)}h`
              : "—"
          }
          detail={
            oldestCase ? (
              <Link
                href={`/admin/conversations/${oldestCase.id}`}
                className="text-primary hover:underline"
              >
                {oldestCase.summary}
              </Link>
            ) : undefined
          }
        />

        <DashboardMetricCard
          label="Escalations past threshold"
          value={String(escalationsPastThreshold)}
        />

        <DashboardMetricCard
          label="Closed account, open grievance"
          value={
            closedAccountOpenGrievanceCount != null
              ? String(closedAccountOpenGrievanceCount)
              : "Not yet available"
          }
          detail="Customers who closed their account while a grievance sat open. Needs a closure timestamp on customers, not yet in the schema."
        />
      </div>
    </div>
  )
}
