"use client"

import { useState } from "react"

import { EditorDialog } from "@/components/editor/editor-dialog"
import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { Button } from "@/components/ui/button"

/**
 * Preview route for the spec `02-editor` chrome. Not part of the product —
 * remove it once the real editor shell lands.
 */
export default function EditorCheckPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col">
      <EditorNavbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        sidebarId="project-sidebar"
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ProjectSidebar
          id="project-sidebar"
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex h-full flex-col items-start gap-4 p-8">
          <p className="text-[15px] text-muted-foreground">
            Editor canvas. Toggle the sidebar from the navbar — it floats over
            this area rather than pushing it.
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>Open dialog</Button>
        </main>
      </div>

      <EditorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Dialog pattern"
        description="Title, description, and footer actions — the shared shape every editor dialog will use."
        actions={<Button>Confirm</Button>}
      />
    </div>
  )
}
