import type { CaseChannel, GrievanceCase, Severity } from "@/lib/mock/types"

export type ConversationView = "all" | "mentions" | "participating" | "unattended"
export type AssignmentTab = "mine" | "unassigned" | "all"
export type ConversationSort = "priority" | "latest"

export interface ConversationFilters {
  view: ConversationView
  channel: CaseChannel | null
  assignment: AssignmentTab
  query: string
}

const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

export const viewLabel: Record<ConversationView, string> = {
  all: "All Conversations",
  mentions: "Mentions",
  participating: "Participating",
  unattended: "Unattended",
}

function isConversationView(value: string | null): value is ConversationView {
  return value === "all" || value === "mentions" || value === "participating" || value === "unattended"
}

function isAssignmentTab(value: string | null): value is AssignmentTab {
  return value === "mine" || value === "unassigned" || value === "all"
}

function isCaseChannel(value: string | null): value is CaseChannel {
  return value === "amex_support" || value === "social" || value === "website_chatbot"
}

export function parseConversationFilters(params: URLSearchParams): ConversationFilters {
  return {
    view: isConversationView(params.get("view")) ? (params.get("view") as ConversationView) : "all",
    channel: isCaseChannel(params.get("channel")) ? (params.get("channel") as CaseChannel) : null,
    assignment: isAssignmentTab(params.get("assignment")) ? (params.get("assignment") as AssignmentTab) : "all",
    query: params.get("q") ?? "",
  }
}

export function buildConversationsHref(filters: Partial<ConversationFilters>, caseId?: string): string {
  const params = new URLSearchParams()
  if (filters.view && filters.view !== "all") params.set("view", filters.view)
  if (filters.channel) params.set("channel", filters.channel)
  if (filters.assignment && filters.assignment !== "all") params.set("assignment", filters.assignment)
  if (filters.query) params.set("q", filters.query)

  const base = caseId ? `/admin/conversations/${caseId}` : "/admin/conversations"
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

function matchesView(grievanceCase: GrievanceCase, view: ConversationView): boolean {
  switch (view) {
    case "all":
      return true
    case "mentions":
      // No backing data yet — intentional empty state.
      return false
    case "participating":
      return grievanceCase.contactedByCsrName !== null
    case "unattended":
      return grievanceCase.replyState === "needs_reply"
  }
}

function matchesAssignment(
  grievanceCase: GrievanceCase,
  assignment: AssignmentTab,
  currentCsrName: string
): boolean {
  switch (assignment) {
    case "all":
      return true
    case "mine":
      return grievanceCase.contactedByCsrName === currentCsrName
    case "unassigned":
      return grievanceCase.contactedByCsrName === null
  }
}

function matchesQuery(grievanceCase: GrievanceCase, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  return (
    grievanceCase.summary.toLowerCase().includes(trimmed) ||
    grievanceCase.customerName.toLowerCase().includes(trimmed)
  )
}

export function filterCases(
  cases: GrievanceCase[],
  filters: ConversationFilters,
  currentCsrName: string
): GrievanceCase[] {
  return cases.filter(
    (c) =>
      matchesView(c, filters.view) &&
      (filters.channel === null || c.channel === filters.channel) &&
      matchesAssignment(c, filters.assignment, currentCsrName) &&
      matchesQuery(c, filters.query)
  )
}

/** Priority band (current severity) first, then oldest-first within band — the queue's original ordering, now the single definition. */
export function sortCases(cases: GrievanceCase[], sort: ConversationSort = "priority"): GrievanceCase[] {
  const sorted = [...cases]
  if (sort === "priority") {
    sorted.sort((a, b) => {
      const severityDiff = severityRank[a.currentSeverity] - severityRank[b.currentSeverity]
      if (severityDiff !== 0) return severityDiff
      return a.createdAt.localeCompare(b.createdAt)
    })
  } else {
    sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return sorted
}

export function countByView(cases: GrievanceCase[]): Record<ConversationView, number> {
  return {
    all: cases.length,
    mentions: cases.filter((c) => matchesView(c, "mentions")).length,
    participating: cases.filter((c) => matchesView(c, "participating")).length,
    unattended: cases.filter((c) => matchesView(c, "unattended")).length,
  }
}

export function countByChannel(cases: GrievanceCase[]): Record<CaseChannel, number> {
  return {
    amex_support: cases.filter((c) => c.channel === "amex_support").length,
    social: cases.filter((c) => c.channel === "social").length,
    website_chatbot: cases.filter((c) => c.channel === "website_chatbot").length,
  }
}

/** Counts reflect the view/channel/query filters but not the assignment filter itself, so switching tabs doesn't move the other tabs' counts. */
export function countByAssignment(
  cases: GrievanceCase[],
  filters: ConversationFilters,
  currentCsrName: string
): Record<AssignmentTab, number> {
  const base = cases.filter(
    (c) =>
      matchesView(c, filters.view) &&
      (filters.channel === null || c.channel === filters.channel) &&
      matchesQuery(c, filters.query)
  )
  return {
    mine: base.filter((c) => matchesAssignment(c, "mine", currentCsrName)).length,
    unassigned: base.filter((c) => matchesAssignment(c, "unassigned", currentCsrName)).length,
    all: base.length,
  }
}
