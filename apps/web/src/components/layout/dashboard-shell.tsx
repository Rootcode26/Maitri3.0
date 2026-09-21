import { Bell, ChevronRight, Menu } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

export function DashboardTopbar({ breadcrumb }: { breadcrumb: string[] }) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-6 border-b border-[#e4e0d6] bg-[#f7f6f2] px-6 py-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Toggle navigation"
          className="grid size-10 place-items-center rounded-full border border-[#e4e0d6] text-slate-600 transition-colors hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-slate-500">
            {breadcrumb.map((crumb, i) => {
              const last = i === breadcrumb.length - 1;
              return (
                <Fragment key={crumb}>
                  <li className={last ? "font-semibold text-[#142b45]" : undefined} aria-current={last ? "page" : undefined}>
                    {crumb}
                  </li>
                  {!last && <ChevronRight className="size-4 text-slate-400" aria-hidden="true" />}
                </Fragment>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-5">
        <span className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
          <span className="rounded border border-[#e4e0d6] px-2 py-0.5 text-xs font-semibold text-[#142b45]">SIH</span>
          Digital public-service prototype
        </span>
        <button
          type="button"
          aria-label="Notifications, 2 unread"
          className="relative grid size-10 place-items-center rounded-full border border-[#e4e0d6] text-slate-600 transition-colors hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Bell className="size-5" aria-hidden="true" />
          <span className="absolute top-1.5 right-2 size-2 rounded-full bg-destructive ring-2 ring-[#f7f6f2]" aria-hidden="true" />
        </button>
        <span className="grid size-10 place-items-center rounded-full border border-[#e4e0d6] bg-white text-sm font-semibold text-[#142b45]">
          SP
        </span>
      </div>
    </header>
  );
}

export function DashboardShell({
  activeHref,
  breadcrumb,
  workspace = "applicant",
  children,
}: {
  activeHref: string;
  breadcrumb: string[];
  workspace?: "applicant" | "inspector";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh bg-[#f7f6f2]">
      <DashboardSidebar activeHref={activeHref} workspace={workspace} />
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <DashboardTopbar breadcrumb={breadcrumb} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
