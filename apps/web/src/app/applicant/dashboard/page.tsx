import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ApplicantDashboard } from "@/features/projects/applicant-dashboard";

export default function ApplicantDashboardPage() {
  return (
    <DashboardShell
      activeHref="/applicant/dashboard"
      breadcrumb={["Home", "Applicant", "Dashboard"]}
    >
      <ApplicantDashboard />
    </DashboardShell>
  );
}
