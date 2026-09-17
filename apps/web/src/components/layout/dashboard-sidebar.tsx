import {
  Bell,
  FileText,
  LayoutDashboard,
  PlusSquare,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/applicant/dashboard", icon: LayoutDashboard },
  { label: "New project", href: "/applicant/projects/new", icon: PlusSquare },
  { label: "Applications", href: "/applicant/applications", icon: FileText, badge: 3 },
  { label: "Documents", href: "/applicant/documents", icon: ScrollText },
  { label: "Notifications", href: "/applicant/notifications", icon: Bell, badge: 2 },
  { label: "Verify certificate", href: "/applicant/verify", icon: ShieldCheck },
];

export function DashboardSidebar({ activeHref = "/applicant/dashboard" }: { activeHref?: string }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-[#e4e0d6] bg-[#f7f6f2]">
      {/* Brand */}
      <div className="flex flex-col gap-1 border-b border-[#e4e0d6] px-6 py-5">
        <span className="inline-flex items-center gap-2 text-[#17345a]" translate="no">
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
        <span className="text-sm text-slate-500">Applicant portal</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Workspace">
        <p className="px-2 pb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Workspace
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === activeHref;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-600 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 border-t border-[#e4e0d6] px-6 py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          SP
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#142b45]">Surya Patil</span>
          <span className="block truncate text-xs text-slate-500">Applicant account</span>
        </span>
      </div>
    </aside>
  );
}
