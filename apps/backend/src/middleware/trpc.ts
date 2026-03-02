import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, resolveSession, type Context } from "@docnotes/api";
import { db } from "@docnotes/db";
import type { Context as HonoContext } from "hono";

export const trpcHandler = async (c: HonoContext) => {
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: async ({ req }: { req: Request }): Promise<Context> => {
      let session: Context["session"] = null;

      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        session = await resolveSession(db, token);
      }

      return {
        db,
        session,
        req: {
          ip:
            c.req.header("x-forwarded-for") ??
            c.req.header("x-real-ip") ??
            null,
          headers: Object.fromEntries(c.req.raw.headers.entries()),
        },
      };
    },
  });
};
