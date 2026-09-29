"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, type ReactNode, useEffect, useState } from "react";

import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { LanguageSelector } from "@/components/layout/language-selector";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { getCurrentSession, logoutSession } from "@/lib/auth-api";
import { localPreviewEnabled } from "@/lib/local-preview";

type Workspace = "applicant" | "inspector";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = (parts[0]![0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "");
  return letters.toUpperCase() || "?";
}

function UserMenu({ workspace }: { workspace: Workspace }) {
  const { text } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const loginHref = workspace === "inspector" ? "/inspector/login" : "/auth/login";

  const session = useQuery({
    queryKey: ["session"],
    queryFn: getCurrentSession,
    staleTime: 60_000,
    enabled: !localPreviewEnabled,
  });
  const logout = useMutation({
    mutationFn: logoutSession,
    onSuccess: () => {
      queryClient.setQueryData(["session"], null);
      router.replace(loginHref);
    },
  });

  const user = session.data ?? (localPreviewEnabled
    ? {
        name: workspace === "inspector" ? "Preview Inspector" : "Preview Applicant",
        role: workspace,
      }
    : null);
  const roleLabel =
    user?.role === "inspector"
      ? text("Inspector")
      : user?.role === "applicant"
        ? text("Applicant")
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
              {logout.isPending ? text("Signing out…") : text("Sign out")}
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
  const { t, text } = useLanguage();
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[#e4e0d6] bg-[#f7f6f2] px-4 py-3 sm:gap-6 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={t("dashboard.toggleNavigation")}
          aria-expanded={navigationOpen}
          aria-controls="mobile-workspace-navigation"
          onClick={onToggleNavigation}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-[#e4e0d6] text-slate-600 transition-colors hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <nav className="min-w-0" aria-label={t("dashboard.breadcrumb")}>
          <ol className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
            {breadcrumb.map((crumb, i) => {
              const last = i === breadcrumb.length - 1;
              const breadcrumbKey = ({
                Home: "breadcrumb.home",
                Applicant: "breadcrumb.applicant",
                Inspector: "breadcrumb.inspector",
                Dashboard: "breadcrumb.dashboard",
                Applications: "breadcrumb.applications",
                Documents: "breadcrumb.documents",
                Projects: "breadcrumb.projects",
                "New project": "breadcrumb.newProject",
                "Review queue": "breadcrumb.reviewQueue",
                Application: "breadcrumb.application",
                Details: "breadcrumb.details",
              } as const)[crumb as "Home"];
              return (
                <Fragment key={crumb}>
                  <li
                    className={
                      last
                        ? "min-w-0 truncate font-semibold text-[#142b45]"
                        : "hidden sm:block"
                    }
                    aria-current={last ? "page" : undefined}
                  >
                    {breadcrumbKey ? t(breadcrumbKey) : text(crumb)}
                  </li>
                  {!last && (
                    <ChevronRight
                      className="hidden size-4 shrink-0 text-slate-400 sm:block"
                      aria-hidden="true"
                    />
                  )}
                </Fragment>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <LanguageSelector />
        <NotificationBell workspace={workspace} />
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
  const { t } = useLanguage();
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
    <div className="flex min-h-svh overflow-x-clip bg-[#f7f6f2]">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-white px-4 py-3 font-semibold text-[#17345a] shadow-lg focus:fixed focus:top-4 focus:left-4 focus:not-sr-only focus-visible:outline-3 focus-visible:outline-primary"
      >
        {t("home.skip")}
      </a>
      <DashboardSidebar
        activeHref={activeHref}
        workspace={workspace}
        className="hidden lg:flex"
      />
      {navigationOpen ? (
        <>
          <button
            type="button"
            aria-label={t("dashboard.dismissNavigation")}
            className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
            onClick={() => setNavigationOpen(false)}
          />
          <DashboardSidebar
            id="mobile-workspace-navigation"
            activeHref={activeHref}
            workspace={workspace}
            onClose={() => setNavigationOpen(false)}
            className="fixed inset-y-0 left-0 z-50 flex max-w-[85vw] overscroll-contain shadow-xl lg:hidden"
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
