"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { listProjects } from "@/features/projects/project-api";
import { humanizeStatus, StatusBadge, translateStatus } from "@/features/projects/status-badge";
import { useLanguage } from "@/components/providers/language-provider";
import { formatDate } from "@/i18n/format";

const statuses = [
  "all",
  "draft",
  "submitted",
  "under_review",
  "correction_required",
  "approved",
  "rejected",
] as const;

export function ApplicantApplications() {
  const { language, t, text } = useLanguage();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const query = useQuery({
    queryKey: ["applicant-projects"],
    queryFn: listProjects,
  });
  const projects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (project) =>
        (status === "all" || project.status === status) &&
        (!term ||
          `${project.enterpriseName} ${project.district} ${project.industry}`
            .toLowerCase()
            .includes(term)),
    );
  }, [query.data, search, status]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">
            {text("Applicant workspace")}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-[#142b45] sm:text-4xl">
            {text("Applications")}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            {text("Review every project, follow departmental progress and address requests that need your attention.")}
          </p>
        </div>
        <Button
          render={<Link href="/applicant/projects/new" />}
          className="h-11 rounded-md px-5"
        >
          {text("Create new project")}
        </Button>
      </header>
      <div className="mt-7 grid gap-3 border-y border-[#e4e0d6] py-4 md:grid-cols-[1fr_15rem]">
        <label className="relative block">
          <span className="sr-only">{text("Search applications")}</span>
          <Search
            className="pointer-events-none absolute top-3 left-3 size-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-md border border-[#aeb7c4] bg-white pr-3 pl-10 text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
            placeholder={text("Search by enterprise, district or industry")}
          />
        </label>
        <label>
          <span className="sr-only">{text("Filter by application status")}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-11 w-full rounded-md border border-[#aeb7c4] bg-white px-3 text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? t("status.all") : translateStatus(t, item)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <div className="mt-8 flex items-center gap-3 border border-[#e4e0d6] p-8 text-slate-600">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {text("Loading applications…")}
        </div>
      ) : query.isError ? (
        <div
          role="alert"
          className="mt-8 border border-destructive/30 bg-destructive/5 p-6 text-destructive"
        >
          <p className="font-semibold">{text("Applications could not be loaded.")}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-10"
            onClick={() => query.refetch()}
          >
            {t("common.tryAgain")}
          </Button>
        </div>
      ) : projects.length ? (
        <ul className="mt-6 divide-y divide-[#e4e0d6] border-y border-[#e4e0d6]">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/applicant/applications/${project.id}`}
                className="group grid min-h-28 gap-4 px-2 py-5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="truncate text-lg font-semibold text-[#142b45] group-hover:text-primary">
                      {project.enterpriseName}
                    </h2>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {text(humanizeStatus(project.industry))} · {text(project.district)} ·{" "}
                    {text(project.primaryActivity)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("common.created", { date: formatDate(project.createdAt, language) })}
                    {project.submittedAt
                      ? ` · ${t("common.submitted", { date: formatDate(project.submittedAt, language) })}`
                      : ""}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  {text("Open application")}{" "}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 border border-dashed border-[#aeb7c4] p-10 text-center">
          <FileText
            className="mx-auto size-8 text-slate-400"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-lg font-semibold text-[#142b45]">
            {query.data?.length
              ? text("No matching applications")
              : text("No applications yet")}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {query.data?.length
              ? text("Change the search or status filter.")
              : text("Create your first project to begin the approval journey.")}
          </p>
        </div>
      )}
    </div>
  );
}
