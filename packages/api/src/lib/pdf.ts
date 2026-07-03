import ReactPDF, { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

// renderToBuffer is a named export on @react-pdf/renderer@4.3.2 — the
// default-export object only carries renderToStream/renderToFile/etc.
// We import it directly above so this destructuring works regardless.
const { StyleSheet } = ReactPDF;

// Cast to any to avoid React 18/19 type mismatch with @react-pdf/renderer
/* eslint-disable @typescript-eslint/no-explicit-any */
const Document = ReactPDF.Document as any;
const Page = ReactPDF.Page as any;
const Text = ReactPDF.Text as any;
const View = ReactPDF.View as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 140,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  value: {
    flex: 1,
    color: "#1e293b",
  },
  badge: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    marginRight: 4,
    marginBottom: 3,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  soapSection: {
    marginBottom: 8,
  },
  soapLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    marginBottom: 2,
  },
  soapText: {
    color: "#1e293b",
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  vitalItem: {
    width: "50%",
    marginBottom: 3,
    flexDirection: "row",
  },
});

function formatDateDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function calculateAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const d = typeof dob === "string" ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

const e = React.createElement;

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string | null;
  // Partial DOB fields — Manoj msg 1993. Some patients are saved as
  // year-only (or month+year), so the full dateOfBirth is null but the
  // discrete parts are set. The Patient Summary PDF falls back to these
  // when dateOfBirth is absent so the row isn't a useless em-dash.
  dobDay?: number | null;
  dobMonth?: number | null;
  dobYear?: number | null;
  gender: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bloodType?: string | null;
  allergies?: Array<{ name: string; severity: string; reaction?: string }>;
  activeConditions?: string[];
  notes?: string | null;
}

