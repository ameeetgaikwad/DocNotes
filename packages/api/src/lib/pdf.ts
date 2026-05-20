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
          e(
            Text,
            { style: styles.value },
            patient.dateOfBirth
              ? `${formatDateDDMMYYYY(patient.dateOfBirth)} (${calculateAge(patient.dateOfBirth)} years)`
              : "—",
          ),
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

export async function renderPrescriptionPdf(
  patient: PrescriptionPatientData,
  doctor: DoctorProfileData,
  visit: PrescriptionVisitData,
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
      visit.clinicalNotes
        ? e(Text, { style: rxStyles.rxBody }, visit.clinicalNotes)
        : e(Text, { style: rxStyles.rxBody }, "—"),
      e(Text, { style: rxStyles.signatureLine }, `Dr. ${doctor.fullName}`),
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(doc as any);
}
