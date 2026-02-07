import { z } from "zod";
import { ShareResourceType } from "../enums.js";

export const shareLinkSchema = z.object({
  id: z.string().uuid(),
  resourceType: ShareResourceType,
  resourceId: z.string().uuid(),
  token: z.string(),
  expiresAt: z.coerce.date(),
  hasPassword: z.boolean(),
  accessCount: z.number().int().nonnegative(),
  maxAccesses: z.number().int().positive().nullable(),
  isRevoked: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export type ShareLink = z.infer<typeof shareLinkSchema>;

export const createShareLinkSchema = z.object({
  resourceType: ShareResourceType,
  resourceId: z.string().uuid(),
  expiresInHours: z.number().int().positive().max(720).default(72), // max 30 days
  password: z.string().min(4).max(128).optional(),
  maxAccesses: z.number().int().positive().max(100).nullable().optional(),
});

export type CreateShareLink = z.infer<typeof createShareLinkSchema>;

export const accessShareLinkSchema = z.object({
  token: z.string().min(1),
  password: z.string().optional(),
});

export type AccessShareLink = z.infer<typeof accessShareLinkSchema>;
