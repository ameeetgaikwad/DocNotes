import ReactPDF from "@react-pdf/renderer";
import React from "react";

const { StyleSheet, renderToBuffer } = ReactPDF;

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

function formatDateDDMMYYYY(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function calculateAge(dob: Date | string): number {
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
  dateOfBirth: Date | string;
  gender: string;
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

export async function renderPatientSummaryPdf(
  patient: PatientData,
  records: RecordData[],
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
            `${formatDateDDMMYYYY(patient.dateOfBirth)} (${calculateAge(patient.dateOfBirth)} years)`,
          ),
        ),
        e(
          View,
          { style: styles.row },
          e(Text, { style: styles.label }, "Gender:"),
          e(Text, { style: styles.value }, patient.gender),
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
      // Recent Records
      records.length > 0
        ? e(
            View,
            { style: styles.section },
            e(
              Text,
              { style: styles.sectionTitle },
              `Medical Records (${records.length})`,
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
