"use client"

import { ClerkLoaded, ClerkLoading, UserButton } from "@clerk/nextjs"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface EditorNavbarProps {
  /** Whether the ticket sidebar is currently open. Drives the toggle icon. */
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  /** id of the sidebar element, wired to the toggle for assistive tech. */
  sidebarId?: string
  className?: string
}

/**
 * Fixed-height top navbar that frames every editor screen. Left section holds
 * the sidebar toggle; right section holds the signed-in user menu; centre is
 * reserved and stays empty until a later unit fills it.
 */
export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
  sidebarId,
  className,
}: EditorNavbarProps) {
  const ToggleIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center border-b border-chrome-border bg-chrome px-3 text-chrome-foreground",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-controls={sidebarId}
          aria-expanded={isSidebarOpen}
          aria-label={isSidebarOpen ? "Close tickets" : "Open tickets"}
          className="text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground"
        >
          <ToggleIcon />
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center" />

      <div className="flex flex-1 items-center justify-end">
        {/* Same gate as the CSR nav rail: UserButton's host element differs
            between the server pass and the client one, so it must not render
            until Clerk has loaded. */}
        <ClerkLoading>
          <Skeleton className="size-7 rounded-full" />
        </ClerkLoading>
        <ClerkLoaded>
          <UserButton />
        </ClerkLoaded>
      </div>
    </header>
  )
}
