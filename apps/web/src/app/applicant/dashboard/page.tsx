import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "Active projects", value: "2", note: "1 project awaiting an action" },
  { label: "Approvals in progress", value: "7", note: "Across four departments" },
  { label: "Action needed", value: "1", note: "Correction due in 3 days" },
  { label: "Certificates issued", value: "4", note: "Available in your repository" },
];

export default function ApplicantDashboardPage() {
  return (
    <DashboardShell activeHref="/applicant/dashboard" breadcrumb={["Home", "Applicant", "Dashboard"]}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
          {/* Greeting */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Monday, 15 September 2026</p>
              <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#142b45] sm:text-5xl">
                Good afternoon, Surya
              </h1>
              <p className="mt-2 text-base text-slate-600">
                Here is what needs attention across your industrial projects.
              </p>
            </div>
            <Button size="lg" className="h-11 rounded-full px-6">
              Create new project
            </Button>
          </div>

          <hr className="my-6 border-border" />

          {/* Hero banner */}
          <section className="relative overflow-hidden rounded-xl bg-[#142b45] px-8 py-12 text-white sm:px-12 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-4xl leading-tight font-bold sm:text-5xl">
                Your Sahyadri Foods project is moving.
              </h2>
              <p className="mt-4 max-w-md text-base text-slate-200">
                Three approvals are under review. One correction is due by 18 September.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" className="h-11 rounded-full px-6">
                  Respond to correction
                </Button>
                <Button variant="secondary" size="lg" className="h-11 rounded-full bg-white px-6 text-[#142b45]">
                  View all applications
                </Button>
              </div>
            </div>
            <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium">
              <span className="size-2 rounded-full bg-white" aria-hidden="true" />
              Project active
            </span>
          </section>

          {/* Stat cards */}
          <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="rounded-md border-l-4 border-amber-500 bg-white ring-1 ring-border">
                <CardContent className="space-y-2 px-5 py-1">
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="text-4xl font-bold text-[#142b45]">{stat.value}</p>
                  <p className="text-sm text-slate-500">{stat.note}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {/* Bottom cards */}
          <section className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <Card className="rounded-md bg-white ring-1 ring-border">
              <CardHeader className="flex-row items-center justify-between gap-4 px-6 pt-5">
                <div>
                  <CardTitle className="text-lg font-semibold text-[#142b45]">
                    Current applications
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Recent departmental movement</p>
                </div>
                <a href="#" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                  View all
                </a>
              </CardHeader>
              <CardContent className="px-6 pb-6 text-sm text-slate-500">
                {/* Application list rows go here */}
              </CardContent>
            </Card>

            <Card className="rounded-md bg-white ring-1 ring-border">
              <CardHeader className="px-6 pt-5">
                <CardTitle className="text-lg font-semibold text-[#142b45]">Next actions</CardTitle>
                <p className="mt-1 text-sm text-slate-500">Ordered by deadline</p>
              </CardHeader>
              <CardContent className="px-6 pb-6 text-sm text-slate-500">
                {/* Action list rows go here */}
              </CardContent>
            </Card>
          </section>
      </div>
    </DashboardShell>
  );
}
