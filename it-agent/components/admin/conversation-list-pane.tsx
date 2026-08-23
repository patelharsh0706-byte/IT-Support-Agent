"use client"

import { ArrowDownUp, ListFilter } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConversationListRow } from "@/components/admin/conversation-list-row"
import { ConversationEmptyState } from "@/components/admin/conversation-empty-state"
import {
  buildConversationsHref,
  countByAssignment,
  filterCases,
  parseConversationFilters,
  sortCases,
  viewLabel,
  type AssignmentTab,
} from "@/lib/admin/conversation-views"
import { channelMeta, channelOrder } from "@/lib/mock/channels"
import type { GrievanceCase } from "@/lib/mock/types"

interface ConversationListPaneProps {
  cases: GrievanceCase[]
}

export function ConversationListPane({ cases }: ConversationListPaneProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const filters = parseConversationFilters(searchParams)
  const sort = searchParams.get("sort") === "latest" ? "latest" : "priority"
  const selectedId = pathname.startsWith("/admin/conversations/")
    ? pathname.slice("/admin/conversations/".length)
    : null

  const visible = sortCases(filterCases(cases, filters), sort)
  const assignmentCounts = countByAssignment(cases, filters)
  const title = filters.channel ? channelMeta[filters.channel].label : viewLabel[filters.view]

  // Only used for channel/assignment changes — the open conversation may not
  // belong to the new filter, so selection is intentionally cleared here.
  // The sort toggle below builds its own href and preserves selectedId.
  function goTo(nextFilters: Parameters<typeof buildConversationsHref>[0]) {
    router.push(buildConversationsHref({ ...filters, ...nextFilters }))
  }

  return (
    <section className="flex w-[470px] min-w-0 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[15px] font-medium text-foreground">{title}</h2>
          <Badge variant="secondary">{visible.length}</Badge>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Filter by channel">
                <ListFilter />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => goTo({ channel: null })}>
                All channels
              </DropdownMenuItem>
              {channelOrder.map((c) => (
                <DropdownMenuItem key={c} onClick={() => goTo({ channel: c })}>
                  {channelMeta[c].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle sort order"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              if (sort === "priority") params.set("sort", "latest")
              else params.delete("sort")
              const qs = params.toString()
              const base = selectedId ? `/admin/conversations/${selectedId}` : "/admin/conversations"
              router.push(qs ? `${base}?${qs}` : base)
            }}
          >
            <ArrowDownUp />
          </Button>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3">
        <Tabs
          value={filters.assignment}
          onValueChange={(value) => goTo({ assignment: value as AssignmentTab })}
        >
          <TabsList className="w-full">
            <TabsTrigger value="mine">Mine {assignmentCounts.mine}</TabsTrigger>
            <TabsTrigger value="unassigned">
              Unassigned {assignmentCounts.unassigned}
            </TabsTrigger>
            <TabsTrigger value="all">All {assignmentCounts.all}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="min-h-0 w-full min-w-0 flex-1 pt-2">
        {visible.length === 0 ? (
          <ConversationEmptyState
            title={filters.view === "mentions" ? "No mentions yet" : "No conversations"}
            description={
              filters.view === "mentions"
                ? "Mentions appear when a customer tags the brand handle in a thread you're following."
                : "Nothing matches this view right now."
            }
          />
        ) : (
          visible.map((grievanceCase) => (
            <ConversationListRow
              key={grievanceCase.id}
              grievanceCase={grievanceCase}
              isActive={grievanceCase.id === selectedId}
              href={buildConversationsHref(filters, grievanceCase.id)}
            />
          ))
        )}
      </ScrollArea>
    </section>
  )
}
