import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NewProjectWizard } from "@/features/projects/new-project-wizard";

export default function NewProjectPage() {
  return (
    <DashboardShell
      activeHref="/applicant/projects/new"
      breadcrumb={["Applicant", "Projects", "New project"]}
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:py-10">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold text-primary">New project</p>
          <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight text-[#142b45] sm:text-5xl">
            Register an industrial project
          </h1>
          <p className="mt-3 text-base text-slate-600">
            Your answers shape the approval checklist for this demonstration.
          </p>
        </header>

        <div className="mt-8">
          <NewProjectWizard />
        </div>
      </div>
    </DashboardShell>
  );
}
