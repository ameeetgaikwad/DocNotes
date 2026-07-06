import { z } from "zod";

// In-app feedback form (Manoj msg 2128). Reused by a Google Play
// reviewer to confirm the app has an active user-developer feedback
// channel. Persisted to audit_logs (metadata jsonb) so v1 needs no
// schema migration; a dedicated feedback table can land later once
// volume justifies it.

// Rough upper bound to keep the JSONB row small and the wire payload
// snappy. Base64-encoded JPEG at 1200px wide/q=0.7 typically lands
// under 400 KB, so ~800 KB gives generous headroom.
const MAX_SCREENSHOT_LENGTH = 900_000;

export const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(1).max(2000),
  // Optional inline screenshot. Client compresses on-device before
  // sending — see the /feedback page. Must be a data URL so the
  // backend can round-trip it to an <img> without extra plumbing.
  screenshotDataUrl: z
    .string()
    .startsWith("data:image/")
    .max(MAX_SCREENSHOT_LENGTH)
    .optional(),
  // Client hints — the reviewer / Amit can use these to reproduce
  // whatever page the reporter was on.
  path: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
