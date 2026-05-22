import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Disclaimer — ClinikNote",
};

export default function DisclaimerPage() {
  return (
    <LegalLayout title="Disclaimer" effectiveDate="21 May 2026">
      <p>
        <strong>ClinikNote</strong> is a digital assistance tool designed to
        help doctors maintain patient records, daily case register, pending
        dues, and generate reports efficiently.
      </p>

      <h2>Important Notice</h2>
      <ul>
        <li>
          This application is <strong>not a substitute</strong> for professional
          medical judgment, diagnosis, or treatment.
        </li>
        <li>
          All clinical decisions, prescriptions, and medical advice remain the
          sole responsibility of the treating doctor.
        </li>
        <li>
          While we strive to keep the App accurate and reliable, we do not
          guarantee error-free performance.
        </li>
        <li>
          Doctors are advised to follow all applicable laws and maintain
          physical records wherever required.
        </li>
      </ul>

      <p>
        By using <strong>ClinikNote</strong>, you acknowledge and agree to this
        Disclaimer.
      </p>
    </LegalLayout>
  );
}
