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

/**
 * The signed-in CSR's display name, for stamping `contactedByCsrName` and
 * message authorship. Replaces the old hardcoded `lib/mock/current-csr.ts`
 * constant — no CSR identity table exists in the schema, so this reads
 * straight from the Clerk profile (same pattern as `resolveCustomer()`).
 */
export async function requireCsrName() {
  await requireCSR();
  const profile = await currentUser();
  return profile?.fullName ?? profile?.primaryEmailAddress?.emailAddress ?? "CSR";
}
