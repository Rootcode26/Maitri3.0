import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InspectorApplicationView } from "@/features/inspector/inspector-application";

export default async function InspectorApplicationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <DashboardShell
      activeHref="/inspector/dashboard"
      breadcrumb={["Inspector", "Review queue", "Application"]}
      workspace="inspector"
    >
      <InspectorApplicationView projectId={projectId} />
    </DashboardShell>
  );
}
