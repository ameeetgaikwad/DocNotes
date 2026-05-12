import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { patients } from "./patients.js";
import { users } from "./users.js";

export const dailyRegisterEntries = pgTable(
  "daily_register_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    visitDate: date("visit_date").notNull(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    serviceType: varchar("service_type", { length: 64 }),
    feeAmount: numeric("fee_amount", { precision: 10, scale: 2 }).notNull(),
    paymentMode: varchar("payment_mode", { length: 16 }).notNull(),
    paymentStatus: varchar("payment_status", { length: 16 })
      .notNull()
      .default("paid"),
    feeReceivedAt: date("fee_received_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("daily_register_provider_idx").on(table.providerId),
    index("daily_register_visit_date_idx").on(table.visitDate),
    index("daily_register_provider_date_idx").on(
      table.providerId,
      table.visitDate,
    ),
    index("daily_register_patient_idx").on(table.patientId),
  ],
);
