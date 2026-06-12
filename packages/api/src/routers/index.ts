import { router } from "../trpc.js";
import { dashboardRouter } from "./dashboard.js";
import { patientRouter } from "./patient.js";
import { medicalRecordRouter } from "./medical-record.js";
import { appointmentRouter } from "./appointment.js";
import { auditRouter } from "./audit.js";
import { documentRouter } from "./document.js";
import { exportRouter } from "./export.js";
import { shareRouter } from "./share.js";
import { dailyRegisterRouter } from "./daily-register.js";
import { patientVisitRouter } from "./patient-visit.js";
import { doctorProfileRouter } from "./doctor-profile.js";
import { medicineDealerRouter } from "./medicine-dealer.js";
import { purchaseItemRouter } from "./purchase-item.js";
import { homeopathicMedicineRouter } from "./homeopathic-medicine.js";
import { clinicExpenseRouter } from "./clinic-expense.js";
import { homeVisitRouter } from "./home-visit.js";
import { customTodoRouter } from "./custom-todo.js";

export const appRouter = router({
  dashboard: dashboardRouter,
  patient: patientRouter,
  medicalRecord: medicalRecordRouter,
  appointment: appointmentRouter,
  audit: auditRouter,
  document: documentRouter,
  export: exportRouter,
  share: shareRouter,
  dailyRegister: dailyRegisterRouter,
  patientVisit: patientVisitRouter,
  doctorProfile: doctorProfileRouter,
  medicineDealer: medicineDealerRouter,
  purchaseItem: purchaseItemRouter,
  homeopathicMedicine: homeopathicMedicineRouter,
  clinicExpense: clinicExpenseRouter,
  homeVisit: homeVisitRouter,
  customTodo: customTodoRouter,
});

export type AppRouter = typeof appRouter;
