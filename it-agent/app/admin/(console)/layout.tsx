import { Suspense } from "react"

import { AdminNavRail } from "@/components/admin/nav-rail"
import { listGrievanceCases } from "@/lib/sqlite/queries"

function NavRailFallback() {
  return <aside className="w-70 shrink-0 border-r border-sidebar-border bg-sidebar" />
}

export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cases = await listGrievanceCases()

  return (
    <div className="flex h-screen bg-canvas">
      <Suspense fallback={<NavRailFallback />}>
        <AdminNavRail cases={cases} />
      </Suspense>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
