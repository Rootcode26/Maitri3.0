import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InspectorApplicationsPage } from "@/features/inspector/inspector-workspace-pages";

export default function InspectorApplicationsRoute() {
  return (
    <DashboardShell
      activeHref="/inspector/applications"
      breadcrumb={["Inspector", "Applications"]}
      workspace="inspector"
    >
      <InspectorApplicationsPage />
    </DashboardShell>
  );
}
