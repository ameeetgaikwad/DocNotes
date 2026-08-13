import { z } from "zod";

// Manoj msg 2595: Personal insight notes — title optional, body
// required. Body cap generous (10k chars) so long-form observations
// or reading notes are safe.
export const upsertInsightNoteSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  body: z
    .string()
    .trim()
    .min(1, "Note is required")
    .max(10000, "Note must be 10,000 characters or fewer"),
});

export type UpsertInsightNote = z.infer<typeof upsertInsightNoteSchema>;
