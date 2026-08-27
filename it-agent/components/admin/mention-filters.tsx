"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { TWEET_WINDOWS } from "@/lib/social/types"
import { cn } from "@/lib/utils"

/**
 * Window and filter state lives in the URL so the server component does the
 * filtering — the same pattern Conversations uses for `?view=` / `?channel=`.
 */
export function MentionFilters() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const activeWindow = searchParams.get("window")
  const grievanceOnly = searchParams.get("grievanceOnly") === "true"
  const unrepliedOnly = searchParams.get("unrepliedOnly") === "true"
  const includeDismissed = searchParams.get("includeDismissed") === "true"

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null) params.delete(key)
    else params.set(key, value)
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  function toggle(key: string, current: boolean) {
    setParam(key, current ? null : "true")
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1" role="group" aria-label="Time window">
        <Button
          type="button"
          size="sm"
          variant={activeWindow === null ? "secondary" : "ghost"}
          onClick={() => setParam("window", null)}
        >
          All time
        </Button>
        {TWEET_WINDOWS.map((hours) => (
          <Button
            key={hours}
            type="button"
            size="sm"
            variant={activeWindow === String(hours) ? "secondary" : "ghost"}
            onClick={() => setParam("window", String(hours))}
          >
            Last {hours}h
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <FilterToggle
          label="Grievances only"
          active={grievanceOnly}
          onClick={() => toggle("grievanceOnly", grievanceOnly)}
        />
        <FilterToggle
          label="Unreplied only"
          active={unrepliedOnly}
          onClick={() => toggle("unrepliedOnly", unrepliedOnly)}
        />
        <FilterToggle
          label="Show dismissed"
          active={includeDismissed}
          onClick={() => toggle("includeDismissed", includeDismissed)}
        />
      </div>
    </div>
  )
}

function FilterToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className={cn(active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground")}
    >
      {label}
    </Button>
  )
}
