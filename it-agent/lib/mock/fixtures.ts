import type {
  ActivityEvent,
  ChatMessage,
  DashboardMetrics,
  GrievanceCase,
  Ticket,
} from "./types"

// --- Customer dashboard: tickets across the 3 supported intents ---

export const tickets: Ticket[] = [
  {
    id: "tkt_1",
    intent: "card_unblock_activation",
    title: "Card unblock — ending 4821",
    priority: "high",
    status: "resolved",
    createdAt: "2026-08-22T09:12:00Z",
    updatedAt: "2026-08-22T09:18:00Z",
  },
  {
    id: "tkt_2",
    intent: "card_unblock_activation",
    title: "Activate new card — ending 0093",
    priority: "medium",
    status: "open",
    createdAt: "2026-08-23T07:40:00Z",
    updatedAt: "2026-08-23T07:40:00Z",
  },
  {
    id: "tkt_3",
    intent: "unrecognized_transaction",
    title: "Unrecognized charge — $214.50 at MERCH#5521",
    priority: "high",
    status: "in_progress",
    createdAt: "2026-08-21T16:05:00Z",
    updatedAt: "2026-08-23T08:02:00Z",
  },
  {
    id: "tkt_4",
    intent: "unrecognized_transaction",
    title: "Duplicate charge — $58.00 posted twice",
    priority: "medium",
    status: "escalated",
    createdAt: "2026-08-20T11:30:00Z",
    updatedAt: "2026-08-22T14:15:00Z",
    escalatedAt: "2026-08-22T14:15:00Z",
    escalationReason:
      "The agent closed this twice but the second charge is still on my statement.",
  },
  {
    id: "tkt_5",
    intent: "update_contact_info",
    title: "Update phone number on file",
    priority: "medium",
    status: "resolved",
    createdAt: "2026-08-19T13:00:00Z",
    updatedAt: "2026-08-19T13:04:00Z",
  },
  {
    id: "tkt_6",
    intent: "update_contact_info",
    title: "Update email address on file",
    priority: "low",
    status: "open",
    createdAt: "2026-08-23T06:55:00Z",
    updatedAt: "2026-08-23T06:55:00Z",
  },
]

// --- Customer dashboard: chat thread for the in-progress ticket (tkt_3) ---

const tkt3ActivityEvents: ActivityEvent[] = [
  {
    id: "act_1",
    stage: "Intent classification",
    status: "ok",
    detail: 'intent="unrecognized_transaction" priority="high"',
    timestamp: "2026-08-23T08:00:10Z",
  },
  {
    id: "act_2",
    stage: "Customer authentication",
    status: "ok",
    detail: "session verified",
    timestamp: "2026-08-23T08:00:14Z",
  },
  {
    id: "act_3",
    stage: "Freeze card",
    status: "running",
    detail: 'tool="card.freeze" card="...4821"',
    timestamp: "2026-08-23T08:02:00Z",
  },
]

export const chatMessages: ChatMessage[] = [
  {
    id: "msg_1",
    ticketId: "tkt_3",
    authorRole: "customer",
    authorName: "You",
    content:
      "I don't recognize a $214.50 charge from MERCH#5521 on my statement.",
    timestamp: "2026-08-21T16:05:00Z",
  },
  {
    id: "msg_2",
    ticketId: "tkt_3",
    authorRole: "agent",
    authorName: "Servicing Agent",
    content:
      "Thanks for flagging this. I've opened a dispute and I'm verifying your account now.",
    timestamp: "2026-08-21T16:05:40Z",
    activityEvents: tkt3ActivityEvents.slice(0, 2),
  },
  {
    id: "msg_3",
    ticketId: "tkt_3",
    authorRole: "customer",
    authorName: "You",
    content: "Can you freeze the card while this is investigated?",
    timestamp: "2026-08-23T08:01:30Z",
  },
  {
    id: "msg_4",
    ticketId: "tkt_3",
    authorRole: "agent",
    authorName: "Servicing Agent",
    content: "Freezing your card now.",
    timestamp: "2026-08-23T08:02:00Z",
    activityEvents: [tkt3ActivityEvents[2]],
  },
]

// --- Admin dashboard: grievance cases, mixed chat + social channels ---

