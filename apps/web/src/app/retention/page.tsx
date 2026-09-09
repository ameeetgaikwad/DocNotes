import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Data Retention Policy — ClinikNote",
};

export default function RetentionPage() {
  return (
    <LegalLayout title="Data Retention Policy" effectiveDate="9 September 2026">
      <p>
        This page sets out how long ClinikNote keeps different categories of
        personal data. It supplements our{" "}
        <a href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </a>{" "}
        and is written to align with the Digital Personal Data Protection Act,
        2023 (DPDP Act).
      </p>

      <h2>1. Retention Table</h2>
      <ul>
        <li>
          <strong>Doctor account (profile, clinic details):</strong> retained
          for as long as your account is active. Deleted within ninety (90) days
          of account closure.
        </li>
        <li>
          <strong>
            Patient records (name, history, vitals, notes, prescriptions):
          </strong>{" "}
          retained for as long as the doctor account is active. Individual
          patient records marked as deleted are soft-deleted — hidden from the
          app immediately, kept in the database for ninety (90) days to allow
          accidental-deletion recovery, then purged.
        </li>
        <li>
          <strong>Uploaded documents (lab reports, images):</strong> same
          retention as patient records — soft-deleted on request, hard-deleted
          from Cloudflare R2 storage after ninety (90) days.
        </li>
        <li>
          <strong>Daily case register entries and pending dues:</strong>{" "}
          retained for as long as the doctor account is active, since these form
          part of the doctor&rsquo;s statutory records under Income Tax rules.
          On account closure, we will export a copy for you before deletion if
          requested.
        </li>
        <li>
          <strong>Authentication and session data:</strong> managed by our
          authentication provider (Clerk). Session tokens expire per
          Clerk&rsquo;s defaults; login history is retained for sixty (60) days
          for security monitoring.
        </li>
        <li>
          <strong>Application logs (error traces, diagnostic events):</strong>{" "}
          retained for thirty (30) days for debugging and incident response,
          then automatically purged.
        </li>
        <li>
          <strong>Backups:</strong> daily Postgres backups are retained for
          seven (7) days. Deleted records may persist in backups until the
          backup age exceeds this window.
        </li>
      </ul>

      <h2>2. Legal Retention Requirements</h2>
      <p>
        Certain Indian laws may require you to retain patient or financial
        records for longer than our default retention. This is your
        responsibility as the treating doctor and Data Fiduciary for your
        patients. We recommend maintaining parallel physical records or periodic
        exports as appropriate for your practice.
      </p>

      <h2>3. Deletion on Request</h2>
      <p>
        You can request deletion of your account or specific patient records by
        emailing our Grievance Officer at{" "}
        <a
          href="mailto:support@cliniknote.app"
          className="text-primary hover:underline"
        >
          support@cliniknote.app
        </a>
        . Requests are acknowledged within seven (7) working days and actioned
        within thirty (30) days, subject to the legal-retention carve-out in
        section 2.
      </p>

      <h2>4. Data Export</h2>
      <p>
        You may request an export of your data at any time — the export includes
        doctor profile, patient records, daily case register entries, and
        prescriptions in a machine-readable format. Send the request to the
        address above.
      </p>

      <h2>5. Changes to This Policy</h2>
      <p>
        Retention timelines may change as the service evolves. When they do, the
        &ldquo;Effective Date&rdquo; at the top of this page will reflect the
        latest revision, and material changes will be communicated through the
        app or by email.
      </p>
    </LegalLayout>
  );
}
