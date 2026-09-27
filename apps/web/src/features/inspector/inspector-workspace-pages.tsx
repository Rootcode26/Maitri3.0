"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { useLanguage } from "@/components/providers/language-provider";
import type { Language } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import type { TranslationKey } from "@/i18n/language/en";
import { translateStatus } from "@/features/projects/status-badge";
import {
  getInspectorReport,
  listInspectorApplications,
  listInspectorClarifications,
  listInspectorDecisions,
  listInspectorInspections,
  scheduleInspection,
  updateInspection,
  type AttentionLevel,
  type ClarificationStatus,
  type InspectionOutcome,
  type InspectionStatus,
  type InspectorDecisionSummary,
  type ReviewStatus,
} from "@/features/inspector/inspector-api";

const reviewTone: Record<ReviewStatus, "blue" | "amber" | "green" | "red" | "slate"> = {
  pending: "blue",
  under_review: "blue",
  correction_required: "amber",
  approved: "green",
  rejected: "red",
};

const attentionTone: Record<AttentionLevel, "green" | "amber" | "red"> = {
  standard: "green",
  elevated: "amber",
  high_attention: "red",
};

const primaryAction =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";
const secondaryAction =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#cfd4dc] bg-white px-4 text-sm font-semibold text-[#142b45] transition-colors hover:bg-[#f7f6f2] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

