import { auditLogs } from "@docnotes/db";
import { submitFeedbackSchema } from "@docnotes/shared";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";

// In-app feedback (Manoj msg 2128). v1 persists to audit_logs so we
// skip a migration; the metadata jsonb column carries rating +
// message + optional screenshot + client hints. Also logs to stdout
// so `docker logs` surfaces new feedback in real time — the reviewer
// can see it land even before a dedicated admin view exists.

function truncateForLog(s: string | undefined, n = 200): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…(${s.length}b)` : s;
}

export const feedbackRouter = router({
  submit: protectedProcedure
    .input(submitFeedbackSchema)
    .mutation(async ({ ctx, input }) => {
      const ipAddress = (ctx.req?.ip as string | undefined) ?? null;
      const uaFromReq =
        (ctx.req?.headers?.["user-agent"] as string | undefined) ?? null;

      try {
        await ctx.db.insert(auditLogs).values({
          userId: ctx.session.userId,
          action: "user_feedback",
          resource: "app",
          ipAddress,
          userAgent: uaFromReq,
          metadata: {
            rating: input.rating,
            message: input.message,
            path: input.path ?? null,
            userAgent: input.userAgent ?? null,
            hasScreenshot: !!input.screenshotDataUrl,
            // Keep the screenshot bytes in the row so the reviewer can
            // pull it back later; base64 in JSONB is heavy but bounded
            // by the shared schema's size cap.
            screenshotDataUrl: input.screenshotDataUrl ?? null,
          },
        });
      } catch (err) {
        // Bubble up so the form can show an error state — the whole
        // point of the feedback feature is being able to reach the
        // developer, so a silent failure would be worse than nothing.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not save feedback. Please try again.",
          cause: err,
        });
      }

      // stdout: shows up in `docker logs backend-staging` / prod.
      // Amit can tail this for immediate awareness while an admin
      // view is not yet built.

      console.log(
        `[feedback] user=${ctx.session.userId} rating=${input.rating} ` +
          `path=${input.path ?? "-"} ` +
          `screenshot=${input.screenshotDataUrl ? "yes" : "no"} ` +
          `msg="${truncateForLog(input.message)}"`,
      );

      return { ok: true as const };
    }),
});
