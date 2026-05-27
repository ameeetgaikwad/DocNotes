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

      <h2>Built for Indian Practice</h2>
      <p>
        ClinikNote is built exclusively for general medical practitioners in
        India. We understand that the requirements of Indian doctors —
        especially solo practitioners and small clinics — are unique and
        different from those in Western countries. The app is designed keeping
        in mind local needs such as the Daily Case Register for Income Tax
        compliance, easy workflow, pending dues tracking, and support for
        Homeopathic, Ayurvedic, and Allopathic practice.
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

      <h2>Data Responsibility</h2>
      <p>
        ClinikNote is a facilitation tool that helps doctors manage their
        workflow, maintain patient history, generate prescriptions, and keep
        records required for Income Tax purposes.
      </p>
      <p>
        The sole responsibility of maintaining proper patient records, ensuring
        data accuracy, patient confidentiality, and compliance with all
        applicable Indian laws lies entirely with the doctor / user.
      </p>
      <p>
        While we take every precaution to preserve the data, it can still get
        lost due to unforeseen technical issues. Doctors are therefore strongly
        advised to maintain parallel hard-copy records as per their professional
        and legal responsibility.
      </p>
      <p>
        We do not store or access patient data centrally for any purpose other
        than providing the service to the registered doctor.
      </p>

      <p>
        By using <strong>ClinikNote</strong>, you acknowledge and agree to this
        Disclaimer.
      </p>
    </LegalLayout>
  );
}
