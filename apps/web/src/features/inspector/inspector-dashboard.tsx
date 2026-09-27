"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  listInspectorApplications,
  type AttentionLevel,
  type ReviewStatus,
} from "@/features/inspector/inspector-api";
import { useLanguage } from "@/components/providers/language-provider";
import { formatDate } from "@/i18n/format";
import type { TranslationKey } from "@/i18n/language/en";
import { translateStatus } from "@/features/projects/status-badge";

const filters: { label: string; value?: ReviewStatus }[] = [
  { label: "status.all" },
  { label: "status.pending", value: "pending" },
  { label: "status.under_review", value: "under_review" },
  { label: "status.correction_required", value: "correction_required" },
  { label: "status.approved", value: "approved" },
  { label: "status.rejected", value: "rejected" },
];

// Prototype review-effort estimate (does not affect eligibility or approval).
const attentionStyle: Record<
  AttentionLevel,
  { className: string; labelKey: TranslationKey }
> = {
  standard: {
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
    labelKey: "attention.standard",
  },
  elevated: {
    className: "border-amber-300 bg-amber-50 text-amber-900",
    labelKey: "attention.elevated",
  },
  high_attention: {
    className: "border-red-300 bg-red-50 text-red-800",
    labelKey: "attention.high_attention",
  },
};

function AttentionBadge({
  level,
  score,
  t,
}: {
  level: AttentionLevel;
  score: number | null;
  t: (key: TranslationKey) => string;
}) {
  const style = attentionStyle[level];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${style.className}`}
      title={t("attention.tooltip")}
    >
      {t(style.labelKey)}
      {score !== null ? (
        <span className="font-normal opacity-80">· {score}</span>
      ) : null}
    </span>
  );
}
export function InspectorDashboard() {
  const { language, t, text } = useLanguage();
  const [filter, setFilter] = useState<ReviewStatus | undefined>();
  const query = useQuery({
    queryKey: ["inspector-applications", filter],
    queryFn: () => listInspectorApplications({ status: filter }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{t("inspector.departmentReview")}</p>
          <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight text-[#142b45]">
            {t("inspector.queue")}
          </h1>
          <p className="mt-2 text-slate-600">
            {t("inspector.queueDescription")}
          </p>
        </div>
        {query.data ? (
          <span className="border border-[#d8d3c8] bg-[#faf9f6] px-4 py-2 text-sm font-semibold text-[#142b45]">
            {t("common.assigned", { count: query.data.pagination.total })}
          </span>
        ) : null}
      </div>

      <div className="mt-7 flex flex-wrap gap-2" aria-label={t("inspector.filterQueue")}>
        {filters.map((item) => (
          <Button
            key={item.value ?? "all"}
            type="button"
            variant={filter === item.value ? "default" : "outline"}
            className="h-10 rounded-md px-4"
            onClick={() => setFilter(item.value)}
          >
            {t(item.label as "status.all")}
          </Button>
        ))}
      </div>

      {query.isPending ? (
        <div className="mt-8 flex items-center gap-3 border border-[#e4e0d6] p-6 text-slate-600">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t("inspector.loading")}
        </div>
      ) : query.isError ? (
        <div role="alert" className="mt-8 border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          <p className="font-semibold">{t("inspector.loadError")}</p>
          <Button variant="outline" className="mt-4" onClick={() => query.refetch()}>
            {t("common.tryAgain")}
          </Button>
        </div>
      ) : query.data.applications.length === 0 ? (
        <div className="mt-8 border border-[#e4e0d6] bg-[#faf9f6] p-10 text-center">
          <ClipboardCheck className="mx-auto size-10 text-slate-400" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-[#142b45]">{t("inspector.noApplications")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("inspector.emptyQueue")}</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {query.data.applications.map((application) => (
            <Card key={application.approvalId} className="rounded-md border-[#d8d3c8] bg-white">
              <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-[#d8d3c8] bg-[#faf9f6] px-2 py-1 text-xs font-semibold text-slate-700">
                      {translateStatus(t, application.reviewStatus)}
                    </span>
                    {application.attentionLevel ? (
                      <AttentionBadge
                        level={application.attentionLevel}
                        score={application.attentionScore}
                        t={t}
                      />
                    ) : null}
                    <span className="text-xs font-medium text-slate-500 capitalize">
                      {text(application.industry)} · {text(application.district)}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-[#142b45]">
                    {application.enterpriseName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{application.approvalTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("common.applicant", { name: application.applicantName })} · {t("common.submitted", { date: formatDate(application.submittedAt, language) })}
                  </p>
                </div>
                <Link
                  href={`/inspector/applications/${application.projectId}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t("inspector.openReview")} <ArrowRight aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