function PageIntro({
  section,
  title,
  description,
  action,
}: {
  section: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-[#d8d3c8] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">{section}</p>
        <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight text-[#142b45]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "blue" | "amber" | "green" | "red" | "slate";
  children: ReactNode;
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MetricStrip({
  items,
}: {
  items: { label: string; value: string; note: string; tone?: string }[];
}) {
  return (
    <section className="grid border border-[#d8d3c8] bg-white sm:grid-cols-2 xl:grid-cols-4" aria-label="Queue summary">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`p-5 ${index ? "border-t border-[#e4e0d6] sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 xl:border-l" : ""}`}
        >
          <p className="text-sm font-medium text-slate-500">{item.label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${item.tone ?? "text-[#142b45]"}`}>
            {item.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.note}</p>
        </div>
      ))}
    </section>
  );
}

const applicationFilters: { label: string; value?: ReviewStatus }[] = [
  { label: "status.all" },
  { label: "status.pending", value: "pending" },
  { label: "status.under_review", value: "under_review" },
  { label: "status.correction_required", value: "correction_required" },
  { label: "status.approved", value: "approved" },
  { label: "status.rejected", value: "rejected" },
];

export function InspectorApplicationsPage() {
  const { t, text, language } = useLanguage();
  const [filter, setFilter] = useState<ReviewStatus | undefined>();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["inspector-applications", filter, search],
    queryFn: () => listInspectorApplications(filter, search),
  });
  const rows = query.data?.applications ?? [];
  const total = query.data?.pagination.total ?? 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageIntro
        section={t("inspector.departmentReview")}
        title={t("nav.applications")}
        description={t("inspector.queueDescription")}
      />

      <div className="mt-7 space-y-5">
        <label className="relative block max-w-md">
          <span className="sr-only">{t("inspector.search")}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("inspector.searchPlaceholder")}
            className="h-11 w-full rounded-md border border-[#cfd4dc] bg-white pr-3 pl-10 text-sm text-[#142b45] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2" aria-label={t("inspector.filterQueue")}>
          {applicationFilters.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value ?? "all"}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`h-10 rounded-md px-4 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "border border-[#cfd4dc] bg-white text-[#142b45] hover:bg-[#f7f6f2]"}`}
              >
                {t(item.label as "status.all")}
              </button>
            );
          })}
        </div>

        {query.isPending ? (
          <div className="flex items-center gap-3 border border-[#e4e0d6] bg-white p-6 text-slate-600">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t("inspector.loading")}
          </div>
        ) : query.isError ? (
          <div role="alert" className="border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            {t("inspector.loadError")}
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-[#e4e0d6] bg-[#faf9f6] p-10 text-center">
            <h2 className="text-xl font-semibold text-[#142b45]">{t("inspector.noApplications")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("inspector.emptyQueue")}</p>
          </div>
        ) : (
          <section className="overflow-hidden border border-[#d8d3c8] bg-white" aria-labelledby="applications-table-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e0d6] px-5 py-4">
              <h2 id="applications-table-title" className="font-semibold text-[#142b45]">
                {t("inspector.queue")}
              </h2>
              <span className="text-xs font-medium text-slate-500">
                {t("common.assigned", { count: total })}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead className="bg-[#f7f6f2] text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3">{t("inspector.applicantProject")}</th>
                    <th className="px-4 py-3">{t("inspector.reviewResult")}</th>
                    <th className="px-4 py-3">{t("inspector.applicant")}</th>
                    <th className="px-4 py-3">{t("common.submitted", { date: "" })}</th>
                    <th className="px-4 py-3">{t("inspector.due")}</th>
                    <th className="px-4 py-3">{t("attention.columnLabel")}</th>
                    <th className="px-4 py-3">{t("status.submitted")}</th>
                    <th className="px-5 py-3"><span className="sr-only">{t("common.open")}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e0d6]">
                  {rows.map((item) => (
                    <tr key={item.approvalId} className="align-top hover:bg-[#fcfbf8]">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#142b45]">{item.enterpriseName}</p>
                        <p className="mt-1 text-xs text-slate-500 capitalize">
                          {text(item.industry)} · {text(item.district)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.approvalTitle}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{item.applicantName}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {formatDate(item.submittedAt, language)}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {item.dueAt ? (
                          <span className="flex flex-col gap-1">
                            <span className={item.overdue ? "font-semibold text-red-700" : "text-slate-600"}>
                              {formatDate(item.dueAt, language)}
                            </span>
                            {item.overdue ? (
                              <StatusPill tone="red">{t("inspector.overdue")}</StatusPill>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {item.attentionLevel ? (
                          <StatusPill tone={attentionTone[item.attentionLevel]}>
                            {t(`attention.${item.attentionLevel}` as "attention.standard")}
                            {item.attentionScore !== null ? ` · ${item.attentionScore}` : ""}
                          </StatusPill>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill tone={reviewTone[item.reviewStatus]}>
                          {translateStatus(t, item.reviewStatus)}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/inspector/applications/${item.projectId}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                        >
                          {t("inspector.openReview")} <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const inspectionTone: Record<InspectionStatus, "blue" | "green" | "slate"> = {
  scheduled: "blue",
  completed: "green",
  cancelled: "slate",
};

const inspectionStatusKey: Record<InspectionStatus, TranslationKey> = {
  scheduled: "inspections.statusScheduled",
  completed: "inspections.statusCompleted",
  cancelled: "inspections.statusCancelled",
};

const outcomeKey: Record<InspectionOutcome, TranslationKey> = {
  satisfactory: "inspections.outcomeSatisfactory",
  needs_follow_up: "inspections.outcomeNeedsFollowUp",
  failed: "inspections.outcomeFailed",
};

const outcomeOptions: InspectionOutcome[] = ["satisfactory", "needs_follow_up", "failed"];

export function InspectorInspectionsPage() {
  const { t, text, language } = useLanguage();
  const queryClient = useQueryClient();
  const inspections = useQuery({
    queryKey: ["inspector-inspections"],
    queryFn: listInspectorInspections,
  });
  const applications = useQuery({
    queryKey: ["inspector-applications", undefined],
    queryFn: () => listInspectorApplications(),
  });

  const [approvalId, setApprovalId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["inspector-inspections"] });

  const schedule = useMutation({
    mutationFn: async () => {
      const app = applications.data?.applications.find((a) => a.approvalId === approvalId);
      if (!app || !scheduledAt) throw new Error("incomplete");
      return scheduleInspection({
        projectId: app.projectId,
        approvalId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      setApprovalId("");
      setScheduledAt("");
      setNotes("");
      setFormError(null);
      invalidate();
    },
    onError: () => setFormError(t("inspections.scheduleError")),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof updateInspection>[1] }) =>
      updateInspection(vars.id, vars.input),
    onSuccess: invalidate,
  });

  const rows = inspections.data ?? [];
  const openApplications = applications.data?.applications ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageIntro
        section={t("inspector.departmentReview")}
        title={t("inspections.title")}
        description={t("inspections.description")}
      />

      <div className="mt-7 space-y-6">
        <section className="border border-[#d8d3c8] bg-white p-5">
          <h2 className="font-semibold text-[#142b45]">{t("inspections.scheduleHeading")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-[#142b45]">{t("inspections.selectApplication")}</span>
              <select
                value={approvalId}
                onChange={(event) => setApprovalId(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-[#cfd4dc] bg-white px-3 text-sm"
              >
                <option value="">—</option>
                {openApplications.map((app) => (
                  <option key={app.approvalId} value={app.approvalId}>
                    {app.enterpriseName} · {app.approvalTitle}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-[#142b45]">{t("inspections.date")}</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-[#cfd4dc] bg-white px-3 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-[#142b45]">{t("inspections.notes")}</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-md border border-[#cfd4dc] p-3 text-sm"
              />
            </label>
          </div>
          {formError ? (
            <p role="alert" className="mt-3 text-sm font-medium text-destructive">
              {formError}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!approvalId || !scheduledAt || schedule.isPending}
            onClick={() => schedule.mutate()}
            className={`${primaryAction} mt-4 disabled:opacity-60`}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            {schedule.isPending ? t("inspections.scheduling") : t("inspections.schedule")}
          </button>
        </section>

        {inspections.isPending ? (
          <div className="flex items-center gap-3 border border-[#e4e0d6] bg-white p-6 text-slate-600">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t("inspector.loading")}
          </div>
        ) : inspections.isError ? (
          <div role="alert" className="border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            {t("inspector.loadError")}
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-[#e4e0d6] bg-[#faf9f6] p-10 text-center">
            <h2 className="text-xl font-semibold text-[#142b45]">{t("inspections.empty")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("inspections.emptyHint")}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((item) => (
              <li key={item.id} className="border border-[#d8d3c8] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={inspectionTone[item.status]}>
                        {t(inspectionStatusKey[item.status])}
                      </StatusPill>
                      {item.outcome ? (
                        <StatusPill tone="slate">{t(outcomeKey[item.outcome])}</StatusPill>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-[#142b45]">{item.enterpriseName}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.approvalTitle} · {text(item.district)}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
                      <CalendarDays className="size-4 text-slate-400" aria-hidden="true" />
                      {formatDate(item.scheduledAt, language)}
                    </p>
                    {item.notes ? (
                      <p className="mt-2 text-sm text-slate-600">{item.notes}</p>
                    ) : null}
                  </div>
                  {item.status === "scheduled" ? (
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        {t("inspections.completeAs")}
                      </span>
                      <div className="flex flex-wrap justify-end gap-2">
                        {outcomeOptions.map((outcome) => (
                          <button
                            key={outcome}
                            type="button"
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate({ id: item.id, input: { status: "completed", outcome } })
                            }
                            className={secondaryAction}
                          >
                            {t(outcomeKey[outcome])}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: item.id, input: { status: "cancelled" } })}
                          className={secondaryAction}
                        >
                          {t("inspections.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const clarificationTone: Record<ClarificationStatus, "amber" | "green" | "slate"> = {
  open: "amber",
  responded: "green",
  resolved: "slate",
};

export function InspectorClarificationsPage() {
  const { t, text, language } = useLanguage();
  const query = useQuery({
    queryKey: ["inspector-clarifications"],
    queryFn: listInspectorClarifications,
  });
  const rows = query.data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageIntro
        section={t("inspector.departmentReview")}
        title={t("clarifications.title")}
        description={t("clarifications.description")}
      />
      <div className="mt-7">
        {query.isPending ? (
          <div className="flex items-center gap-3 border border-[#e4e0d6] bg-white p-6 text-slate-600">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t("inspector.loading")}
          </div>
        ) : query.isError ? (
          <div role="alert" className="border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            {t("inspector.loadError")}
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-[#e4e0d6] bg-[#faf9f6] p-10 text-center">
            <h2 className="text-xl font-semibold text-[#142b45]">{t("clarifications.empty")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("clarifications.emptyHint")}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {rows.map((item) => (
              <li key={item.id} className="border border-[#d8d3c8] bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={clarificationTone[item.status]}>
                        {translateStatus(t, item.status)}
                      </StatusPill>
                      {item.dueAt ? (
                        <span className="text-xs text-slate-500">
                          {t("inspector.dateDue", { date: formatDate(item.dueAt, language) })}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-[#142b45]">{item.enterpriseName}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.approvalTitle} · {text(item.district)}
                    </p>
                    <p className="mt-3 text-sm text-slate-700">{item.message}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      {t("clarifications.replies", { count: item.responseCount })} ·{" "}
                      {t("common.applicant", { name: item.applicantName })}
                    </p>
                  </div>
                  <Link href={`/inspector/applications/${item.projectId}`} className={secondaryAction}>
                    {t("inspector.openReview")} <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DecisionRow({
  item,
  t,
  text,
  language,
}: {
  item: InspectorDecisionSummary;
  t: (key: TranslationKey, values?: Record<string, string | number | Date>) => string;
  text: (source: string) => string;
  language: Language;
}) {
  return (
    <article className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <StatusPill tone={reviewTone[item.reviewStatus]}>
            {translateStatus(t, item.reviewStatus)}
          </StatusPill>
          <h3 className="mt-3 text-lg font-semibold text-[#142b45]">{item.enterpriseName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {item.approvalTitle} · {text(item.district)}
          </p>
          {item.decidedAt ? (
            <p className="mt-2 text-xs text-slate-500">
              {t("common.submitted", { date: formatDate(item.decidedAt, language) })}
              {item.decidedByName
                ? ` · ${t("decisions.decidedBy", { name: item.decidedByName })}`
                : ""}
            </p>
          ) : null}
          {item.decisionNote ? (
            <p className="mt-2 text-sm text-slate-700">{item.decisionNote}</p>
          ) : null}
        </div>
        <Link href={`/inspector/applications/${item.projectId}`} className={primaryAction}>
          {t("inspector.openReview")} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function InspectorDecisionsPage() {
  const { t, text, language } = useLanguage();
  const query = useQuery({
    queryKey: ["inspector-decisions"],
    queryFn: listInspectorDecisions,
  });
  const rows = query.data ?? [];
  const ready = rows.filter((row) => row.reviewStatus === "under_review");
  const decided = rows.filter((row) => row.decidedAt !== null);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageIntro
        section={t("inspector.departmentReview")}
        title={t("decisions.title")}
        description={t("decisions.description")}
      />
      <div className="mt-7 space-y-6">
        {query.isPending ? (
          <div className="flex items-center gap-3 border border-[#e4e0d6] bg-white p-6 text-slate-600">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t("inspector.loading")}
          </div>
        ) : query.isError ? (
          <div role="alert" className="border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            {t("inspector.loadError")}
          </div>
        ) : (
          <>
            <section className="border border-[#d8d3c8] bg-white">
              <div className="border-b border-[#e4e0d6] px-5 py-4">
                <h2 className="font-semibold text-[#142b45]">{t("decisions.readyHeading")}</h2>
              </div>
              {ready.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">{t("decisions.readyEmpty")}</p>
              ) : (
                <div className="divide-y divide-[#e4e0d6]">
                  {ready.map((item) => (
                    <DecisionRow
                      key={item.approvalId}
                      item={item}
                      t={t}
                      text={text}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="border border-[#d8d3c8] bg-white">
              <div className="border-b border-[#e4e0d6] px-5 py-4">
                <h2 className="font-semibold text-[#142b45]">{t("decisions.registerHeading")}</h2>
              </div>
              {decided.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">{t("decisions.registerEmpty")}</p>
              ) : (
                <div className="divide-y divide-[#e4e0d6]">
                  {decided.map((item) => (
                    <DecisionRow
                      key={item.approvalId}
                      item={item}
                      t={t}
                      text={text}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function ProgressRow({ label, value, note, tone = "bg-primary" }: { label: string; value: number; note: string; tone?: string }) {
  return <div><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#142b45]">{label}</p><p className="mt-0.5 text-xs text-slate-500">{note}</p></div><span className="text-sm font-bold text-[#142b45]">{value}%</span></div><div className="mt-2 h-2 overflow-hidden bg-slate-100"><div className={`h-full ${tone}`} style={{ width: `${value}%` }} /></div></div>;
}

export function InspectorReportsPage() {
  const { t } = useLanguage();
  const query = useQuery({ queryKey: ["inspector-report"], queryFn: getInspectorReport });

  if (query.isPending) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="flex items-center gap-3 border border-[#e4e0d6] bg-white p-6 text-slate-600">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t("inspector.loading")}
        </div>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div role="alert" className="border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          {t("inspector.loadError")}
        </div>
      </div>
    );
  }

  const report = query.data;
  const { totals } = report;

  const waiting: [number, string][] = [
    [totals.pending, t("status.pending")],
    [totals.underReview, t("status.under_review")],
    [totals.correctionRequired, t("status.correction_required")],
    [report.clarifications.open, t("reports.openClarifications")],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageIntro
        section={t("inspector.departmentReview")}
        title={t("reports.title")}
        description={t("reports.description")}
      />
      <div className="mt-7 space-y-6">
        <MetricStrip
          items={[
            { label: t("reports.assigned"), value: String(totals.assigned), note: t("reports.assignedNote") },
            {
              label: t("reports.decided"),
              value: String(totals.decided),
              note: t("reports.decidedNote", { approved: totals.approved, rejected: totals.rejected }),
              tone: "text-emerald-700",
            },
            { label: t("reports.awaiting"), value: String(totals.pending + totals.underReview), note: t("reports.awaitingNote") },
            {
              label: t("reports.avgDays"),
              value: report.averageDecisionDays !== null ? report.averageDecisionDays.toFixed(1) : "—",
              note: t("reports.avgDaysNote"),
              tone: "text-emerald-700",
            },
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="border border-[#d8d3c8] bg-white p-6">
            <h2 className="font-semibold text-[#142b45]">{t("reports.byApproval")}</h2>
            {report.byApproval.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t("reports.noData")}</p>
            ) : (
              <div className="mt-6 space-y-6">
                {report.byApproval.map((item) => {
                  const rate = item.total ? Math.round((item.approved / item.total) * 100) : 0;
                  return (
                    <ProgressRow
                      key={item.approvalKey}
                      label={item.approvalTitle}
                      value={rate}
                      note={t("reports.decisionsCount", { count: item.total })}
                      tone={rate >= 80 ? "bg-emerald-700" : rate >= 50 ? "bg-amber-500" : "bg-slate-400"}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="border border-[#d8d3c8] bg-white p-6">
            <h2 className="font-semibold text-[#142b45]">{t("reports.waiting")}</h2>
            <div className="mt-6 grid grid-cols-2 gap-px border border-[#d8d3c8] bg-[#d8d3c8]">
              {waiting.map(([value, label]) => (
                <div key={label} className="bg-[#faf9f6] p-5">
                  <p className="text-3xl font-bold text-[#142b45]">{value}</p>
                  <p className="mt-2 text-sm text-slate-600">{label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="border border-[#d8d3c8] bg-white p-6">
          <h2 className="font-semibold text-[#142b45]">{t("reports.activity")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="border border-[#e4e0d6] bg-[#faf9f6] p-5">
              <p className="text-sm text-slate-500">{t("inspections.title")}</p>
              <p className="mt-2 text-2xl font-bold text-[#142b45]">
                {report.inspections.completed}/
                {report.inspections.scheduled + report.inspections.completed + report.inspections.cancelled}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t("reports.inspectionsNote")}</p>
            </div>
            <div className="border border-[#e4e0d6] bg-[#faf9f6] p-5">
              <p className="text-sm text-slate-500">{t("reports.openClarifications")}</p>
              <p className="mt-2 text-2xl font-bold text-[#142b45]">{report.clarifications.open}</p>
              <p className="mt-1 text-xs text-slate-500">{t("reports.clarificationsNote")}</p>
            </div>
            <div className="border border-[#e4e0d6] bg-[#faf9f6] p-5">
              <p className="text-sm text-slate-500">{t("reports.approvalRate")}</p>
              <p className="mt-2 text-2xl font-bold text-[#142b45]">
                {totals.decided ? Math.round((totals.approved / totals.decided) * 100) : 0}%
              </p>
              <p className="mt-1 text-xs text-slate-500">{t("reports.approvalRateNote")}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
