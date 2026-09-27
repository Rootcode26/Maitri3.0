import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InspectorClarificationsPage } from "@/features/inspector/inspector-workspace-pages";

export default function InspectorClarificationsRoute() {
  return (
    <DashboardShell
      activeHref="/inspector/clarifications"
      breadcrumb={["Inspector", "Clarifications"]}
      workspace="inspector"
    >
      <InspectorClarificationsPage />
    </DashboardShell>
  );
}
