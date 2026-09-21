import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InspectorDashboard } from "@/features/inspector/inspector-dashboard";

export default function InspectorDashboardPage() {
  return (
    <DashboardShell
      activeHref="/inspector/dashboard"
      breadcrumb={["Inspector", "Review queue"]}
      workspace="inspector"
    >
      <InspectorDashboard />
    </DashboardShell>
  );
}
