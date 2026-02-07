import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { patientRouter } from "./patient.js";
import { medicalRecordRouter } from "./medical-record.js";
import { appointmentRouter } from "./appointment.js";
import { auditRouter } from "./audit.js";

export const appRouter = router({
  auth: authRouter,
  patient: patientRouter,
  medicalRecord: medicalRecordRouter,
  appointment: appointmentRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;
