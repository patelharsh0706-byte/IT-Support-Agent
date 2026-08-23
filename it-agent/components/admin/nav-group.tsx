"use client"

import { useState } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface AdminNavGroupProps {
  label: string
  icon?: LucideIcon
  defaultOpen?: boolean
  /** 0 = top-level group ("Conversations"), 1 = nested group ("Channels"). */
  level?: 0 | 1
  children: React.ReactNode
}

export function AdminNavGroup({
  label,
  icon: Icon,
  defaultOpen = true,
  level = 0,
  children,
}: AdminNavGroupProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-lg py-1.5 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          level === 0 ? "px-3" : "pl-6 pr-3"
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
        {Icon ? <Icon className="size-4 shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-0.5 pt-0.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
