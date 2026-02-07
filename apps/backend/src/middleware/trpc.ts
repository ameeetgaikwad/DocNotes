import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, resolveSession, type Context } from "@docnotes/api";
import { db } from "@docnotes/db";

export const trpcMiddleware = createExpressMiddleware({
  router: appRouter,
  createContext: async ({ req }): Promise<Context> => {
    let session: Context["session"] = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      session = await resolveSession(db, token);
    }

    return {
      db,
      session,
      req: {
        ip: req.ip,
        headers: req.headers as Record<string, string | string[] | undefined>,
      },
    };
  },
});
