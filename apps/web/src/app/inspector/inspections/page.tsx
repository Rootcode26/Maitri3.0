import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InspectorInspectionsPage } from "@/features/inspector/inspector-workspace-pages";

export default function InspectorInspectionsRoute() {
  return (
    <DashboardShell
      activeHref="/inspector/inspections"
      breadcrumb={["Inspector", "Site inspections"]}
      workspace="inspector"
    >
      <InspectorInspectionsPage />
    </DashboardShell>
  );
}
