import { GrievanceQueue } from "@/components/admin/grievance-queue"
import { grievanceCases } from "@/lib/mock/fixtures"

export default function GrievanceQueuePage() {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <h1 className="mb-4 font-heading text-[22px] font-semibold text-foreground">
        Grievance Queue
      </h1>
      <GrievanceQueue cases={grievanceCases} />
    </div>
  )
}
