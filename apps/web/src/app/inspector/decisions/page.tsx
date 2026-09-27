import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InspectorDecisionsPage } from "@/features/inspector/inspector-workspace-pages";

export default function InspectorDecisionsRoute() {
  return (
    <DashboardShell
      activeHref="/inspector/decisions"
      breadcrumb={["Inspector", "Decisions"]}
      workspace="inspector"
    >
      <InspectorDecisionsPage />
    </DashboardShell>
  );
}
