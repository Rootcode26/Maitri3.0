import Link from "next/link";

export function PortalBrand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const light = tone === "light";

  return (
    <span
      className={`inline-flex items-center gap-3 ${light ? "text-white" : "text-[#17345a]"}`}
      translate="no"
    >
      <span className="flex h-8 items-end gap-1" aria-hidden="true">
        <span
          className={`h-4 w-1.5 -skew-x-12 rounded-sm ${light ? "bg-white" : "bg-[#bd963a]"}`}
        />
        <span
          className={`h-6 w-1.5 -skew-x-12 rounded-sm ${light ? "bg-white" : "bg-[#bd963a]"}`}
        />
        <span
          className={`h-8 w-1.5 -skew-x-12 rounded-sm ${light ? "bg-white" : "bg-[#bd963a]"}`}
        />
      </span>
      <span className="text-xl font-bold tracking-tight sm:text-2xl">
        UdyogSetu
      </span>
    </span>
  );
}

export function SiteHeader({ actionLabel = "Return home", actionHref = "/" }) {
  return (
    <header className="border-b border-white/10 bg-[#142b45] text-white">
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="rounded-sm focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <PortalBrand tone="light" />
          <span className="block text-xs text-slate-300 sm:text-sm">
            Industrial Approval Portal
          </span>
        </Link>
        <Link
          href={actionHref}
          className="min-h-11 rounded-sm px-2 py-3 text-sm font-medium underline underline-offset-4 hover:text-slate-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
        >
          {actionLabel}
        </Link>
      </div>
    </header>
  );
}
