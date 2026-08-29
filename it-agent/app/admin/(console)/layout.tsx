import { Suspense } from "react"

import { AdminNavRail } from "@/components/admin/nav-rail"
import { requireCsrProfile } from "@/lib/auth/session"
import { listGrievanceCases } from "@/lib/sqlite/queries"

function NavRailFallback() {
  return <aside className="w-70 shrink-0 border-r border-sidebar-border bg-sidebar" />
}

export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // `proxy.ts` already gates every route under this group to `role === "csr"`;
  // this is defense in depth, same pattern as the API routes (see
  // `context/code-standards.md`, API Routes). It also resolves the identity
  // the rail renders, so the rail never has to reach for a client hook.
  const csr = await requireCsrProfile()
  const cases = await listGrievanceCases()

  return (
    <div className="flex h-screen bg-canvas">
      <Suspense fallback={<NavRailFallback />}>
        <AdminNavRail cases={cases} csr={csr} />
      </Suspense>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
