"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EditorNavbarProps {
  /** Whether the project sidebar is currently open. Drives the toggle icon. */
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  /** id of the sidebar element, wired to the toggle for assistive tech. */
  sidebarId?: string
  className?: string
}

/**
 * Fixed-height top navbar that frames every editor screen. Left section holds
 * the sidebar toggle; the centre and right sections are reserved and stay
 * empty until a later unit fills them.
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
          aria-label={isSidebarOpen ? "Close projects" : "Open projects"}
          className="text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground"
        >
          <ToggleIcon />
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center" />

      <div className="flex flex-1 items-center justify-end" />
    </header>
  )
}
