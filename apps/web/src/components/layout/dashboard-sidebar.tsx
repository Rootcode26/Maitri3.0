import {
  BadgeCheck,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  Inbox,
  LayoutDashboard,
  MessageSquareText,
  PlusSquare,
  ScrollText,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { useLanguage } from "@/components/providers/language-provider";
import type { TranslationKey } from "@/i18n/language/en";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  ready?: boolean;
};

const applicantNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/applicant/dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  {
    label: "New project",
    href: "/applicant/projects/new",
    icon: PlusSquare,
    ready: true,
  },
  {
    label: "Applications",
    href: "/applicant/applications",
    icon: FileText,
    ready: true,
  },
  {
    label: "Documents",
    href: "/applicant/documents",
    icon: ScrollText,
    ready: true,
  },
  { label: "Notifications", href: "/applicant/notifications", icon: Bell, ready: true },
  {
    label: "Verify certificate",
    href: "/applicant/verify",
    icon: ShieldCheck,
    ready: true,
  },
];

const inspectorNavItems: NavItem[] = [
  {
    label: "Review queue",
    href: "/inspector/dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  {
    label: "Applications",
    href: "/inspector/applications",
    icon: Inbox,
    ready: true,
  },
  {
    label: "Site inspections",
    href: "/inspector/inspections",
    icon: CalendarDays,
    ready: true,
  },
  {
    label: "Clarifications",
    href: "/inspector/clarifications",
    icon: MessageSquareText,
    ready: true,
  },
  {
    label: "Decisions",
    href: "/inspector/decisions",
    icon: BadgeCheck,
    ready: true,
  },
  {
    label: "Reports",
    href: "/inspector/reports",
    icon: ChartNoAxesCombined,
    ready: true,
  },
];

export function DashboardSidebar({
  activeHref = "/applicant/dashboard",
  workspace = "applicant",
  className,
  id,
  onClose,
}: {
  activeHref?: string;
  workspace?: "applicant" | "inspector";
  className?: string;
  id?: string;
  onClose?: () => void;
}) {
  const { t } = useLanguage();
  const translationKeys: TranslationKey[] = ["nav.dashboard", "nav.newProject", "nav.applications", "nav.documents", "nav.notifications", "nav.verifyCertificate"];
  const navItems = workspace === "inspector"
    ? inspectorNavItems.map((item, index) => ({
        ...item,
        label: index === 0 ? t("nav.reviewQueue") : item.label,
      }))
    : applicantNavItems.map((item, index) => ({
        ...item,
        label: t(translationKeys[index]!),
      }));
  return (
    <aside
      id={id}
      className={cn(
        "flex h-svh w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-muted lg:sticky lg:top-0",
        className,
      )}
    >
      {/* Brand */}
      <div className="flex flex-col gap-1 border-b border-border px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-2 text-foreground"
            translate="no"
          >
            <Image
              src="/images/udyogsetu-emblem.svg"
              alt=""
              width={36}
              height={36}
              aria-hidden="true"
              className="shrink-0"
            />
            <span className="text-xl font-bold tracking-tight">UdyogSetu</span>
          </span>
          {onClose ? (
            <button
              type="button"
              aria-label={t("dashboard.closeNavigation")}
              onClick={onClose}
              className="grid size-10 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-card focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <span className="text-sm text-muted-foreground">
          {workspace === "inspector" ? t("nav.inspectorPortal") : t("nav.applicantPortal")}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label={t("nav.workspace")}>
        <p className="px-2 pb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("nav.workspace")}
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            if (!item.ready) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground"
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t("nav.soon")}
                    </span>
                  </span>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 border-t border-border px-6 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <UserRound className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">
            {t("nav.yourAccount")}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {workspace === "inspector"
              ? t("nav.inspectorAccount")
              : t("nav.applicantAccount")}
          </span>
        </span>
      </div>
    </aside>
  );
}
