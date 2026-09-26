"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AlertCircle, Loader2, MessageSquareText } from "lucide-react";
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
    <article className="border border-[#d8d3c8] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            {clarification.departmentName}
          </p>
          <h3 className="mt-1 font-semibold text-[#142b45]">
            {project.enterpriseName} · {clarification.approvalTitle}
          </h3>
          <p className="mt-2 text-sm text-slate-700">{clarification.message}</p>
          <p className="mt-2 text-xs text-slate-500">
            {t("applicant.requestedBy", { name: clarification.inspectorName })}
            {clarification.documentName
              ? ` · ${clarification.documentName}`
              : ""}
            {clarification.dueAt
              ? t("applicant.due", { date: formatDate(clarification.dueAt, language) })
              : ""}
          </p>
        </div>
        <span className="border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
          {humanize(clarification.status)}
        </span>
      </div>
      {clarification.responses.map((item) => (
        <div
          key={item.id}
          className="mt-3 border-l-4 border-primary/40 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          <p className="font-semibold text-[#142b45]">{t("applicant.yourResponse")}</p>
          <p className="mt-1">{item.message}</p>
        </div>
      ))}
      {clarification.status !== "resolved" ? (
        <div className="mt-4">
          <label className="text-sm font-semibold text-[#142b45]">
            {t("applicant.response")}
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-[#aeb7c4] bg-white p-3 font-normal"
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
      <div className="flex items-center gap-3 p-8 text-slate-600">
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
    },
    {
      label: "applicant.approvalsInProgress",
      value: String(active),
      note: "applicant.processing",
    },
    {
      label: "applicant.actionNeeded",
      value: String(actionNeeded),
      note: actionNeeded
        ? "applicant.clarificationNeeded"
        : "applicant.noAttention",
    },
    {
      label: "applicant.approvedProjects",
      value: String(
        projects.data.filter((project) => project.status === "approved").length,
      ),
      note: "applicant.completedReview",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#142b45] sm:text-5xl">
            {t("applicant.welcome")}
          </h1>
          <p className="mt-2 text-slate-600">
            {t("applicant.dashboardDescription")}
          </p>
        </div>
        <Button
          render={<Link href="/applicant/projects/new" />}
          size="lg"
          className="h-11 rounded-md px-6"
        >
          {t("applicant.createProject")}
        </Button>
      </div>
      <section className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="rounded-md border-l-4 border-amber-500 bg-white"
          >
            <CardContent className="space-y-2 px-5 py-5">
              <p className="text-sm font-medium text-slate-500">{t(stat.label as TranslationKey)}</p>
              <p className="text-4xl font-bold text-[#142b45]">{stat.value}</p>
              <p className="text-sm text-slate-500">{t(stat.note as TranslationKey)}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      {actionNeeded ? (
        <section className="mt-7">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-700" />
            <h2 className="text-2xl font-bold text-[#142b45]">{t("applicant.actionNeeded")}</h2>
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
      <Card className="mt-7 rounded-md bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-[#142b45]">
            <MessageSquareText className="size-5" /> {t("applicant.currentApplications")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.data.length ? (
            <div className="divide-y divide-[#e4e0d6]">
              {projects.data.map((project) => (
                <Link
                  key={project.id}
                  href={`/applicant/applications/${project.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="font-semibold text-[#142b45]">
                      {project.enterpriseName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {humanize(project.industry)} · {project.district}
                    </p>
                  </div>
                  <StatusBadge status={project.status} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {t("applicant.noApplications")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
