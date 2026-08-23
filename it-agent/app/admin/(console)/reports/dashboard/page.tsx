import Link from "next/link"

import { DashboardMetricCard } from "@/components/admin/dashboard-metric-card"
import { dashboardMetrics, grievanceCases } from "@/lib/mock/fixtures"

export default function GrievanceDashboardPage() {
  const { openBySeverity, oldestUnansweredCaseId, escalationsPastThreshold, closedAccountOpenGrievanceCount } =
    dashboardMetrics

  const totalOpen = openBySeverity.high + openBySeverity.medium + openBySeverity.low
  const oldestCase = grievanceCases.find((c) => c.id === oldestUnansweredCaseId)

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
            dashboardMetrics.oldestUnansweredAgeHours != null
              ? `${dashboardMetrics.oldestUnansweredAgeHours}h`
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
          value={String(closedAccountOpenGrievanceCount)}
          detail="Customers who closed their account while a grievance sat open."
          highlight
        />
      </div>
    </div>
  )
}
