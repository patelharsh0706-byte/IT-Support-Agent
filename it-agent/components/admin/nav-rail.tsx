"use client"

import { UserButton, useUser } from "@clerk/nextjs"
import { BarChart3, LayoutList, MessagesSquare, Search } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { AdminNavGroup } from "@/components/admin/nav-group"
import { AdminNavLink } from "@/components/admin/nav-link"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { buildConversationsHref, countByChannel, countByView } from "@/lib/admin/conversation-views"
import { channelMeta, channelOrder } from "@/lib/mock/channels"
import type { GrievanceCase } from "@/lib/mock/types"

interface AdminNavRailProps {
  cases: GrievanceCase[]
}

/**
 * Left nav rail for the CSR console. `?q=` search writes back via
 * `router.replace` on every keystroke — free at this data volume, but not a
 * pattern to copy into a real search backend without debouncing.
 */
export function AdminNavRail({ cases }: AdminNavRailProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()

  const view = searchParams.get("view")
  const channel = searchParams.get("channel")
  const query = searchParams.get("q") ?? ""

  const onConversations = pathname.startsWith("/admin/conversations")
  const viewCounts = countByView(cases)
  const channelCounts = countByChannel(cases)

  function isViewActive(target: string | null) {
    return onConversations && (view ?? "all") === (target ?? "all") && !channel
  }

  function isChannelActive(target: string) {
    return onConversations && channel === target
  }

  function handleSearchChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set("q", value)
    else params.delete("q")
    const qs = params.toString()
    router.replace(`/admin/conversations${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  return (
    <aside className="flex w-70 min-w-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-[13px] font-semibold text-primary">
          A
        </span>
        <span className="truncate text-[15px] font-medium text-sidebar-foreground">
          CSR Console
        </span>
      </div>

      <div className="shrink-0 px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search..."
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 w-full min-w-0 flex-1 px-3 py-3">
        <nav className="flex flex-col gap-1">
          <AdminNavGroup label="Conversations" icon={MessagesSquare} level={0}>
            <AdminNavLink
              href={buildConversationsHref({ view: "all" })}
              label="All Conversations"
              isActive={isViewActive("all")}
              count={viewCounts.all}
            />
            <AdminNavLink
              href={buildConversationsHref({ view: "mentions" })}
              label="Mentions"
              isActive={isViewActive("mentions")}
              count={viewCounts.mentions}
            />
            <AdminNavLink
              href={buildConversationsHref({ view: "participating" })}
              label="Participating"
              isActive={isViewActive("participating")}
              count={viewCounts.participating}
            />
            <AdminNavLink
              href={buildConversationsHref({ view: "unattended" })}
              label="Unattended"
              isActive={isViewActive("unattended")}
              count={viewCounts.unattended}
            />

            <AdminNavGroup label="Channels" icon={LayoutList} level={1}>
              {channelOrder.map((c) => (
                <AdminNavLink
                  key={c}
                  href={buildConversationsHref({ channel: c })}
                  label={channelMeta[c].label}
                  icon={channelMeta[c].icon}
                  isActive={isChannelActive(c)}
                  count={channelCounts[c]}
                  level={2}
                />
              ))}
            </AdminNavGroup>
          </AdminNavGroup>

          <AdminNavGroup label="Reports" icon={BarChart3} level={0} defaultOpen={false}>
            <AdminNavLink
              href="/admin/reports/dashboard"
              label="Dashboard"
              isActive={pathname === "/admin/reports/dashboard"}
            />
            <AdminNavLink
              href="/admin/reports/grievances"
              label="Grievance Queue"
              isActive={pathname === "/admin/reports/grievances"}
            />
          </AdminNavGroup>
        </nav>
      </ScrollArea>

      <div className="flex shrink-0 items-center gap-2 border-t border-sidebar-border px-3 py-3">
        <UserButton />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-sidebar-foreground">
            {user?.fullName ?? "Signed in"}
          </p>
          <p className="truncate text-[12px] text-sidebar-foreground/60">
            {user?.primaryEmailAddress?.emailAddress ?? ""}
          </p>
        </div>
      </div>
    </aside>
  )
}
