import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface AdminNavLinkProps {
  href: string
  label: string
  icon?: LucideIcon
  isActive: boolean
  /** Right-aligned count pill. Omitted when 0/undefined. */
  count?: number
  level?: 0 | 1 | 2
}

export function AdminNavLink({
  href,
  label,
  icon: Icon,
  isActive,
  count,
  level = 1,
}: AdminNavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={isActive || undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg py-1.5 text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        level === 1 ? "pl-9 pr-3" : "pl-12 pr-3",
        isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count ? (
        <span className="shrink-0 tabular-nums text-[11px] text-sidebar-foreground/60">
          {count}
        </span>
      ) : null}
    </Link>
  )
}
