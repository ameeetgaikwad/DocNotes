import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

// Chemists / pharmacy contacts (Manoj msg 2267). Doctors save the
// WhatsApp numbers of chemists they regularly send prescriptions to,
// then one-tap Send-to-Chemist from the Rx page opens WhatsApp with
// the Rx text pre-filled. Structure mirrors medicine_dealers — hard
// delete on remove (Manoj msg 2300), no soft-delete column.
export const chemists = pgTable(
  "chemists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 200 }).notNull(),
    // WhatsApp numbers are E.164-ish: optional +, up to 15 digits. We
    // keep it as a string with generous room so the client can accept
    // "9850234103", "+919850234103", or "91 9850234103" and normalise
    // to digits-only before building the wa.me URL.
    whatsappNumber: varchar("whatsapp_number", { length: 32 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("chemists_provider_idx").on(table.providerId)],
);

export type Chemist = typeof chemists.$inferSelect;
export type NewChemist = typeof chemists.$inferInsert;
