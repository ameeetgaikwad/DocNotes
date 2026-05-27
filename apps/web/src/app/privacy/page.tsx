import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — ClinikNote",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" effectiveDate="21 May 2026">
      <p>
        <strong>ClinikNote</strong> is committed to protecting the privacy of
        doctors and their patients. This Privacy Policy explains how we collect,
        use, and safeguard your information.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Doctor and Clinic Information:</strong> Name, qualification,
          registration number, clinic address, mobile number, and email.
        </li>
        <li>
          <strong>Patient Information:</strong> Name, contact details, medical
          history, lab reports, vitals, diagnosis, clinical notes,
          prescriptions, documents, and payment records.
        </li>
      </ul>

      <h2>2. How We Use the Information</h2>
      <ul>
        <li>
          To provide smooth clinic management — including daily register,
          patient records, appointments, reminders, and reports.
        </li>
        <li>
          To help doctors maintain proper records for clinical and Income Tax
          purposes.
        </li>
        <li>To continuously improve the App.</li>
      </ul>

      <h2>3. Data Sharing</h2>
      <ul>
        <li>
          We <strong>do not sell</strong> any patient data.
        </li>
        <li>
          Patient data is visible only to the registered doctor and their
          authorized staff.
        </li>
        <li>Data will be shared only when legally required.</li>
      </ul>

      <h2>4. Data Security</h2>
      <p>
        We take reasonable measures to keep your data secure. All medical
        records are stored on secure cloud servers.
      </p>

      <h2>5. Your Rights</h2>
      <p>
        You can view, update, or delete your data at any time. Patient records
        can also be deleted by the doctor whenever required.
      </p>

      <h2>Contact Us</h2>
      <p>
        For any questions regarding privacy, please reach out to us at:{" "}
        <a
          href="mailto:support@cliniknote.app"
          className="text-primary hover:underline"
        >
          support@cliniknote.app
        </a>
        .
      </p>
    </LegalLayout>
  );
}
