import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ApplicantNotifications } from "@/features/notifications/applicant-notifications";

export default function ApplicantNotificationsPage() {
  return (
    <DashboardShell
      activeHref="/applicant/notifications"
      breadcrumb={["Home", "Applicant", "Notifications"]}
    >
      <ApplicantNotifications />
    </DashboardShell>
  );
}
