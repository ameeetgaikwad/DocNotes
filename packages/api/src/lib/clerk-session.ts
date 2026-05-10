import { createClerkClient, verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { users, type Database } from "@docnotes/db";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY ?? "",
});

/**
 * Verify a Clerk-issued session JWT and resolve it to a local user row.
 * Lazy-creates the local users record (with default role "gp") the first
 * time a Clerk user appears, so other tables that FK to users.id keep
 * working without a webhook sync.
 */
export async function resolveClerkSession(
  db: Database,
  token: string,
): Promise<{ userId: string; role: string } | null> {
  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? "",
    });
  } catch {
    return null;
  }

  const clerkUserId = payload.sub;
  if (!clerkUserId) return null;

  const existing = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, clerkUserId))
    .limit(1);

  if (existing[0]) {
    return { userId: existing[0].id, role: existing[0].role };
  }

  await db
    .insert(users)
    .values({ id: clerkUserId, role: "gp" })
    .onConflictDoNothing();

  return { userId: clerkUserId, role: "gp" };
}

export { clerk };
