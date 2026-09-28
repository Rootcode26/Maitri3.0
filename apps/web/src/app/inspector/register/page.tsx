import { redirect } from "next/navigation";

// Inspector accounts are provisioned by the ministry, not self-registered.
// Anyone reaching the old registration route is sent to the login page.
export default function InspectorRegistrationPage() {
  redirect("/inspector/login");
}
