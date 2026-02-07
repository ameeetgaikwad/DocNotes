import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { users, sessions, type Database } from "@docnotes/db";
import { publicProcedure, protectedProcedure, router } from "../trpc.js";

function generateToken(): string {
  return randomBytes(48).toString("hex");
}

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).max(128),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists
      const existing = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);

      const [user] = await ctx.db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          hashedPassword,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await ctx.db.insert(sessions).values({
        userId: user!.id,
        token,
        expiresAt,
        ipAddress: ctx.req?.ip ?? null,
        userAgent: (ctx.req?.headers?.["user-agent"] as string) ?? null,
      });

      return { user: user!, token, expiresAt };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      if (!user.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account is deactivated",
        });
      }

      const valid = await bcrypt.compare(input.password, user.hashedPassword);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      // Create session
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await ctx.db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt,
        ipAddress: ctx.req?.ip ?? null,
        userAgent: (ctx.req?.headers?.["user-agent"] as string) ?? null,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        expiresAt,
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Delete all sessions for the user (or just the current one)
    // For now, delete all sessions to force re-login on all devices
    await ctx.db
      .delete(sessions)
      .where(eq(sessions.userId, ctx.session.userId));

    return { success: true };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) {
      return null;
    }

    const [user] = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, ctx.session.userId))
      .limit(1);

    return user ?? null;
  }),
});

/**
 * Resolve a bearer token to a session. Used by the tRPC context middleware.
 */
export async function resolveSession(
  db: Database,
  token: string,
): Promise<{ userId: string; role: string } | null> {
  const now = new Date();

  const result = await db
    .select({
      userId: sessions.userId,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .limit(1);

  return result[0] ?? null;
}
