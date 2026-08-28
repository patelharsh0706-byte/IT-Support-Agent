import { tool } from "ai"
import { z } from "zod"

import { getCustomerProfile, updateCustomerEmail } from "@/lib/sqlite/queries"
import type { MutationRecorder } from "./mutations"

/**
 * Account & Profile tools. Same trust boundary as `cards.ts`: no schema
 * accepts a customer id, and `execute` closes over the session-resolved one.
 *
 * Phone number is deliberately absent — `customers` has no phone column yet,
 * so `update_phone` classifies and then escalates rather than pretending.
 */

export function createProfileTools(customerId: string, record: MutationRecorder = () => {}) {
  return {
    get_profile: tool({
      description: "Read the signed-in customer's current contact details.",
      inputSchema: z.object({}),
      execute: async () => {
        const profile = await getCustomerProfile(customerId)
        return profile ? { email: profile.email, name: profile.name } : { error: "No profile found." }
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
  }
}

/** Independent read-only verifier — see the note in `cards.ts`. */
export async function verifyEmail(customerId: string, expected: string) {
  const profile = await getCustomerProfile(customerId)
  const observed = profile?.email ?? null
  return {
    matched: observed?.toLowerCase() === expected.trim().toLowerCase(),
    observed,
    expected,
  }
}
