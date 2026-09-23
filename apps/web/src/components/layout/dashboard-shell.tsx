"use client";

import { Bell, ChevronRight, Menu } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useState } from "react";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

export function DashboardTopbar({
  breadcrumb,
  navigationOpen,
  onToggleNavigation,
}: {
  breadcrumb: string[];
  navigationOpen: boolean;
  onToggleNavigation: () => void;
}) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-6 border-b border-[#e4e0d6] bg-[#f7f6f2] px-6 py-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={navigationOpen}
          aria-controls="mobile-workspace-navigation"
          onClick={onToggleNavigation}
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
                  <li
                    className={
                      last ? "font-semibold text-[#142b45]" : undefined
                    }
                    aria-current={last ? "page" : undefined}
                  >
                    {crumb}
                  </li>
                  {!last && (
                    <ChevronRight
                      className="size-4 text-slate-400"
                      aria-hidden="true"
                    />
                  )}
                </Fragment>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className="flex items-center gap-5">
        <span className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
          <span className="rounded border border-[#e4e0d6] px-2 py-0.5 text-xs font-semibold text-[#142b45]">
            SIH
          </span>
          Digital public-service prototype
        </span>
        <button
          type="button"
          aria-label="Notifications"
          className="grid size-10 place-items-center rounded-full border border-[#e4e0d6] text-slate-600 transition-colors hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Bell className="size-5" aria-hidden="true" />
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
  const [navigationOpen, setNavigationOpen] = useState(false);
  useEffect(() => {
    if (!navigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavigationOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navigationOpen]);
  return (
    <div className="flex min-h-svh bg-[#f7f6f2]">
      <DashboardSidebar
        activeHref={activeHref}
        workspace={workspace}
        className="hidden lg:flex"
      />
      {navigationOpen ? (
        <>
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
            onClick={() => setNavigationOpen(false)}
          />
          <DashboardSidebar
            id="mobile-workspace-navigation"
            activeHref={activeHref}
            workspace={workspace}
            onClose={() => setNavigationOpen(false)}
            className="fixed inset-y-0 left-0 z-50 flex max-w-[85vw] shadow-xl lg:hidden"
          />
        </>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <DashboardTopbar
          breadcrumb={breadcrumb}
          navigationOpen={navigationOpen}
          onToggleNavigation={() => setNavigationOpen((open) => !open)}
        />
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
