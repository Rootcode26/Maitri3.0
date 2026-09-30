"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  BadgeCheck,
  Clock3,
  FolderKanban,
  Loader2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listProjectClarifications,
  listProjects,
  respondToProjectClarification,
  type ApplicantClarification,
  type ProjectSummary,
} from "@/features/projects/project-api";
import { StatusBadge } from "@/features/projects/status-badge";
import { useLanguage } from "@/components/providers/language-provider";
import { formatDate } from "@/i18n/format";
import type { TranslationKey } from "@/i18n/language/en";

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function ClarificationCard({
  project,
  clarification,
}: {
  project: ProjectSummary;
  clarification: ApplicantClarification;
}) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () =>
      respondToProjectClarification(
        project.id,
        clarification.id,
        response.trim(),
      ),
    onSuccess: (updated) => {
      setResponse("");
      setError(null);
      queryClient.setQueryData(["project-clarifications", project.id], updated);
    },
    onError: (cause) =>
      setError(
        cause instanceof Error ? cause.message : t("applicant.sendError"),
      ),
  });

  return (
    <article className="border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            {clarification.departmentName}
          </p>
          <h3 className="mt-1 font-semibold text-foreground">
            {project.enterpriseName} · {clarification.approvalTitle}
          </h3>
          <p className="mt-2 text-sm text-foreground">{clarification.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("applicant.requestedBy", { name: clarification.inspectorName })}
            {clarification.documentName
              ? ` · ${clarification.documentName}`
              : ""}
            {clarification.dueAt
              ? t("applicant.due", { date: formatDate(clarification.dueAt, language) })
              : ""}
          </p>
        </div>
        <span className="border border-border bg-muted px-2 py-1 text-xs font-semibold text-foreground">
          {humanize(clarification.status)}
        </span>
      </div>
      {clarification.responses.map((item) => (
        <div
          key={item.id}
          className="mt-3 border-l-4 border-primary/40 bg-muted px-4 py-3 text-sm text-foreground"
        >
          <p className="font-semibold text-foreground">{t("applicant.yourResponse")}</p>
          <p className="mt-1">{item.message}</p>
        </div>
      ))}
      {clarification.status !== "resolved" ? (
        <div className="mt-4">
          <label className="text-sm font-semibold text-foreground">
            {t("applicant.response")}
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-input bg-card p-3 font-normal"
              maxLength={2000}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder={t("applicant.responsePlaceholder")}
            />
          </label>
          <Button
            type="button"
            className="mt-3 h-10 rounded-md px-5"
            disabled={send.isPending || response.trim().length < 2}
            onClick={() => send.mutate()}
          >
            {send.isPending ? t("applicant.sending") : t("applicant.sendResponse")}
          </Button>
          {error ? (
            <p
              role="alert"
              className="mt-2 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ApplicantDashboard() {
  const { t } = useLanguage();
  const projects = useQuery({
    queryKey: ["applicant-projects"],
    queryFn: listProjects,
  });
  const clarificationQueries = useQueries({
    queries: (projects.data ?? []).map((project) => ({
      queryKey: ["project-clarifications", project.id],
      queryFn: () => listProjectClarifications(project.id),
    })),
  });
  const clarifications = (projects.data ?? []).flatMap((project, index) =>
    (clarificationQueries[index]?.data ?? []).map((clarification) => ({
      project,
      clarification,
    })),
  );
  const active = (projects.data ?? []).filter(
    (project) => !["draft", "approved", "rejected"].includes(project.status),
  ).length;
  const clarificationActions = clarifications.filter(
    ({ clarification }) => clarification.status !== "resolved",
  ).length;
  const correctionActions = (projects.data ?? []).filter(
    (project) => project.status === "correction_required",
  ).length;
  const actionNeeded = clarificationActions + correctionActions;

  if (projects.isPending)
    return (
      <div className="flex items-center gap-3 p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> {t("applicant.loading")}
      </div>
    );
  if (projects.isError)
    return (
      <div
        role="alert"
        className="m-8 border border-destructive/30 bg-destructive/5 p-6 text-destructive"
      >
        {t("applicant.loadError")}
      </div>
    );

  const stats = [
    {
      label: "applicant.projects",
      value: String(projects.data.length),
      note: "applicant.allStages",
      icon: FolderKanban,
    },
    {
      label: "applicant.approvalsInProgress",
      value: String(active),
      note: "applicant.processing",
      icon: Clock3,
    },
    {
      label: "applicant.actionNeeded",
      value: String(actionNeeded),
      note: actionNeeded
        ? "applicant.clarificationNeeded"
        : "applicant.noAttention",
      icon: AlertCircle,
    },
    {
      label: "applicant.approvedProjects",
      value: String(
        projects.data.filter((project) => project.status === "approved").length,
      ),
      note: "applicant.completedReview",
      icon: BadgeCheck,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-7">
        <div className="max-w-2xl">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("applicant.welcome")}
          </h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            {t("applicant.dashboardDescription")}
          </p>
        </div>
        <Button
          render={<Link href="/applicant/projects/new" />}
          nativeButton={false}
          size="lg"
          className="h-11 rounded-md px-6"
        >
          {t("applicant.createProject")}
        </Button>
      </header>
      <section
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={t("applicant.projects")}
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="rounded-lg bg-card py-0 shadow-sm ring-border/80"
            >
              <CardContent className="flex min-h-40 flex-col px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="pt-1 text-sm font-semibold text-muted-foreground">
                    {t(stat.label as TranslationKey)}
                  </p>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-4 font-heading text-4xl leading-none font-bold tracking-tight text-foreground">
                  {stat.value}
                </p>
                <p className="mt-auto pt-3 text-sm leading-5 text-muted-foreground">
                  {t(stat.note as TranslationKey)}
                </p>
            </CardContent>
          </Card>
          );
        })}
      </section>
      {actionNeeded ? (
        <section className="mt-7">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-700" />
            <h2 className="text-2xl font-bold text-foreground">{t("applicant.actionNeeded")}</h2>
          </div>
          <div className="mt-4 space-y-4">
            {clarifications
              .filter(
                ({ clarification }) => clarification.status !== "resolved",
              )
              .map(({ project, clarification }) => (
                <ClarificationCard
                  key={clarification.id}
                  project={project}
                  clarification={clarification}
                />
              ))}
          </div>
        </section>
      ) : null}
      <Card className="mt-7 gap-0 rounded-lg bg-card py-0 shadow-sm ring-border/80">
        <CardHeader className="border-b border-border px-5 py-5 sm:px-6">
          <CardTitle className="flex items-center gap-3 text-xl font-semibold text-foreground">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <MessageSquareText className="size-4.5" aria-hidden="true" />
            </span>
            {t("applicant.currentApplications")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          {projects.data.length ? (
            <div className="divide-y divide-border">
              {projects.data.map((project) => (
                <Link
                  key={project.id}
                  href={`/applicant/applications/${project.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {project.enterpriseName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {humanize(project.industry)} · {project.district}
                    </p>
                  </div>
                  <StatusBadge status={project.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start justify-between gap-5 rounded-lg border border-dashed border-primary/25 bg-primary/[0.04] px-5 py-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <Sparkles
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("applicant.noApplications")}
                </p>
              </div>
              <Button
                render={<Link href="/applicant/projects/new" />}
                nativeButton={false}
                variant="outline"
                className="h-10 shrink-0 bg-card"
              >
                {t("applicant.createProject")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