// Returns a renderable DOB + age pair, mirroring the web's
// formatPatientAgeDob: full DOB → "21/06/1972 (53 years)"; partial
// month+year → "06/1972 (53 years)"; year-only → "1972 (53 years)";
// nothing → "—".
function formatPatientDobForPdf(p: {
  dateOfBirth: Date | string | null;
  dobDay?: number | null;
  dobMonth?: number | null;
  dobYear?: number | null;
}): string {
  if (p.dateOfBirth) {
    return `${formatDateDDMMYYYY(p.dateOfBirth)} (${calculateAge(p.dateOfBirth)} years)`;
  }
  const d = p.dobDay ?? null;
  const m = p.dobMonth ?? null;
  const y = p.dobYear ?? null;
  if (d && m && y) {
    const age = calculateAge(new Date(y, m - 1, d));
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${dd}/${mm}/${y} (${age} years)`;
  }
  if (m && y) {
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m) age -= 1;
    const mm = String(m).padStart(2, "0");
    return age >= 0 ? `${mm}/${y} (${age} years)` : `${mm}/${y}`;
  }
  if (y) {
    const age = new Date().getFullYear() - y;
    return age >= 0 ? `${y} (${age} years)` : `${y}`;
  }
  return "—";
}

interface RecordData {
  title: string;
  type: string;
  createdAt: Date | string;
  content?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  } | null;
  vitals?: {
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    oxygenSaturation?: number;
    respiratoryRate?: number;
  } | null;
  diagnoses?: string[];
}

interface VisitData {
  visitDate: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  heartRate: number | null;
  bslFasting: string | null;
  bslPostprandial: string | null;
  bslRandom: string | null;
  temperatureCelsius: string | null;
  weightKg: string | null;
  heightCm: string | null;
  spO2Percent: number | null;
  clinicalNotes: string | null;
}

function formatVisitVitals(v: VisitData): string {
  const parts: string[] = [];
  if (v.bpSystolic != null && v.bpDiastolic != null) {
    parts.push(`BP ${v.bpSystolic}/${v.bpDiastolic}`);
  }
  if (v.heartRate != null) parts.push(`HR ${v.heartRate}`);
  if (v.spO2Percent != null) parts.push(`SpO2 ${v.spO2Percent}%`);
  if (v.bslFasting) parts.push(`BSL-F ${v.bslFasting}`);
  if (v.bslPostprandial) parts.push(`PP ${v.bslPostprandial}`);
  if (v.bslRandom) parts.push(`R ${v.bslRandom}`);
  if (v.temperatureCelsius) parts.push(`Temp ${v.temperatureCelsius}°C`);
  if (v.weightKg) parts.push(`Wt ${v.weightKg}kg`);
  if (v.heightCm) parts.push(`Ht ${v.heightCm}cm`);
  return parts.join(" · ");
}

export async function renderPatientSummaryPdf(
  patient: PatientData,
  records: RecordData[],
  visits: VisitData[] = [],
): Promise<Buffer> {
  const doc = e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: styles.page },
      // Header
      e(
        View,
        { style: styles.header },
        e(
          Text,
          { style: styles.title },
          `${patient.firstName} ${patient.lastName}`,
        ),
        e(
          Text,
          { style: styles.subtitle },
          `Patient Summary — Generated ${formatDateDDMMYYYY(new Date())}`,
        ),
      ),
      // Demographics
      e(
        View,
        { style: styles.section },
        e(Text, { style: styles.sectionTitle }, "Demographics"),
        e(
          View,
          { style: styles.row },
          e(Text, { style: styles.label }, "Date of Birth:"),
          e(Text, { style: styles.value }, formatPatientDobForPdf(patient)),
        ),
        e(
          View,
          { style: styles.row },
          e(Text, { style: styles.label }, "Gender:"),
          e(Text, { style: styles.value }, patient.gender ?? "—"),
        ),
        patient.bloodType
          ? e(
              View,
              { style: styles.row },
              e(Text, { style: styles.label }, "Blood Type:"),
              e(Text, { style: styles.value }, patient.bloodType),
            )
          : null,
      ),
      // Contact
      e(
        View,
        { style: styles.section },
        e(Text, { style: styles.sectionTitle }, "Contact Information"),
        patient.phone
          ? e(
              View,
              { style: styles.row },
              e(Text, { style: styles.label }, "Phone:"),
              e(Text, { style: styles.value }, patient.phone),
            )
          : null,
        patient.email
          ? e(
              View,
              { style: styles.row },
              e(Text, { style: styles.label }, "Email:"),
              e(Text, { style: styles.value }, patient.email),
            )
          : null,
        patient.address
          ? e(
              View,
              { style: styles.row },
              e(Text, { style: styles.label }, "Address:"),
              e(Text, { style: styles.value }, patient.address),
            )
          : null,
        patient.emergencyContactName
          ? e(
              View,
              { style: styles.row },
              e(Text, { style: styles.label }, "Emergency Contact:"),
              e(
                Text,
                { style: styles.value },
                `${patient.emergencyContactName}${patient.emergencyContactPhone ? ` (${patient.emergencyContactPhone})` : ""}`,
              ),
            )
          : null,
      ),
      // Allergies
      (patient.allergies ?? []).length > 0
        ? e(
            View,
            { style: styles.section },
            e(Text, { style: styles.sectionTitle }, "Allergies"),
            e(
              View,
              { style: styles.badgeRow },
              ...(patient.allergies ?? []).map((a) =>
                e(
                  Text,
                  { style: styles.badge, key: a.name },
                  `${a.name} (${a.severity})${a.reaction ? ` — ${a.reaction}` : ""}`,
                ),
              ),
            ),
          )
        : null,
      // Active Conditions
      (patient.activeConditions ?? []).length > 0
        ? e(
            View,
            { style: styles.section },
            e(Text, { style: styles.sectionTitle }, "Active Conditions"),
            ...(patient.activeConditions ?? []).map((c) =>
              e(Text, { key: c }, `• ${c}`),
            ),
          )
        : null,
      // Visits (new patient_visits timeline)
      visits.length > 0
        ? e(
            View,
            { style: styles.section },
            e(
              Text,
              { style: styles.sectionTitle },
              `Visits (${visits.length})`,
            ),
            ...visits.map((v) => {
              const vitalsLine = formatVisitVitals(v);
              return e(
                View,
                { key: v.visitDate, style: { marginBottom: 10 } },
                e(
                  Text,
                  { style: { fontFamily: "Helvetica-Bold" } },
                  formatDateDDMMYYYY(v.visitDate),
                ),
                vitalsLine
                  ? e(
                      Text,
                      { style: { color: "#64748b", fontSize: 10 } },
                      vitalsLine,
                    )
                  : null,
                v.clinicalNotes
                  ? e(Text, { style: { fontSize: 10 } }, v.clinicalNotes)
                  : null,
              );
            }),
          )
        : null,
      // Older notes (legacy medical_records)
      records.length > 0
        ? e(
            View,
            { style: styles.section },
            e(
              Text,
              { style: styles.sectionTitle },
              `Older Notes (${records.length})`,
            ),
            ...records.map((rec) =>
              e(
                View,
                {
                  key: rec.title + String(rec.createdAt),
                  style: { marginBottom: 10 },
                },
                e(
                  Text,
                  { style: { fontFamily: "Helvetica-Bold" } },
                  `${rec.title} — ${rec.type.replace(/_/g, " ")} — ${formatDateDDMMYYYY(rec.createdAt)}`,
                ),
                ...(rec.diagnoses ?? []).map((d) =>
                  e(
                    Text,
                    { key: d, style: { color: "#64748b", fontSize: 10 } },
                    `Dx: ${d}`,
                  ),
                ),
              ),
            ),
          )
        : null,
      // Notes
      patient.notes
        ? e(
            View,
            { style: styles.section },
            e(Text, { style: styles.sectionTitle }, "Notes"),
            e(Text, null, patient.notes),
          )
        : null,
      // Footer
      e(
        Text,
        { style: styles.footer },
        `DocNotes — Confidential Medical Record — ${formatDateDDMMYYYY(new Date())}`,
      ),
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(doc as any);
}

export async function renderMedicalRecordPdf(
  patient: PatientData,
  record: RecordData,
): Promise<Buffer> {
  const content = record.content;
  const vitals = record.vitals;

  const doc = e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: styles.page },
      // Header
      e(
        View,
        { style: styles.header },
        e(Text, { style: styles.title }, record.title),
        e(
          Text,
          { style: styles.subtitle },
          `${patient.firstName} ${patient.lastName} — ${record.type.replace(/_/g, " ")} — ${formatDateDDMMYYYY(record.createdAt)}`,
        ),
      ),
      // Diagnoses
      (record.diagnoses ?? []).length > 0
        ? e(
            View,
            { style: styles.section },
            e(Text, { style: styles.sectionTitle }, "Diagnoses"),
            ...(record.diagnoses ?? []).map((d) =>
              e(Text, { key: d }, `• ${d}`),
            ),
          )
        : null,
      // Vitals
      vitals
        ? e(
            View,
            { style: styles.section },
            e(Text, { style: styles.sectionTitle }, "Vitals"),
            e(
              View,
              { style: styles.vitalsGrid },
              vitals.bloodPressureSystolic != null &&
                vitals.bloodPressureDiastolic != null
                ? e(
                    View,
                    { style: styles.vitalItem },
                    e(Text, { style: styles.label }, "Blood Pressure:"),
                    e(
                      Text,
                      { style: styles.value },
                      `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`,
                    ),
                  )
                : null,
              vitals.heartRate != null
                ? e(
                    View,
                    { style: styles.vitalItem },
                    e(Text, { style: styles.label }, "Heart Rate:"),
                    e(Text, { style: styles.value }, `${vitals.heartRate} bpm`),
                  )
                : null,
              vitals.temperature != null
                ? e(
                    View,
                    { style: styles.vitalItem },
                    e(Text, { style: styles.label }, "Temperature:"),
                    e(
                      Text,
                      { style: styles.value },
                      `${vitals.temperature} °C`,
                    ),
                  )
                : null,
              vitals.weight != null
                ? e(
                    View,
                    { style: styles.vitalItem },
                    e(Text, { style: styles.label }, "Weight:"),
                    e(Text, { style: styles.value }, `${vitals.weight} kg`),
                  )
                : null,
              vitals.height != null
                ? e(
                    View,
                    { style: styles.vitalItem },
                    e(Text, { style: styles.label }, "Height:"),
                    e(Text, { style: styles.value }, `${vitals.height} cm`),
                  )
                : null,
              vitals.oxygenSaturation != null
                ? e(
                    View,
                    { style: styles.vitalItem },
                    e(Text, { style: styles.label }, "SpO₂:"),
                    e(
                      Text,
                      { style: styles.value },
                      `${vitals.oxygenSaturation}%`,
                    ),
                  )
                : null,
              vitals.respiratoryRate != null
                ? e(
                    View,
                    { style: styles.vitalItem },
                    e(Text, { style: styles.label }, "Resp Rate:"),
                    e(
                      Text,
                      { style: styles.value },
                      `${vitals.respiratoryRate} /min`,
                    ),
                  )
                : null,
            ),
          )
        : null,
      // SOAP Note
      content
        ? e(
            View,
            { style: styles.section },
            e(Text, { style: styles.sectionTitle }, "Clinical Notes"),
            content.subjective
              ? e(
                  View,
                  { style: styles.soapSection },
                  e(Text, { style: styles.soapLabel }, "Subjective"),
                  e(Text, { style: styles.soapText }, content.subjective),
                )
              : null,
            content.objective
              ? e(
                  View,
                  { style: styles.soapSection },
                  e(Text, { style: styles.soapLabel }, "Objective"),
                  e(Text, { style: styles.soapText }, content.objective),
                )
              : null,
            content.assessment
              ? e(
                  View,
                  { style: styles.soapSection },
                  e(Text, { style: styles.soapLabel }, "Assessment"),
                  e(Text, { style: styles.soapText }, content.assessment),
                )
              : null,
            content.plan
              ? e(
                  View,
                  { style: styles.soapSection },
                  e(Text, { style: styles.soapLabel }, "Plan"),
                  e(Text, { style: styles.soapText }, content.plan),
                )
              : null,
          )
        : null,
      // Footer
      e(
        Text,
        { style: styles.footer },
        `DocNotes — Confidential Medical Record — ${formatDateDDMMYYYY(new Date())}`,
      ),
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(doc as any);
}

// Prescription rendered to roughly match Manoj's existing hand-printed
// slip (msg 910 photo): doctor block top-left, clinic line, date
// right-aligned, body for clinical notes, signature line. Devanagari
// letterhead block is deliberately deferred — @react-pdf's default
// Helvetica has no Devanagari glyphs, so adding it requires font
// registration and per-doctor Marathi input fields (follow-up).
interface DoctorProfileData {
  fullName: string;
  qualification: string;
  specialization?: string | null;
  registrationNumber: string;
  mobileNumber: string;
  email?: string | null;
  clinicName: string;
  taluka: string;
  district: string;
  state: string;
}

interface PrescriptionVisitData {
  visitDate: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  heartRate: number | null;
  weightKg: string | null;
  spO2Percent: number | null;
  clinicalNotes: string | null;
}

interface PrescriptionPatientData {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: Date | string | null;
  dobYear: number | null;
  gender: string | null;
  phone: string | null;
}

const rxStyles = StyleSheet.create({
  page: {
    paddingHorizontal: 30,
    paddingVertical: 28,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.35,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  doctorBlock: { flexDirection: "column" },
  doctorName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#7f1d1d",
  },
  doctorLine: { fontSize: 10, color: "#7f1d1d" },
  doctorRightLine: { fontSize: 10, color: "#7f1d1d", textAlign: "right" },
  hrThick: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#7f1d1d",
    marginTop: 6,
  },
  clinicLine: {
    fontSize: 10,
    color: "#7f1d1d",
    textAlign: "center",
    marginTop: 4,
  },
  hrThin: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#7f1d1d",
    marginTop: 4,
  },
  patientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    fontSize: 11,
  },
  bodyHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    color: "#1e293b",
  },
  vitalsLine: { fontSize: 9, color: "#64748b", marginTop: 2 },
  rxBody: { fontSize: 12, marginTop: 8, color: "#0f172a" },
  signatureLine: {
    marginTop: 40,
    alignSelf: "flex-end",
    borderTopWidth: 0.5,
    borderTopColor: "#1e293b",
    paddingTop: 4,
    width: 160,
    textAlign: "center",
    fontSize: 9,
    color: "#475569",
  },
});

function calcAgeFromYear(
  year: number | null,
  dob: Date | string | null,
): number | null {
  if (dob) return calculateAge(dob);
  if (year != null) return new Date().getFullYear() - year;
  return null;
}

function prescriptionVitalsLine(v: PrescriptionVisitData): string {
  const parts: string[] = [];
  if (v.bpSystolic != null && v.bpDiastolic != null) {
    parts.push(`BP ${v.bpSystolic}/${v.bpDiastolic}`);
  }
  if (v.heartRate != null) parts.push(`HR ${v.heartRate}`);
  if (v.spO2Percent != null) parts.push(`SpO2 ${v.spO2Percent}%`);
  if (v.weightKg) parts.push(`Wt ${v.weightKg}kg`);
  return parts.join(" · ");
}

// Manoj msg 1949: printed Rx renders the full structured line rather
// than the shortened Clinical Notes summary. Each line prints as e.g.
//   1. Triphala Churna   1-0-1 after meals × 3 days     (Qty 6)
//      Note: with warm water
export interface PrescriptionLineForPdf {
  medicineName: string;
  dosage: string | null;
  frequency: string | null; // meal timing: "before" | "after" | null
  duration: string | null;
  quantity: number | null;
  instructions: string | null;
}

function renderRxLineText(l: PrescriptionLineForPdf): string {
  const bits: string[] = [];
  if (l.dosage) bits.push(l.dosage);
  if (l.frequency) bits.push(`${l.frequency} meals`);
  if (l.duration) bits.push(`× ${l.duration}`);
  const summary = bits.join(" ");
  const qty = l.quantity ? `  (Qty ${l.quantity})` : "";
  return `${l.medicineName}${summary ? "   " + summary : ""}${qty}`;
}

// Remove the auto-appended Rx block from Clinical Notes when the PDF
// is rendering structured lines separately — otherwise the printout
// shows the same medicines twice (once structured, once as short
// lines). Handles both the legacy {rx: begin}/{rx: end} format and
// the current "Rx" trailing-block format (Manoj msg 2078).
function stripRxBlockFromNotes(notes: string | null): string | null {
  if (!notes) return notes;
  let out = notes;
  const legacyStart = out.indexOf("{rx: begin}");
  const legacyEnd = out.indexOf("{rx: end}");
  if (legacyStart !== -1 && legacyEnd !== -1 && legacyEnd > legacyStart) {
    out = (
      out.slice(0, legacyStart).trimEnd() +
      "\n" +
      out.slice(legacyEnd + "{rx: end}".length).trimStart()
    ).trim();
  }
  const lastRxIdx = out.lastIndexOf("\nRx\n");
  if (lastRxIdx !== -1) {
    out = out.slice(0, lastRxIdx).trimEnd();
  } else if (out.startsWith("Rx\n")) {
    out = "";
  }
  return out || null;
}

export async function renderPrescriptionPdf(
  patient: PrescriptionPatientData,
  doctor: DoctorProfileData,
  visit: PrescriptionVisitData,
  lines: PrescriptionLineForPdf[] = [],
): Promise<Buffer> {
  const patientName = [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(" ");
  const age = calcAgeFromYear(patient.dobYear, patient.dateOfBirth);
  const ageSex = [
    age != null ? `${age} y` : null,
    patient.gender ? patient.gender[0]!.toUpperCase() : null,
  ]
    .filter(Boolean)
    .join(" / ");
  const clinicLine = [
    doctor.clinicName,
    doctor.taluka,
    doctor.district,
    doctor.state,
  ]
    .filter(Boolean)
    .join(", ");
  const vitalsLine = prescriptionVitalsLine(visit);

  const doc = e(
    Document,
    null,
    e(
      Page,
      { size: "A5", style: rxStyles.page },
      e(
        View,
        { style: rxStyles.headerRow },
        e(
          View,
          { style: rxStyles.doctorBlock },
          e(Text, { style: rxStyles.doctorName }, `Dr. ${doctor.fullName}`),
          e(Text, { style: rxStyles.doctorLine }, doctor.qualification),
          e(
            Text,
            { style: rxStyles.doctorLine },
            `Reg. No. ${doctor.registrationNumber}`,
          ),
          e(
            Text,
            { style: rxStyles.doctorLine },
            `Mob.: ${doctor.mobileNumber}`,
          ),
        ),
        e(
          View,
          null,
          e(
            Text,
            { style: rxStyles.doctorRightLine },
            doctor.specialization ?? "",
          ),
          e(
            Text,
            { style: rxStyles.doctorRightLine },
            `Date: ${formatDateDDMMYYYY(visit.visitDate)}`,
          ),
        ),
      ),
      e(View, { style: rxStyles.hrThick }),
      clinicLine ? e(Text, { style: rxStyles.clinicLine }, clinicLine) : null,
      e(View, { style: rxStyles.hrThin }),
      e(
        View,
        { style: rxStyles.patientRow },
        e(Text, null, `Patient: ${patientName}${ageSex ? ` (${ageSex})` : ""}`),
        patient.phone ? e(Text, null, `Mob: ${patient.phone}`) : null,
      ),
      e(Text, { style: rxStyles.bodyHeading }, "Rx"),
      vitalsLine ? e(Text, { style: rxStyles.vitalsLine }, vitalsLine) : null,
      lines.length > 0
        ? e(
            View,
            { style: { marginTop: 8 } },
            ...lines.flatMap((l, i) => {
              const parts: React.ReactElement[] = [
                e(
                  Text,
                  { style: rxStyles.rxBody, key: `line-${i}` },
                  `${i + 1}. ${renderRxLineText(l)}`,
                ),
              ];
              if (l.instructions?.trim()) {
                parts.push(
                  e(
                    Text,
                    {
                      style: {
                        fontSize: 10,
                        color: "#475569",
                        marginTop: 1,
                        marginLeft: 14,
                      },
                      key: `note-${i}`,
                    },
                    `Note: ${l.instructions.trim()}`,
                  ),
                );
              }
              return parts;
            }),
          )
        : (() => {
            // No structured Rx — fall back to raw clinical notes for
            // legacy prescriptions written before Write Rx shipped.
            const notes = stripRxBlockFromNotes(visit.clinicalNotes);
            return notes
              ? e(Text, { style: rxStyles.rxBody }, notes)
              : e(Text, { style: rxStyles.rxBody }, "—");
          })(),
      e(Text, { style: rxStyles.signatureLine }, `Dr. ${doctor.fullName}`),
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(doc as any);
}

// ---------- Daily Case Register export (Manoj msg 1105) ----------

const dcrStyles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    lineHeight: 1.35,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: "#475569",
    textAlign: "center",
    marginBottom: 14,
  },
  dayHeader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 8,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  serial: {
    width: 22,
    textAlign: "right",
    paddingRight: 4,
    color: "#475569",
  },
  body: {
    flex: 1,
    color: "#0f172a",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
  totalsBlock: {
    marginTop: 14,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  totalRow: {
    flexDirection: "row",
    fontSize: 10,
  },
  totalLabel: {
    width: 140,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
  },
  totalValue: {
    flex: 1,
    color: "#0f172a",
  },
});

export interface DailyCaseRegisterEntry {
  visitDate: string; // YYYY-MM-DD
  patientName: string;
  serviceType: string | null;
  feeAmount: string | number | null;
  paymentMode: string | null;
  paymentStatus: string | null;
  feeReceivedAt: string | null;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatPaymentMode(mode: string | null, status: string | null): string {
  if (status === "nil") return "—";
  if (mode === "cash") return "Cash";
  if (mode === "digital") return "Digital";
  return mode ? titleCase(mode) : "—";
}

function formatFee(
  amount: string | number | null,
  status: string | null,
): string {
  if (status === "nil") return "—";
  const n = amount == null ? 0 : Number(amount);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toFixed(0)}`;
}

function formatService(s: string | null): string {
  return s && s.trim() ? s.trim() : "—";
}

export async function renderDailyRegisterExportPdf(
  startDate: string,
  endDate: string,
  entries: ReadonlyArray<DailyCaseRegisterEntry>,
  doctor: {
    fullName: string | null;
    clinicName: string | null;
  } | null,
): Promise<Buffer> {
  // entries are pre-sorted by visit_date ascending then created_at;
  // group locally so the renderer just walks the list.
  const byDate = new Map<string, DailyCaseRegisterEntry[]>();
  for (const en of entries) {
    const list = byDate.get(en.visitDate) ?? [];
    list.push(en);
    byDate.set(en.visitDate, list);
  }
  const dateKeys = Array.from(byDate.keys()).sort();

  // Continuous serial numbering across days (Manoj's sample format
  // increments across the date boundary: day 1 → 1,2,3; day 2 → 4,5).
  let serial = 0;
  const totalFees = entries.reduce(
    (acc, en) =>
      en.paymentStatus === "nil" ? acc : acc + (Number(en.feeAmount ?? 0) || 0),
    0,
  );
  const countNonNil = entries.filter((e) => e.paymentStatus !== "nil").length;

  const doctorLine = doctor
    ? [doctor.fullName ? `Dr. ${doctor.fullName}` : null, doctor.clinicName]
        .filter(Boolean)
        .join(" — ")
    : "";

  const doc = e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: dcrStyles.page },
      e(Text, { style: dcrStyles.title }, "Daily Case Register"),
      e(
        Text,
        { style: dcrStyles.subtitle },
        `Period: ${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}${
          doctorLine ? `   ·   ${doctorLine}` : ""
        }`,
      ),

      entries.length === 0
        ? e(
            Text,
            {
              style: { textAlign: "center", color: "#64748b", marginTop: 24 },
            },
            "No entries in this period.",
          )
        : dateKeys.flatMap((date) => {
            const rows = byDate.get(date) ?? [];
            return [
              e(
                Text,
                { key: `h-${date}`, style: dcrStyles.dayHeader },
                formatDateDDMMYYYY(date),
              ),
              ...rows.map((en) => {
                serial += 1;
                const parts = [
                  en.patientName,
                  formatService(en.serviceType),
                  formatFee(en.feeAmount, en.paymentStatus),
                  formatPaymentMode(en.paymentMode, en.paymentStatus),
                  en.feeReceivedAt ? formatDateDDMMYYYY(en.feeReceivedAt) : "—",
                ];
                return e(
                  View,
                  { key: `r-${date}-${serial}`, style: dcrStyles.row },
                  e(Text, { style: dcrStyles.serial }, `${serial}.`),
                  e(Text, { style: dcrStyles.body }, parts.join(" – ")),
                );
              }),
            ];
          }),

      entries.length > 0
        ? e(
            View,
            { style: dcrStyles.totalsBlock },
            e(
              View,
              { style: dcrStyles.totalRow },
              e(Text, { style: dcrStyles.totalLabel }, "Total entries:"),
              e(Text, { style: dcrStyles.totalValue }, String(entries.length)),
            ),
            e(
              View,
              { style: dcrStyles.totalRow },
              e(Text, { style: dcrStyles.totalLabel }, "Fees recorded:"),
              e(
                Text,
                { style: dcrStyles.totalValue },
                `₹${totalFees.toFixed(0)}  (over ${countNonNil} chargeable ${
                  countNonNil === 1 ? "entry" : "entries"
                })`,
              ),
            ),
          )
        : null,

      e(
        Text,
        { style: dcrStyles.footer, fixed: true },
        `Generated ${formatDateDDMMYYYY(new Date())}`,
      ),
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(doc as any);
}
