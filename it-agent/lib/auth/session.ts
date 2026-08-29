import { auth, currentUser } from "@clerk/nextjs/server";

type Role = "customer" | "csr";

function getRole(sessionClaims: Awaited<ReturnType<typeof auth>>["sessionClaims"]): Role {
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  return role === "csr" ? "csr" : "customer";
}

/**
 * Resolves the authenticated Clerk user. Throws when unauthenticated.
 *
 * Returns the Clerk user id and role only. To resolve the internal
 * `customer_id` (via `customers.clerk_user_id`), pass `clerkUserId` to
 * `resolveCustomer()` in `lib/sqlite/queries.ts`.
 */
export async function requireCustomer() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return { clerkUserId: userId, role: getRole(sessionClaims) };
}

/** Same as requireCustomer(), and throws when the session role is not "csr". */
export async function requireCSR() {
  const session = await requireCustomer();
  if (session.role !== "csr") {
    throw new Error("Forbidden: csr role required");
  }
  return session;
}

export interface CsrProfile {
  name: string;
  email: string;
}

/**
 * The signed-in CSR's display name and email. No CSR identity table exists in
 * the schema, so this reads straight from the Clerk profile (same pattern as
 * `resolveCustomer()`).
 *
 * Resolved on the server so the nav rail can render the identity as plain
 * props. `useUser()` returns nothing during SSR and the real user on the
 * client, which is a hydration mismatch by construction — and `code-standards.md`
 * asks for server-fetched data passed down regardless.
 */
export async function requireCsrProfile(): Promise<CsrProfile> {
  await requireCSR();
  const profile = await currentUser();
  const email = profile?.primaryEmailAddress?.emailAddress ?? "";
  // `||`, not `??`: Clerk returns an empty string for an unset name, which
  // `??` would happily pass through as the display name.
  return { name: profile?.fullName || email || "CSR", email };
}

/**
 * The signed-in CSR's display name, for stamping `contactedByCsrName` and
 * message authorship. Replaces the old hardcoded `lib/mock/current-csr.ts`
 * constant.
 */
export async function requireCsrName() {
  const { name } = await requireCsrProfile();
  return name;
}
