import { Skeleton } from "@/components/ui/skeleton"

/** Suspense fallback for `ConversationListPane` — matches its 470px frame so nothing jumps once it resolves. */
export function ConversationListSkeleton() {
  return (
    <section className="flex w-[470px] min-w-0 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
