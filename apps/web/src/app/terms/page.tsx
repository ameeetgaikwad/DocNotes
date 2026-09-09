import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms & Conditions — ClinikNote",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" effectiveDate="9 September 2026">
      <p>
        Welcome to <strong>ClinikNote</strong>. By using this App, you agree to
        the following Terms and Conditions. These Terms should be read together
        with our{" "}
        <a href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/retention" className="text-primary hover:underline">
          Data Retention Policy
        </a>
        .
      </p>

      <h2>1. Account Responsibility</h2>
      <p>
        You are responsible for maintaining the security of your account and
        password. The App should be used only for legitimate clinical and
        practice management purposes.
      </p>

      <h2>2. Patient Data</h2>
      <p>
        You are solely responsible for the accuracy and correctness of all
        patient information entered in the App. You must comply with all
        applicable laws related to patient confidentiality, including the
        Digital Personal Data Protection Act, 2023. For the patient records you
        enter, you act as the Data Fiduciary and ClinikNote acts as your Data
        Processor.
      </p>

      <h2>3. Consent</h2>
      <p>
        By creating an account and using the App, you consent to the collection
        and processing of personal data as described in the Privacy Policy. You
        may withdraw consent at any time by emailing our Grievance Officer at{" "}
        <a
          href="mailto:support@cliniknote.app"
          className="text-primary hover:underline"
        >
          support@cliniknote.app
        </a>
        . Withdrawal will end your access to the App; data handling after
        withdrawal follows the Retention Policy.
      </p>

      <h2>4. License</h2>
      <p>
        We grant you a limited, non-exclusive license to use ClinikNote for
        managing your own clinic or practice.
      </p>

      <h2>5. Prohibited Conduct</h2>
      <p>
        You may not copy, modify, reverse engineer, or distribute the App
        without permission.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        The App is provided on an &ldquo;as is&rdquo; basis. We are not liable
        for any losses or claims arising from the use of ClinikNote.
      </p>

      <h2>7. Grievance Redressal</h2>
      <p>
        Complaints about the App, or requests to exercise your rights under the
        DPDP Act, should be sent to our Grievance Officer, Amit Gaikwad, at{" "}
        <a
          href="mailto:support@cliniknote.app"
          className="text-primary hover:underline"
        >
          support@cliniknote.app
        </a>
        . We will acknowledge within seven (7) working days and resolve within
        thirty (30) days.
      </p>
    </LegalLayout>
  );
}
