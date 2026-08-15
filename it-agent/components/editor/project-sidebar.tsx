"use client"

import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
  onNewProject?: () => void
  id?: string
  className?: string
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-10 text-center text-[13px] text-muted-foreground">
      {message}
    </div>
  )
}

/**
 * Project sidebar. Floats above the editor canvas and slides in from the left,
 * so opening it never pushes page content. Position is absolute — the editor
 * shell that renders it must establish a positioning context (`relative`).
 */
export function ProjectSidebar({
  isOpen,
  onClose,
  onNewProject,
  id,
  className,
}: ProjectSidebarProps) {
  return (
    <aside
      id={id}
      aria-label="Projects"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        "absolute inset-y-0 left-0 z-40 flex w-70 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-heading text-[22px] leading-none font-semibold">
          Projects
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close projects"
        >
          <X />
        </Button>
      </div>

      <Tabs defaultValue="mine" className="min-h-0 flex-1 gap-0">
        <div className="shrink-0 px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="mine">My Projects</TabsTrigger>
            <TabsTrigger value="shared">Shared</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="mine" className="h-full">
            <EmptyState message="No projects yet." />
          </TabsContent>
          <TabsContent value="shared" className="h-full">
            <EmptyState message="Nothing shared with you yet." />
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="shrink-0 border-t border-border p-3">
        <Button type="button" className="w-full" onClick={onNewProject}>
          <Plus />
          New Project
        </Button>
      </div>
    </aside>
  )
}
