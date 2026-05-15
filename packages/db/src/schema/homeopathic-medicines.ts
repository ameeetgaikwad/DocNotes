import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const homeopathicMedicines = pgTable(
  "homeopathic_medicines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 200 }).notNull(),
    potency: varchar("potency", { length: 50 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("homeopathic_medicines_provider_idx").on(table.providerId)],
);

export type HomeopathicMedicine = typeof homeopathicMedicines.$inferSelect;
export type NewHomeopathicMedicine = typeof homeopathicMedicines.$inferInsert;
