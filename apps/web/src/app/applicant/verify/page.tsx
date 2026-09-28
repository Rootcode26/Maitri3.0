import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ApplicantVerifyCertificate } from "@/features/certificates/applicant-verify";

export default function ApplicantVerifyPage() {
  return (
    <DashboardShell
      activeHref="/applicant/verify"
      breadcrumb={["Home", "Applicant", "Verify certificate"]}
    >
      <ApplicantVerifyCertificate />
    </DashboardShell>
  );
}
