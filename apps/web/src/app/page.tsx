import { ArrowRight, ClipboardCheck, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { SessionPanel } from "@/features/auth/session-panel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const workspaces = [
  { title: "Applicant login", description: "Register a business, identify approvals, submit documents and track decisions.", href: "/auth/login", icon: UserRound, accent: "border-t-[#2f699a]", iconStyle: "bg-blue-50 text-[#2f699a]", badge: "Registration available", badgeStyle: "bg-emerald-50 text-emerald-800" },
  { title: "Inspector login", description: "Review assigned applications, raise queries, schedule visits and record decisions.", href: "/inspector/login", icon: ClipboardCheck, accent: "border-t-amber-500", iconStyle: "bg-amber-50 text-amber-700", badge: "Authorised inspectors only", badgeStyle: "bg-slate-100 text-slate-700" },
];

export default function Home() {
  return (
    <div className="min-h-svh bg-background">
      <a href="#main-content" className="sr-only z-50 bg-white p-3 text-[#142b45] focus:fixed focus:top-4 focus:left-4 focus:not-sr-only">Skip to main content</a>
      <SiteHeader actionLabel="About the portal" actionHref="#portal-note" />
      <main id="main-content" className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 md:py-16 lg:px-10">
        <SessionPanel />
        <section className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">Secure portal access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#142b45] sm:text-4xl">Choose your workspace</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Applicant and inspector access are separated by workspace.</p>
        </section>
        <section aria-label="Available workspaces" className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;
            return (
              <Card key={workspace.title} className={`rounded-md border border-t-4 border-slate-200 bg-white py-0 shadow-[0_10px_30px_rgba(20,43,69,0.06)] ring-0 transition-transform duration-200 hover:-translate-y-0.5 ${workspace.accent}`}>
                <CardHeader className="flex-row items-start justify-between gap-5 px-6 pt-7 sm:px-8">
                  <span className={`grid size-12 place-items-center rounded-md ${workspace.iconStyle}`}><Icon className="size-6" aria-hidden="true" /></span>
                  <Link href={workspace.href} className="flex min-h-11 items-center gap-2 rounded-sm px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-primary">Continue <ArrowRight aria-hidden="true" /></Link>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-7 sm:px-8">
                  <div><h2 className="text-xl font-semibold text-[#142b45] sm:text-2xl">{workspace.title}</h2><p className="mt-2 max-w-lg leading-7 text-slate-600">{workspace.description}</p></div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${workspace.badgeStyle}`}>{workspace.badge}</span>
                </CardContent>
              </Card>
            );
          })}
        </section>
        <aside id="portal-note" className="mt-8 flex gap-3 border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p><strong>Secure access:</strong> Authentication is connected to the portal API. Access remains limited by account role and department.</p>
        </aside>
      </main>
    </div>
  );
}
