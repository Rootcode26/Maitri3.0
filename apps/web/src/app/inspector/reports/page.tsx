import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InspectorReportsPage } from "@/features/inspector/inspector-workspace-pages";

export default function InspectorReportsRoute() {
  return (
    <DashboardShell
      activeHref="/inspector/reports"
      breadcrumb={["Inspector", "Reports"]}
      workspace="inspector"
    >
      <InspectorReportsPage />
    </DashboardShell>
  );
}
