import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ApplicantDocuments } from "@/features/projects/applicant-documents";

export default function ApplicantDocumentsPage() {
  return (
    <DashboardShell
      activeHref="/applicant/documents"
      breadcrumb={["Home", "Applicant", "Documents"]}
    >
      <ApplicantDocuments />
    </DashboardShell>
  );
}
