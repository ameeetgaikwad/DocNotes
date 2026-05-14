import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const trimmedRequired = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const mobileRegex = /^(?:\+?91[-\s]?)?[6-9]\d{9}$/;

export const doctorProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  fullName: z.string(),
  dateOfBirth: z.string().nullable(),
  qualification: z.string(),
  specialization: z.string().nullable(),
  clinicName: z.string(),
  taluka: z.string(),
  district: z.string(),
  state: z.string(),
  mobileNumber: z.string(),
  email: z.string().nullable(),
  registrationNumber: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DoctorProfile = z.infer<typeof doctorProfileSchema>;

export const upsertDoctorProfileSchema = z.object({
  fullName: trimmedRequired("Full name", 200),
  dateOfBirth: isoDate.nullable().optional(),
  qualification: trimmedRequired("Qualification", 120),
  specialization: z
    .string()
    .trim()
    .max(120, "Specialization must be 120 characters or fewer")
    .nullable()
    .optional(),
  clinicName: trimmedRequired("Clinic / Hospital name", 200),
  taluka: trimmedRequired("Taluka", 120),
  district: trimmedRequired("District", 120),
  state: trimmedRequired("State", 120),
  mobileNumber: z
    .string()
    .trim()
    .regex(mobileRegex, "Enter a 10-digit Indian mobile number"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(254)
    .nullable()
    .optional(),
  registrationNumber: trimmedRequired("Registration number", 80),
});

export type UpsertDoctorProfile = z.infer<typeof upsertDoctorProfileSchema>;
