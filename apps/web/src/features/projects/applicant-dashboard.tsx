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
        cause instanceof Error ? cause.message : "Could not send response.",
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
            Requested by {clarification.inspectorName}
            {clarification.documentName
              ? ` · regarding ${clarification.documentName}`
              : ""}
            {clarification.dueAt
              ? ` · due ${new Date(clarification.dueAt).toLocaleDateString("en-IN")}`
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
          <p className="font-semibold text-[#142b45]">Your response</p>
          <p className="mt-1">{item.message}</p>
        </div>
      ))}
      {clarification.status !== "resolved" ? (
        <div className="mt-4">
          <label className="text-sm font-semibold text-[#142b45]">
            Response
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-[#aeb7c4] bg-white p-3 font-normal"
              maxLength={2000}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="Provide the requested information or explain the correction made."
            />
          </label>
          <Button
            type="button"
            className="mt-3 h-10 rounded-md px-5"
            disabled={send.isPending || response.trim().length < 2}
            onClick={() => send.mutate()}
          >
            {send.isPending ? "Sending…" : "Send response"}
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
  const actionNeeded = clarifications.filter(
    ({ clarification }) => clarification.status !== "resolved",
  ).length;

  if (projects.isPending)
    return (
      <div className="flex items-center gap-3 p-8 text-slate-600">
        <Loader2 className="size-5 animate-spin" /> Loading workspace…
      </div>
    );
  if (projects.isError)
    return (
      <div
        role="alert"
        className="m-8 border border-destructive/30 bg-destructive/5 p-6 text-destructive"
      >
        Could not load your applicant workspace.
      </div>
    );

  const stats = [
    {
      label: "Projects",
      value: String(projects.data.length),
      note: "Across all stages",
    },
    {
      label: "Approvals in progress",
      value: String(active),
      note: "Currently being processed",
    },
    {
      label: "Action needed",
      value: String(actionNeeded),
      note: actionNeeded
        ? "Clarifications need a response"
        : "Nothing needs attention",
    },
    {
      label: "Approved projects",
      value: String(
        projects.data.filter((project) => project.status === "approved").length,
      ),
      note: "Completed review",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#142b45] sm:text-5xl">
            Welcome back
          </h1>
          <p className="mt-2 text-slate-600">
            Track projects and respond to departmental clarification requests.
          </p>
        </div>
        <Button
          render={<Link href="/applicant/projects/new" />}
          size="lg"
          className="h-11 rounded-md px-6"
        >
          Create new project
        </Button>
      </div>
      <section className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="rounded-md border-l-4 border-amber-500 bg-white"
          >
            <CardContent className="space-y-2 px-5 py-5">
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-4xl font-bold text-[#142b45]">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      {actionNeeded ? (
        <section className="mt-7">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-700" />
            <h2 className="text-2xl font-bold text-[#142b45]">Action needed</h2>
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
            <MessageSquareText className="size-5" /> Current applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.data.length ? (
            <div className="divide-y divide-[#e4e0d6]">
              {projects.data.map((project) => (
                <div
                  key={project.id}
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
                  <span className="border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                    {humanize(project.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              You have no applications yet. Start by creating a new project.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
