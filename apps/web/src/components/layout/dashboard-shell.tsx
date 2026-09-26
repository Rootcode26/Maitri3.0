"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useState } from "react";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { getCurrentSession, logoutSession } from "@/lib/auth-api";

type Workspace = "applicant" | "inspector";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = (parts[0]![0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "");
  return letters.toUpperCase() || "?";
}

function UserMenu({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const loginHref = workspace === "inspector" ? "/inspector/login" : "/auth/login";

  const session = useQuery({
    queryKey: ["session"],
    queryFn: getCurrentSession,
    staleTime: 60_000,
  });
  const logout = useMutation({
    mutationFn: logoutSession,
    onSuccess: () => {
      queryClient.setQueryData(["session"], null);
      router.replace(loginHref);
    },
  });

  const user = session.data ?? null;
  const roleLabel =
    user?.role === "inspector"
      ? "Inspector"
      : user?.role === "applicant"
        ? "Applicant"
        : "";

  return (
    <div className="flex items-center gap-3">
      {user ? (
        <>
          <span className="hidden text-right leading-tight sm:block">
            <span className="block text-sm font-semibold text-[#142b45]">
              {user.name}
            </span>
            <span className="block text-xs text-slate-500">{roleLabel}</span>
          </span>
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full border border-[#e4e0d6] bg-white text-sm font-semibold text-[#142b45]"
            aria-hidden="true"
          >
            {initialsOf(user.name)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-busy={logout.isPending}
          >
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">
              {logout.isPending ? "Signing out…" : "Sign out"}
            </span>
          </Button>
        </>
      ) : (
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full border border-[#e4e0d6] bg-white text-sm font-semibold text-slate-300"
          aria-hidden="true"
        >
          …
        </span>
      )}
    </div>
  );
}

export function DashboardTopbar({
  breadcrumb,
  navigationOpen,
  onToggleNavigation,
  workspace,
}: {
  breadcrumb: string[];
  navigationOpen: boolean;
  onToggleNavigation: () => void;
  workspace: Workspace;
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

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="hidden size-10 place-items-center rounded-full border border-[#e4e0d6] text-slate-600 transition-colors hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary sm:grid"
        >
          <Bell className="size-5" aria-hidden="true" />
        </button>
        <UserMenu workspace={workspace} />
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
          workspace={workspace}
        />
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
