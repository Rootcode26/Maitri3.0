import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ApplicantApplicationDetail } from "@/features/projects/applicant-application-detail";

export default async function ApplicantApplicationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <DashboardShell
      activeHref="/applicant/applications"
      breadcrumb={["Applicant", "Applications", "Details"]}
    >
      <ApplicantApplicationDetail projectId={projectId} />
    </DashboardShell>
  );
}
