import { ShieldCheck, ShieldOff, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ActivityPanel } from "@/components/shared/activity-panel"
import { CaseClocks } from "@/components/admin/case-clocks"
import { CustomerStatusBadge } from "@/components/admin/customer-status-badge"
import { SeverityHistory } from "@/components/admin/severity-history"
import type { GrievanceCase } from "@/lib/mock/types"
import { cn } from "@/lib/utils"

interface ConversationContextSidebarProps {
  grievanceCase: GrievanceCase
  isOpen: boolean
  onClose: () => void
  className?: string
}

export function ConversationContextSidebar({
  grievanceCase,
  isOpen,
  onClose,
  className,
}: ConversationContextSidebarProps) {
  if (!isOpen) return null

  return (
    <aside
      className={cn(
        "flex w-90 min-w-0 shrink-0 flex-col border-l border-border bg-surface",
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-[15px] font-medium text-foreground">Case details</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close case details"
        >
          <X />
        </Button>
      </div>

      <ScrollArea className="min-h-0 w-full min-w-0 flex-1">
        <div className="flex min-w-0 flex-col gap-5 p-4">
          {grievanceCase.originalPostUrl ? (
            <a
              href={grievanceCase.originalPostUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-primary underline-offset-2 hover:underline"
            >
              View original post
            </a>
          ) : null}

          <CaseClocks
            createdAt={grievanceCase.createdAt}
            escalatedAt={grievanceCase.escalatedAt}
          />

          <div className="flex items-center gap-2 text-[13px]">
            <CustomerStatusBadge status={grievanceCase.customerStatus} />
            <span className="flex items-center gap-1 text-muted-foreground">
              {grievanceCase.customerVerified ? (
                <>
                  <ShieldCheck className="size-3.5" /> Verified customer link
                </>
              ) : (
                <>
                  <ShieldOff className="size-3.5" /> Unverified — soft link only
                </>
              )}
            </span>
          </div>

          {grievanceCase.classification ? (
            <p className="text-[13px] text-muted-foreground">
              Classified as{" "}
              <span className="font-medium text-foreground">
                {grievanceCase.classification.intent.replaceAll("_", " ")}
              </span>{" "}
              ({Math.round(grievanceCase.classification.confidence * 100)}% confidence)
            </p>
          ) : null}

          <section>
            <h3 className="text-[13px] font-medium text-foreground">Severity history</h3>
            <div className="mt-2">
              <SeverityHistory history={grievanceCase.severityHistory} />
            </div>
          </section>

          <section className="flex flex-col">
            <h3 className="text-[13px] font-medium text-foreground">Tool-call log</h3>
            <div className="mt-2 rounded-xl border border-border">
              <ActivityPanel
                events={grievanceCase.toolCallLog}
                className="max-h-72"
                emptyMessage="No tool calls recorded."
              />
            </div>
          </section>
        </div>
      </ScrollArea>
    </aside>
  )
}
