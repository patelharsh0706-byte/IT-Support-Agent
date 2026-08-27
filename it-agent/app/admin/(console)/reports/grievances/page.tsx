import { GrievanceQueue } from "@/components/admin/grievance-queue"
import { listGrievanceCases } from "@/lib/sqlite/queries"

// No dynamic API is called on this page path, so Next would otherwise
// prerender it statically at build time and freeze the DB read.
export const dynamic = "force-dynamic"

export default async function GrievanceQueuePage() {
  const cases = await listGrievanceCases()

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <h1 className="mb-4 font-heading text-[22px] font-semibold text-foreground">
        Grievance Queue
      </h1>
      <GrievanceQueue cases={cases} />
    </div>
  )
}
