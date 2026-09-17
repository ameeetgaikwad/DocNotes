import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — ClinikNote",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" effectiveDate="9 September 2026">
      <p>
        <strong>ClinikNote</strong> is a digital register and clinic management
        tool for solo medical practitioners in India. This Privacy Policy
        explains what personal data we collect, how we use it, and the rights
        you have under the Digital Personal Data Protection Act, 2023 (DPDP
        Act).
      </p>

      <p>
        In this policy, &ldquo;we&rdquo; / &ldquo;us&rdquo; refers to ClinikNote
        (the Data Fiduciary for doctor account data, and the Data Processor
        acting on the doctor&rsquo;s behalf for patient data). &ldquo;You&rdquo;
        refers to the doctor using the app.
      </p>

      <h2>1. Personal Data We Collect</h2>
      <ul>
        <li>
          <strong>Doctor / clinic information:</strong> name, qualification,
          registration number, clinic name and address, mobile number, email
          address.
        </li>
        <li>
          <strong>Patient information you enter:</strong> name, contact details,
          date of birth, gender, medical history, allergies, diagnoses, vitals,
          clinical notes, prescriptions, uploaded documents, payment records.
        </li>
        <li>
          <strong>Account and usage data:</strong> login events, device
          identifiers, and basic diagnostic logs used to keep the service
          running.
        </li>
      </ul>

      <h2>2. Purpose and Legal Basis</h2>
      <p>We process personal data for these purposes only:</p>
      <ul>
        <li>To provide the ClinikNote service to you.</li>
        <li>
          To help you maintain records required for clinical practice and Income
          Tax compliance in India.
        </li>
        <li>To keep the service secure and to fix issues you report to us.</li>
      </ul>
      <p>
        The legal basis for processing is your consent (given when you sign up
        and use the app) and, where applicable, our legitimate use to provide
        the service you have signed up for.
      </p>

      <h2>3. Consent</h2>
      <p>
        By creating a ClinikNote account and adding patient records, you consent
        to us storing that data on your behalf and to the processing described
        in this policy. Consent is specific, informed, and given for the
        purposes above. You may withdraw consent at any time by emailing our
        Grievance Officer (see section 9). Withdrawing consent will end your
        ability to use the service; existing data will be handled per section 6.
      </p>

      <h2>4. How We Share Data</h2>
      <ul>
        <li>
          We do <strong>not sell</strong> personal data to any third party.
        </li>
        <li>
          Patient data is visible only to the registered doctor who created it.
          It is not shared across doctor accounts.
        </li>
        <li>
          We use a small set of infrastructure providers to deliver the service:
          Neon (Postgres database, hosted in the United States), Cloudflare R2
          (document storage), Clerk (authentication), and Vercel (web hosting).
          These providers process data only to run the service and are
          contractually bound to appropriate security standards.
        </li>
        <li>
          We may disclose data if legally required by an order of a competent
          Indian authority.
        </li>
      </ul>

      <h2>5. Cross-Border Transfer</h2>
      <p>
        Some of the infrastructure providers listed above host data outside
        India (for example, Neon is hosted in the United States). By using
        ClinikNote you acknowledge that personal data may be stored and
        processed outside India in jurisdictions permitted under the DPDP Act.
        We choose providers that maintain industry-standard security controls.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We keep personal data for as long as your account is active, or as
        needed to provide the service to you. Deleted patient records are
        soft-deleted (retained in the database but hidden from the app) for
        recovery in case of accidental deletion. If you close your account, we
        will delete or anonymise your data within 90 days, except where Indian
        law requires longer retention (for example, income-tax record retention
        obligations that apply to you as a doctor).
      </p>
      <p>
        Our full retention schedule is published on the{" "}
        <a href="/retention" className="text-primary hover:underline">
          Data Retention Policy
        </a>{" "}
        page.
      </p>

      <h2>7. Data Security</h2>
      <p>
        We use encryption in transit (HTTPS/TLS on every request) and encryption
        at rest at our storage providers. Access to production systems is
        restricted to the developer team on a need-to-fix basis and is not used
        to read patient data. We keep no analytics or tracking on the
        doctor-facing pages of the app.
      </p>

      <h2>8. Your Rights as a Data Principal</h2>
      <p>Under the DPDP Act you have the right to:</p>
      <ul>
        <li>
          <strong>Access</strong> — request a copy of the personal data we hold
          about you.
        </li>
        <li>
          <strong>Correction</strong> — ask us to correct data that is
          inaccurate or incomplete.
        </li>
        <li>
          <strong>Erasure</strong> — ask us to delete your account and
          associated data (subject to any legal retention requirement).
        </li>
        <li>
          <strong>Grievance redressal</strong> — raise a complaint about how we
          handle your data.
        </li>
        <li>
          <strong>Nominate</strong> — designate a person to exercise these
          rights on your behalf if you are deceased or incapacitated.
        </li>
        <li>
          <strong>Withdraw consent</strong> — at any time, by email to the
          Grievance Officer.
        </li>
      </ul>
      <p>
        To exercise any of these rights, email our Grievance Officer using the
        contact in section 9. We will acknowledge your request within seven (7)
        working days and resolve it within thirty (30) days.
      </p>

      <h2>9. Grievance Officer</h2>
      <p>
        In accordance with the DPDP Act and the Information Technology Act,
        2000, you may contact our Grievance Officer for any question about this
        policy, to exercise your rights, or to raise a complaint:
      </p>
      <p>
        <strong>Name:</strong> Amit Gaikwad
        <br />
        <strong>Email:</strong>{" "}
        <a
          href="mailto:support@cliniknote.app"
          className="text-primary hover:underline"
        >
          support@cliniknote.app
        </a>
        <br />
        <strong>Response time:</strong> acknowledgment within seven (7) working
        days; resolution within thirty (30) days.
      </p>

      <h2>10. Data Breach Notification</h2>
      <p>
        If a personal data breach affecting your account occurs, we will notify
        you and the Data Protection Board of India as required under the DPDP
        Act, including a description of the breach, the data affected, and the
        steps we are taking in response.
      </p>

      <h2>11. Children&rsquo;s Data</h2>
      <p>
        The app is intended for use by registered medical practitioners (adults)
        only. Patient records may include data about minors; in that case, the
        doctor is responsible for obtaining any consent required from the
        patient&rsquo;s parent or guardian before entering data.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We will update this policy when the service or applicable law changes.
        The &ldquo;Effective Date&rdquo; at the top will reflect the latest
        revision. Material changes will be communicated through the app or by
        email.
      </p>

      <h2>13. Contact</h2>
      <p>
        For any question about this policy, email{" "}
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
