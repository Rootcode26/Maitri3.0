import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ResumeChecklist } from "@/features/projects/resume-checklist";

export default async function ResumeChecklistPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <DashboardShell
      activeHref="/applicant/applications"
      breadcrumb={["Applicant", "Applications", "Continue"]}
    >
      <ResumeChecklist projectId={projectId} />
    </DashboardShell>
  );
}