export const grievanceCases: GrievanceCase[] = [
  {
    id: "case_1",
    channel: "social",
    customerName: "Dana Marcus",
    customerHandle: "@danamarcus",
    summary: "Public post: card frozen for a week with no explanation",
    currentSeverity: "high",
    severityChangedRecently: true,
    createdAt: "2026-08-18T10:00:00Z",
    escalatedAt: "2026-08-20T10:00:00Z",
    customerStatus: "closed",
    customerVerified: false,
    contactedByCsrName: null,
    replyState: "needs_reply",
    originalPostUrl: "https://twitter.com/example/status/1",
    classification: { intent: "card_unblock_activation", confidence: 0.91 },
    dedupePosts: [
      {
        id: "post_1a",
        permalink: "https://twitter.com/example/status/1",
        excerpt: "Card's been frozen a week, nobody will help me.",
        postedAt: "2026-08-18T10:00:00Z",
      },
      {
        id: "post_1b",
        permalink: "https://twitter.com/example/status/2",
        excerpt: "Still nothing from @AmexSupport. Closing my account.",
        postedAt: "2026-08-19T09:30:00Z",
      },
    ],
    severityHistory: [
      {
        id: "sev_1a",
        from: "medium",
        to: "high",
        changedAt: "2026-08-19T09:35:00Z",
        reason: "Customer threatened account closure in repeat post",
      },
    ],
    toolCallLog: [
      {
        id: "act_case1_1",
        stage: "Channel triage",
        status: "ok",
        detail: 'source="social" dedupe_key="handle+issue"',
        timestamp: "2026-08-18T10:01:00Z",
      },
      {
        id: "act_case1_2",
        stage: "Card unblock",
        status: "denied",
        detail: "no authenticated session — cannot execute servicing tool",
        timestamp: "2026-08-18T10:01:05Z",
      },
    ],
    aiDraftReply:
      "Thanks for reaching out — we'd like to help resolve this. Please check your DMs so we can verify your account on a secure channel.",
  },
  {
    id: "case_2",
    channel: "amex_support",
    customerName: "Priya Nair",
    summary: "Escalated: verification failed on duplicate-charge dispute",
    currentSeverity: "medium",
    severityChangedRecently: false,
    createdAt: "2026-08-20T11:30:00Z",
    escalatedAt: "2026-08-22T14:15:00Z",
    customerStatus: "active",
    customerVerified: true,
    contactedByCsrName: "J. Alvarez",
    replyState: "escalated",
    classification: { intent: "unrecognized_transaction", confidence: 0.87 },
    dedupePosts: [],
    severityHistory: [],
    toolCallLog: [
      {
        id: "act_case2_1",
        stage: "Intent classification",
        status: "ok",
        detail: 'intent="unrecognized_transaction" priority="medium"',
        timestamp: "2026-08-20T11:30:20Z",
      },
      {
        id: "act_case2_2",
        stage: "Resolution verification",
        status: "failed",
        detail: "duplicate-charge reversal could not be independently confirmed",
        timestamp: "2026-08-22T14:14:50Z",
      },
    ],
  },
  {
    id: "case_3",
    channel: "social",
    customerName: "Alex Whitfield",
    customerHandle: "@awhitfield",
    summary: "Public post: unable to reach anyone about a duplicate charge",
    currentSeverity: "low",
    severityChangedRecently: false,
    createdAt: "2026-08-23T06:10:00Z",
    escalatedAt: null,
    customerStatus: "unknown",
    customerVerified: false,
    contactedByCsrName: null,
    replyState: "draft_ready",
    originalPostUrl: "https://twitter.com/example/status/3",
    classification: { intent: "unrecognized_transaction", confidence: 0.62 },
    dedupePosts: [
      {
        id: "post_3a",
        permalink: "https://twitter.com/example/status/3",
        excerpt: "Charged twice for the same order, can't get through to anyone.",
        postedAt: "2026-08-23T06:10:00Z",
      },
    ],
    severityHistory: [],
    toolCallLog: [
      {
        id: "act_case3_1",
        stage: "Channel triage",
        status: "ok",
        detail: 'source="social" customer_link="unresolved"',
        timestamp: "2026-08-23T06:11:00Z",
      },
    ],
    aiDraftReply:
      "We're sorry for the trouble — please check your DMs so we can look into this on a secure channel.",
  },
  {
    id: "case_4",
    channel: "website_chatbot",
    customerName: "Marcus Hale",
    summary: "Escalated: customer disputes card-activation failure",
    currentSeverity: "medium",
    severityChangedRecently: false,
    createdAt: "2026-08-17T08:00:00Z",
    escalatedAt: "2026-08-17T20:00:00Z",
    customerStatus: "active",
    customerVerified: true,
    contactedByCsrName: "R. Chen",
    replyState: "replied",
    classification: { intent: "card_unblock_activation", confidence: 0.95 },
    dedupePosts: [],
    severityHistory: [
      {
        id: "sev_4a",
        from: "low",
        to: "medium",
        changedAt: "2026-08-17T20:00:00Z",
        reason: "Escalated after failed verification, repeat contact",
      },
    ],
    toolCallLog: [
      {
        id: "act_case4_1",
        stage: "Card activation",
        status: "ok",
        detail: 'tool="card.activate" card="...0093"',
        timestamp: "2026-08-17T08:05:00Z",
      },
      {
        id: "act_case4_2",
        stage: "Resolution verification",
        status: "failed",
        detail: "activation status still shows inactive on re-check",
        timestamp: "2026-08-17T19:58:00Z",
      },
    ],
  },
]

// --- Admin dashboard: rollup metrics (matches the 4 S8 tiles) ---

export const dashboardMetrics: DashboardMetrics = {
  openBySeverity: { high: 1, medium: 2, low: 1 },
  oldestUnansweredCaseId: "case_1",
  oldestUnansweredAgeHours: 125,
  escalationsPastThreshold: 2,
  closedAccountOpenGrievanceCount: 1,
}
