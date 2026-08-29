import { Radio, ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"

interface PublishModeBadgeProps {
  isLive: boolean
  className?: string
}

/**
 * On screen wherever the composer is, never buried in settings. Nobody should
 * discover that publishing was live by seeing their test text appear on a real
 * timeline — or that it was a dry run by a customer never receiving a reply.
 */
export function PublishModeBadge({ isLive, className }: PublishModeBadgeProps) {
  const Icon = isLive ? Radio : ShieldCheck

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium",
        isLive ? "bg-state-error/10 text-state-error" : "bg-state-success/10 text-state-success",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {isLive ? "Publishing live to X" : "Dry run — nothing is posted"}
    </span>
  )
}
