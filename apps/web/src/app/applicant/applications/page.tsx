import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ApplicantApplications } from "@/features/projects/applicant-applications";

export default function ApplicantApplicationsPage() {
  return (
    <DashboardShell
      activeHref="/applicant/applications"
      breadcrumb={["Home", "Applicant", "Applications"]}
    >
      <ApplicantApplications />
    </DashboardShell>
  );
}
