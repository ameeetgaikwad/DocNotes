import { eq } from "drizzle-orm";
import { doctorProfiles } from "@docnotes/db";
import { upsertDoctorProfileSchema } from "@docnotes/shared";
import { protectedProcedure, router } from "../trpc.js";
import { logAudit } from "../lib/audit.js";

export const doctorProfileRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(doctorProfiles)
      .where(eq(doctorProfiles.userId, ctx.session.userId))
      .limit(1);
    return rows[0] ?? null;
  }),

  upsert: protectedProcedure
    .input(upsertDoctorProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: doctorProfiles.id })
        .from(doctorProfiles)
        .where(eq(doctorProfiles.userId, ctx.session.userId))
        .limit(1);

      const values = {
        fullName: input.fullName.trim(),
        dateOfBirth: input.dateOfBirth ?? null,
        qualification: input.qualification.trim(),
        specialization: input.specialization?.trim()
          ? input.specialization.trim()
          : null,
        clinicName: input.clinicName.trim(),
        taluka: input.taluka.trim(),
        district: input.district.trim(),
        state: input.state.trim(),
        mobileNumber: input.mobileNumber.trim(),
        email: input.email?.trim() ? input.email.trim() : null,
        registrationNumber: input.registrationNumber.trim(),
      };

      if (existing[0]) {
        const [updated] = await ctx.db
          .update(doctorProfiles)
          .set(values)
          .where(eq(doctorProfiles.userId, ctx.session.userId))
          .returning();
        if (updated) {
          logAudit(ctx, {
            action: "update",
            resource: "doctor_profile",
            resourceId: updated.id,
          });
        }
        return updated ?? null;
      }

      const [created] = await ctx.db
        .insert(doctorProfiles)
        .values({ userId: ctx.session.userId, ...values })
        .returning();
      if (created) {
        logAudit(ctx, {
          action: "create",
          resource: "doctor_profile",
          resourceId: created.id,
        });
      }
      return created ?? null;
    }),
});
