import { router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { dashboardRouter } from "./dashboard.js";
import { patientRouter } from "./patient.js";
import { medicalRecordRouter } from "./medical-record.js";
import { appointmentRouter } from "./appointment.js";
import { auditRouter } from "./audit.js";
import { documentRouter } from "./document.js";
import { exportRouter } from "./export.js";
import { shareRouter } from "./share.js";

export const appRouter = router({
  auth: authRouter,
  dashboard: dashboardRouter,
  patient: patientRouter,
  medicalRecord: medicalRecordRouter,
  appointment: appointmentRouter,
  audit: auditRouter,
  document: documentRouter,
  export: exportRouter,
  share: shareRouter,
});

export type AppRouter = typeof appRouter;
