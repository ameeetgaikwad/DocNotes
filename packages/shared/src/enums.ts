import { z } from "zod";

export const UserRole = z.enum(["gp", "nurse", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export const AppointmentStatus = z.enum([
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

export const AppointmentType = z.enum([
  "new_patient",
  "follow_up",
  "routine",
  "urgent",
  "telehealth",
]);
export type AppointmentType = z.infer<typeof AppointmentType>;

export const RecordType = z.enum([
  "visit_note",
  "lab_result",
  "prescription",
  "referral",
  "procedure",
  "imaging",
  "document",
]);
export type RecordType = z.infer<typeof RecordType>;

export const AllergySeverity = z.enum(["mild", "moderate", "severe"]);
export type AllergySeverity = z.infer<typeof AllergySeverity>;

export const Gender = z.enum(["male", "female", "other", "prefer_not_to_say"]);
export type Gender = z.infer<typeof Gender>;

export const AuditAction = z.enum([
  "create",
  "read",
  "update",
  "delete",
  "login",
  "logout",
  "export",
  "share",
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const AuditResource = z.enum([
  "patient",
  "medical_record",
  "appointment",
  "user",
  "session",
  "export",
]);
export type AuditResource = z.infer<typeof AuditResource>;
