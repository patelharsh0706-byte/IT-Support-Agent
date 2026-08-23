import { Bot, CreditCard, Rss, type LucideIcon } from "lucide-react"

import type { CaseChannel } from "./types"

export interface ChannelMeta {
  label: string
  shortLabel: string
  icon: LucideIcon
}

/** Single source of truth for channel display — rail, list row, list header, conversation header, and the queue table all read from this. */
export const channelMeta: Record<CaseChannel, ChannelMeta> = {
  amex_support: {
    label: "AMEX customer support",
    shortLabel: "AMEX",
    icon: CreditCard,
  },
  social: {
    label: "Social media",
    shortLabel: "Social",
    icon: Rss,
  },
  website_chatbot: {
    label: "Chatbot support on website",
    shortLabel: "Website",
    icon: Bot,
  },
}

export const channelOrder: readonly CaseChannel[] = [
  "amex_support",
  "social",
  "website_chatbot",
]
