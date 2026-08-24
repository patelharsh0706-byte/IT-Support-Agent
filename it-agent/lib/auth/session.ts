import { auth } from "@clerk/nextjs/server";

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
