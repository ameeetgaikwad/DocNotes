import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms & Conditions — ClinikNote",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" effectiveDate="21 May 2026">
      <p>
        Welcome to <strong>ClinikNote</strong>. By using this App, you agree to
        the following Terms and Conditions.
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
        applicable laws related to patient confidentiality.
      </p>

      <h2>3. License</h2>
      <p>
        We grant you a limited, non-exclusive license to use ClinikNote for
        managing your own clinic or practice.
      </p>

      <h2>4. Prohibited Conduct</h2>
      <p>
        You may not copy, modify, reverse engineer, or distribute the App
        without permission.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        The App is provided on an &ldquo;as is&rdquo; basis. We are not liable
        for any losses or claims arising from the use of ClinikNote.
      </p>
    </LegalLayout>
  );
}
