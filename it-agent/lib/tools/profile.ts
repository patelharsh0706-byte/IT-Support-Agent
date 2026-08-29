import { tool } from "ai"
import { z } from "zod"

import {
  getCustomerProfile,
  updateCustomerEmail,
  updateCustomerPhone,
} from "@/lib/sqlite/queries"
import type { MutationRecorder } from "./mutations"

/**
 * Account & Profile tools. Same trust boundary as `cards.ts`: no schema
 * accepts a customer id, and `execute` closes over the session-resolved one.
 *
 */

export function createProfileTools(customerId: string, record: MutationRecorder = () => {}) {
  return {
    get_profile: tool({
      description: "Read the signed-in customer's current contact details.",
      inputSchema: z.object({}),
      execute: async () => {
        const profile = await getCustomerProfile(customerId)
        return profile
          ? { email: profile.email, phone: profile.phone ?? null, name: profile.name }
          : { error: "No profile found." }
      },
    }),

    update_email: tool({
      description: "Change the email address on the signed-in customer's account.",
      inputSchema: z.object({
        email: z.string().email("A valid email address"),
      }),
      execute: async ({ email }) => {
        const normalised = email.trim().toLowerCase()
        const current = await getCustomerProfile(customerId)
        if (current?.email.toLowerCase() === normalised) {
          return { ok: false as const, reason: "That is already the email on file." }
        }
        const updated = await updateCustomerEmail(customerId, normalised)
        if (updated) record({ kind: "email", expected: normalised })
        return { ok: updated !== null, email: updated?.email }
      },
    }),

    update_phone: tool({
      description: "Change the phone number on the signed-in customer's account.",
      inputSchema: z.object({
        // Loose on purpose: numbers arrive with spaces, dashes and country
        // codes, and rejecting a real number over formatting is worse than
        // storing it as the customer wrote it.
        phone: z
          .string()
          .min(7, "A phone number")
          .max(24)
          .regex(/^[+0-9][0-9\s().-]*$/, "Digits, spaces and + ( ) - . only"),
      }),
      execute: async ({ phone }) => {
        const normalised = phone.replace(/\s+/g, " ").trim()
        const current = await getCustomerProfile(customerId)
        if (current?.phone === normalised) {
          return { ok: false as const, reason: "That is already the number on file." }
        }
        const updated = await updateCustomerPhone(customerId, normalised)
        if (updated) record({ kind: "phone", expected: normalised })
        return { ok: updated !== null, phone: updated?.phone }
      },
    }),
  }
}

/** Independent read-only verifiers — see the note in `cards.ts`. */
export async function verifyPhone(customerId: string, expected: string) {
  const profile = await getCustomerProfile(customerId)
  return {
    matched: profile?.phone === expected,
    observed: profile?.phone ?? null,
    expected,
  }
}

export async function verifyEmail(customerId: string, expected: string) {
  const profile = await getCustomerProfile(customerId)
  const observed = profile?.email ?? null
  return {
    matched: observed?.toLowerCase() === expected.trim().toLowerCase(),
    observed,
    expected,
  }
}
