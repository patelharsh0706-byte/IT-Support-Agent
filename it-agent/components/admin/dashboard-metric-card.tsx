import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface DashboardMetricCardProps {
  label: string
  value: string
  detail?: ReactNode
  highlight?: boolean
  className?: string
}

/** One dashboard tile — a single value that always matches a live query, never an app-level counter. */
export function DashboardMetricCard({
  label,
  value,
  detail,
  highlight,
  className,
}: DashboardMetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border p-5",
        highlight
          ? "border-state-error/30 bg-state-error/5"
          : "border-border bg-surface",
        className
      )}
    >
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-[28px] font-semibold",
          highlight ? "text-state-error" : "text-foreground"
        )}
      >
        {value}
      </p>
      {detail ? (
        <p className="text-[12px] text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  )
}
