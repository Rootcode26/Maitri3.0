"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  Download,
  Eye,
  FileCheck2,
  Gauge,
  History,
  Loader2,
  MessageSquareText,
  ShieldX,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { formatDate } from "@/i18n/format";
import type { TranslationKey } from "@/i18n/language/en";
import { translateStatus } from "@/features/projects/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  assignApproval,
  decideInspectorApproval,
  createInspectorClarification,
  getInspectorApplication,
  getInspectorCertificate,
  getInspectorCertificateDownloadUrl,
  getInspectorDocumentDownload,
  listDepartmentOfficers,
  reviewInspectorDocument,
  resolveInspectorClarification,
  revokeInspectorCertificate,
  startInspectorReview,
  type AttentionAssessment,
  type AttentionLevel,
  type ApplicationStatusEvent,
  type InspectorApplication,
  type InspectorDocument,
  type ValidationCheckStatus,
  type ValidationFlag,
  type ValidationFlags,
} from "@/features/inspector/inspector-api";

const attentionLevelKey: Record<AttentionLevel, TranslationKey> = {
  standard: "attention.standard",
  elevated: "attention.elevated",
  high_attention: "attention.high_attention",
};

const attentionLevelClass: Record<AttentionLevel, string> = {
  standard: "border-emerald-300 bg-emerald-50 text-emerald-800",
  elevated: "border-amber-300 bg-amber-50 text-amber-900",
  high_attention: "border-red-300 bg-red-50 text-red-800",
};

function AttentionCard({
  attention,
  t,
}: {
  attention: AttentionAssessment;
  t: (key: TranslationKey) => string;
}) {
  return (
    <Card className="rounded-md border-border">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-xl text-foreground">
          <Gauge className="size-5 text-muted-foreground" aria-hidden="true" />
          {t("attention.title")}
        </CardTitle>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${attentionLevelClass[attention.level]}`}
        >
          {t(attentionLevelKey[attention.level])}
          <span className="font-normal opacity-80">· {attention.score}/100</span>
        </span>
      </CardHeader>
      <CardContent>
        {attention.factors.length > 0 ? (
          <>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("attention.heading")}
            </p>
            <ul className="mt-3 divide-y divide-border rounded-lg ring-1 ring-border">
              {attention.factors.map((factor) => (
                <li
                  key={factor.code}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {factor.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {factor.explanation}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                    +{factor.points}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("attention.noFactors")}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("attention.tooltip")}</p>
      </CardContent>
    </Card>
  );
}

const checkStatusStyle: Record<
  ValidationCheckStatus,
  { className: string; labelKey: TranslationKey }
> = {
  matched: {
    className: "bg-emerald-100 text-emerald-800",
    labelKey: "validation.checkMatched",
  },
  mismatched: {
    className: "bg-red-100 text-red-800",
    labelKey: "validation.checkMismatched",
  },
  unavailable: {
    className: "bg-muted text-muted-foreground",
    labelKey: "validation.checkUnavailable",
  },
  review_required: {
    className: "bg-amber-100 text-amber-800",
    labelKey: "validation.checkReview",
  },
};

function FlagList({
  heading,
  flags,
}: {
  heading: string;
  flags: ValidationFlag[];
}) {
  if (flags.length === 0) return null;
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {heading}
      </p>
      <ul className="mt-2 space-y-2">
        {flags.map((flag, index) => (
          <li key={`${flag.code}-${index}`} className="text-sm">
            <span className="font-medium text-foreground">{flag.message}</span>
            {flag.suggestedAction ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {flag.suggestedAction}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ValidationFlagsCard({
  validation,
  t,
  text,
}: {
  validation: ValidationFlags;
  t: (key: TranslationKey) => string;
  text: (source: string) => string;
}) {
  const isClean =
    validation.warnings.length === 0 &&
    validation.reviewItems.length === 0 &&
    validation.documentChecks.length === 0;

  return (
    <Card className="rounded-md border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-foreground">
          <FileCheck2 className="size-5 text-muted-foreground" aria-hidden="true" />
          {t("validation.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isClean ? (
          <p className="text-sm text-muted-foreground">{t("validation.clean")}</p>
        ) : (
          <>
            <FlagList
              heading={t("validation.warningsHeading")}
              flags={validation.warnings}
            />
            <FlagList
              heading={t("validation.reviewHeading")}
              flags={validation.reviewItems}
            />
            {validation.documentChecks.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("validation.checksHeading")}
                </p>
                <ul className="mt-2 divide-y divide-border rounded-lg ring-1 ring-border">
                  {validation.documentChecks.map((check, index) => {
                    const style = checkStatusStyle[check.status];
                    return (
                      <li
                        key={`${check.documentKey}-${check.field ?? index}`}
                        className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {text(check.documentKey)}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {check.reason}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}
                        >
                          {t(style.labelKey)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ClarificationPanel({
  projectId,
  approvalId,
  documents,
  clarifications,
  enabled,
}: {
  projectId: string;
  approvalId: string;
  documents: InspectorDocument[];
  clarifications: InspectorApplication["clarifications"];
  enabled: boolean;
}) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      createInspectorClarification(projectId, approvalId, {
        message: message.trim(),
        ...(documentId ? { documentId } : {}),
        ...(dueDate
          ? { dueAt: new Date(`${dueDate}T23:59:59+05:30`).toISOString() }
          : {}),
      }),
    onSuccess: (updated) => {
      setMessage("");
      setDocumentId("");
      setDueDate("");
      setError(null);
      queryClient.setQueryData(["inspector-application", projectId], updated);
    },
    onError: (cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not request clarification.",
      ),
  });
  const resolve = useMutation({
    mutationFn: (clarificationId: string) =>
      resolveInspectorClarification(projectId, clarificationId),
    onSuccess: (updated) => {
      setError(null);
      queryClient.setQueryData(["inspector-application", projectId], updated);
    },
    onError: (cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not resolve clarification.",
      ),
  });

  return (
    <section className="border-t border-border pt-5">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <MessageSquareText className="size-4" aria-hidden="true" />{" "}
        {t("inspector.requestClarification")}
      </h3>
      {clarifications.length ? (
        <div className="mt-3 space-y-3">
          {clarifications.map((clarification) => (
            <article
              key={clarification.id}
              className="border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {clarification.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {translateStatus(t, clarification.status)} ·{" "}
                    {formatDate(clarification.createdAt, language)}
                    {clarification.dueAt
                      ? t("inspector.dateDue", { date: formatDate(clarification.dueAt, language) })
                      : ""}
                  </p>
                </div>
                {clarification.status !== "resolved" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-md"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate(clarification.id)}
                  >
                    {t("status.resolved")}
                  </Button>
                ) : null}
              </div>
              {clarification.responses.map((response) => (
                <div
                  key={response.id}
                  className="mt-3 border-l-4 border-primary/40 bg-muted px-4 py-3 text-sm"
                >
                  <p className="font-semibold text-foreground">
                    {response.applicantName}
                  </p>
                  <p className="mt-1 text-foreground">{response.message}</p>
                </div>
              ))}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("documents.empty")}
        </p>
      )}

      {enabled ? (
        <div className="mt-4 grid gap-3 border border-border bg-muted p-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-medium text-foreground">
            {t("inspector.applicant")}
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-input bg-card p-3"
              value={message}
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t("inspector.clarificationPlaceholder")}
            />
          </label>
          <label className="text-sm font-medium text-foreground">
            {t("documents.document")} {t("inspector.optional")}
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
            >
              <option value="">{t("inspector.generalClarification")}</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.fileName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-foreground">
            {t("inspector.dateDue", { date: "" })}
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
          <Button
            type="button"
            className="h-10 rounded-md sm:col-span-2 sm:justify-self-start"
            disabled={create.isPending || message.trim().length < 10}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t("inspector.sending") : t("inspector.requestClarification")}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function DocumentReviewCard({
  projectId,
  document,
  reviewEnabled,
}: {
  projectId: string;
  document: InspectorDocument;
  reviewEnabled: boolean;
}) {
  const { t, text } = useLanguage();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<
    "accepted" | "correction_required" | "rejected"
  >(document.review.status === "pending" ? "accepted" : document.review.status);
  const [comment, setComment] = useState(document.review.comment ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const review = useMutation({
    mutationFn: () =>
      reviewInspectorDocument(
        projectId,
        document.id,
        status,
        comment || undefined,
      ),
    onSuccess: async () => {
      setMessage(t("inspector.reviewSaved"));
      await queryClient.invalidateQueries({
        queryKey: ["inspector-application", projectId],
      });
    },
    onError: (error) =>
      setMessage(
        error instanceof Error ? error.message : t("inspector.saveReviewError"),
      ),
  });

  async function download() {
    setMessage(null);
    try {
      const url = await getInspectorDocumentDownload(projectId, document.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("inspector.openDocumentError"),
      );
    }
  }

  async function togglePreview() {
    if (previewUrl) {
      setPreviewUrl(null);
      return;
    }
    setMessage(null);
    try {
      setPreviewUrl(await getInspectorDocumentDownload(projectId, document.id));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("inspector.openDocumentError"),
      );
    }
  }

  return (
    <div className="border border-border bg-muted p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">
            {document.fileName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {text(document.documentKey)} · {t("application.version", { version: document.version })} ·{" "}
            {(document.sizeBytes / 1_000_000).toFixed(2)} MB
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {t("inspector.currentReview", { status: translateStatus(t, document.review.status) })}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-md"
            onClick={togglePreview}
          >
            <Eye aria-hidden="true" />{" "}
            {previewUrl ? t("inspector.hidePreview") : t("inspector.preview")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-md"
            onClick={download}
          >
            <Download aria-hidden="true" /> {t("inspector.openFile")}
          </Button>
        </div>
      </div>
      {previewUrl ? (
        <iframe
          src={previewUrl}
          title={document.fileName}
          className="mt-4 h-[32rem] w-full rounded-md border border-border bg-card"
        />
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-[13rem_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-foreground">
          {t("inspector.reviewResult")}
          <select
            className="mt-1 block h-10 w-full rounded-md border border-input bg-card px-3"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            disabled={!reviewEnabled || review.isPending}
          >
            <option value="accepted">{t("inspector.accept")}</option>
            <option value="correction_required">{t("status.correction_required")}</option>
            <option value="rejected">{t("inspector.reject")}</option>
          </select>
        </label>
        <label className="text-sm font-medium text-foreground">
          {t("inspector.comment")} {status !== "accepted" ? t("inspector.required") : t("inspector.optional")}
          <input
            className="mt-1 block h-10 w-full rounded-md border border-input bg-card px-3"
            value={comment}
            maxLength={2000}
            onChange={(event) => setComment(event.target.value)}
            disabled={!reviewEnabled || review.isPending}
          />
        </label>
        <Button
          type="button"
          className="h-10 rounded-md px-4"
          onClick={() => review.mutate()}
          disabled={
            !reviewEnabled ||
            review.isPending ||
            (status !== "accepted" && !comment.trim())
          }
        >
          {review.isPending ? t("inspector.saving") : t("inspector.saveReview")}
        </Button>
      </div>
      {message ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ApprovalAssignControl({
  projectId,
  approvalId,
  assignedTo,
}: {
  projectId: string;
  approvalId: string;
  assignedTo: string | null;
}) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const officers = useQuery({
    queryKey: ["inspector-officers"],
    queryFn: listDepartmentOfficers,
  });
  const assign = useMutation({
    mutationFn: (assigneeId: string | null) =>
      assignApproval(projectId, approvalId, assigneeId),
    onSuccess: (updated) =>
      queryClient.setQueryData(["inspector-application", projectId], updated),
  });

  return (
    <label className="flex items-center gap-2 text-sm">
      <UserCog className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{t("assignment.assignedTo")}</span>
      <select
        value={assignedTo ?? ""}
        disabled={assign.isPending || officers.isPending}
        onChange={(event) => assign.mutate(event.target.value || null)}
        className="h-9 cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-foreground transition-colors hover:border-[#94a3b8] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">{t("assignment.unassigned")}</option>
        {(officers.data ?? []).map((officer) => (
          <option key={officer.id} value={officer.id}>
            {officer.name} ({officer.assignedCount})
          </option>
        ))}
      </select>
    </label>
  );
}

function ActivityTimelineCard({
  timeline,
}: {
  timeline: ApplicationStatusEvent[];
}) {
  const { t, language } = useLanguage();
  if (timeline.length === 0) return null;
  return (
    <Card className="rounded-md border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-foreground">
          <History className="size-5 text-muted-foreground" aria-hidden="true" />
          {t("activity.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {timeline.map((event) => (
            <li key={event.id} className="flex gap-3">
              <span
                className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-400"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{event.actorName}</span>{" "}
                  <span className="text-muted-foreground">
                    {t(
                      event.actorRole === "inspector"
                        ? "activity.byInspector"
                        : "activity.byApplicant",
                    )}
                  </span>{" "}
                  · {translateStatus(t, event.fromStatus)} →{" "}
                  <span className="font-medium">
                    {translateStatus(t, event.toStatus)}
                  </span>
                  {event.approvalTitle ? (
                    <span className="text-muted-foreground"> · {event.approvalTitle}</span>
                  ) : null}
                </p>
                {event.note ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{event.note}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(event.createdAt, language)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function InspectorCertificateCard({ projectId }: { projectId: string }) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  const query = useQuery({
    queryKey: ["inspector-certificate", projectId],
    queryFn: () => getInspectorCertificate(projectId),
    retry: false,
  });

  const download = useMutation({
    mutationFn: () => getInspectorCertificateDownloadUrl(projectId),
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: (err) =>
      setError(err instanceof Error ? err.message : t("inspector.actionError")),
  });

  const revoke = useMutation({
    mutationFn: () => revokeInspectorCertificate(projectId, reason.trim()),
    onSuccess: (updated) => {
      setError(null);
      setRevoking(false);
      setReason("");
      queryClient.setQueryData(["inspector-certificate", projectId], updated);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : t("inspector.actionError")),
  });

  const certificate = query.data;

  return (
    <Card className="rounded-md border-border duration-500 animate-in fade-in">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-xl text-foreground">
          <Award className="size-5 text-emerald-600" aria-hidden="true" />
          {t("certificate.title")}
        </CardTitle>
        {certificate ? (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${
              certificate.status === "active"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {t(
              certificate.status === "active"
                ? "certificate.statusActive"
                : "certificate.statusRevoked",
            )}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("certificate.loading")}
          </p>
        ) : !certificate ? (
          <p className="text-sm text-muted-foreground">{t("certificate.pending")}</p>
        ) : (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("certificate.number")}
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {certificate.certificateNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("certificate.issuedOn")}
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {formatDate(certificate.issuedAt, language)}
                </dd>
              </div>
            </dl>
            {certificate.status === "revoked" && certificate.revokeReason ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {certificate.revokeReason}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => download.mutate()}
                disabled={download.isPending}
                className="gap-2"
              >
                <Download className="size-4" aria-hidden="true" />
                {t("certificate.download")}
              </Button>
              {certificate.status === "active" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRevoking((value) => !value)}
                  className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                >
                  <ShieldX className="size-4" aria-hidden="true" />
                  {t("certificate.revoke")}
                </Button>
              ) : null}
            </div>
            {revoking ? (
              <div className="space-y-2 rounded-md border border-border bg-muted p-3">
                <label
                  htmlFor="revoke-reason"
                  className="text-sm font-medium text-foreground"
                >
                  {t("certificate.revokeReason")}
                </label>
                <textarea
                  id="revoke-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                />
                <Button
                  type="button"
                  onClick={() => revoke.mutate()}
                  disabled={revoke.isPending || reason.trim().length < 10}
                  className="gap-2 bg-red-700 hover:bg-red-800"
                >
                  {revoke.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {t("certificate.confirmRevoke")}
                </Button>
              </div>
            ) : null}
          </>
        )}
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReviewContent({
  projectId,
  application,
}: {
  projectId: string;
  application: InspectorApplication;
}) {
  const { t, text } = useLanguage();
  const queryClient = useQueryClient();
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>(
    {},
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const latestDocuments = useMemo(() => {
    const latest = new Map<string, InspectorDocument>();
    for (const document of application.documents) {
      const key = `${document.approvalKey}:${document.documentKey}`;
      const current = latest.get(key);
      if (!current || document.version > current.version)
        latest.set(key, document);
    }
    return [...latest.values()];
  }, [application.documents]);
  const questionnaire = Object.entries(application.details).filter(
    ([, value]) =>
      value !== null &&
      value !== undefined &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0),
  );

  const start = useMutation({
    mutationFn: (approvalId: string) =>
      startInspectorReview(projectId, approvalId),
    onSuccess: (updated) =>
      queryClient.setQueryData(["inspector-application", projectId], updated),
    onError: (error) =>
      setActionError(
        error instanceof Error ? error.message : t("inspector.actionError"),
      ),
  });
  const decide = useMutation({
    mutationFn: ({
      approvalId,
      decision,
    }: {
      approvalId: string;
      decision: "approved" | "correction_required" | "rejected";
    }) =>
      decideInspectorApproval(
        projectId,
        approvalId,
        decision,
        decisionNotes[approvalId]?.trim() || undefined,
      ),
    onSuccess: (updated) => {
      setActionError(null);
      queryClient.setQueryData(["inspector-application", projectId], updated);
    },
    onError: (error) =>
      setActionError(
        error instanceof Error ? error.message : t("inspector.actionError"),
      ),
  });

  return (
    <div className="space-y-6">
      <Card className="rounded-md border-border">
        <CardHeader>
          <CardTitle className="text-xl text-foreground">
            {t("inspector.applicantProject")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t("inspector.applicant"), application.applicant.name],
            [t("inspector.mobile"), application.applicant.phoneNumber],
            [t("inspector.industry"), text(humanize(application.industry))],
            [t("inspector.district"), text(application.district)],
            [t("inspector.activity"), text(application.primaryActivity)],
            [t("inspector.projectStatus"), translateStatus(t, application.projectStatus)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {application.attention ? (
        <AttentionCard attention={application.attention} t={t} />
      ) : null}

      {application.validation ? (
        <ValidationFlagsCard
          validation={application.validation}
          t={t}
          text={text}
        />
      ) : null}

      {application.projectStatus === "approved" ? (
        <InspectorCertificateCard projectId={projectId} />
      ) : null}

      <Card className="rounded-md border-border">
        <CardHeader>
          <CardTitle className="text-xl text-foreground">
            {t("inspector.questionnaire")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {questionnaire.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {text(humanize(key.replace(/([a-z])([A-Z])/g, "$1 $2")))}
                </dt>
                <dd className="mt-1 break-words text-sm font-medium text-foreground">
                  {Array.isArray(value)
                    ? value.map((item) => text(String(item))).join(", ")
                    : text(String(value))}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <ActivityTimelineCard timeline={application.timeline} />

      {actionError ? (
        <p
          role="alert"
          className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      {application.approvals.map((approval) => {
        const reviewEnabled = ["under_review", "correction_required"].includes(
          approval.reviewStatus,
        );
        const documents = latestDocuments.filter(
          (document) => document.approvalKey === approval.approvalKey,
        );
        const note = decisionNotes[approval.id] ?? approval.decisionNote ?? "";
        return (
          <Card key={approval.id} className="rounded-md border-border">
            <CardHeader className="border-b border-border">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                    {translateStatus(t, approval.reviewStatus)}
                  </p>
                  <CardTitle className="mt-2 text-2xl text-foreground">
                    {text(approval.title)}
                  </CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <ApprovalAssignControl
                    projectId={projectId}
                    approvalId={approval.id}
                    assignedTo={approval.assignedTo}
                  />
                  {approval.reviewStatus === "pending" ? (
                    <Button
                      type="button"
                      className="h-10 rounded-md px-5"
                      onClick={() => start.mutate(approval.id)}
                      disabled={start.isPending}
                    >
                      {start.isPending ? t("inspector.starting") : t("inspector.startReview")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="font-semibold text-foreground">{t("inspector.documents")}</h3>
                <div className="mt-3 space-y-3">
                  {documents.length ? (
                    documents.map((document) => (
                      <DocumentReviewCard
                        key={document.id}
                        projectId={projectId}
                        document={document}
                        reviewEnabled={reviewEnabled}
                      />
                    ))
                  ) : (
                    <p className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                      {t("inspector.noDocuments")}
                    </p>
                  )}
                </div>
              </div>

              <ClarificationPanel
                projectId={projectId}
                approvalId={approval.id}
                documents={documents}
                clarifications={application.clarifications.filter(
                  (item) => item.approvalId === approval.id,
                )}
                enabled={reviewEnabled}
              />

              {reviewEnabled ? (
                <div className="border-t border-border pt-5">
                  <label className="block text-sm font-semibold text-foreground">
                    {t("inspector.decisionNote")}
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border border-input bg-card p-3 font-normal"
                      maxLength={2000}
                      value={note}
                      onChange={(event) =>
                        setDecisionNotes((current) => ({
                          ...current,
                          [approval.id]: event.target.value,
                        }))
                      }
                      placeholder={t("inspector.decisionNoteHint")}
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="h-10 rounded-md bg-emerald-700 px-5 hover:bg-emerald-800"
                      onClick={() =>
                        decide.mutate({
                          approvalId: approval.id,
                          decision: "approved",
                        })
                      }
                      disabled={decide.isPending}
                    >
                      <FileCheck2 aria-hidden="true" /> {t("inspector.approve")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-md border-amber-400 px-5 text-amber-900"
                      onClick={() =>
                        decide.mutate({
                          approvalId: approval.id,
                          decision: "correction_required",
                        })
                      }
                      disabled={decide.isPending || !note.trim()}
                    >
                      {t("inspector.requestCorrection")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-10 rounded-md px-5"
                      onClick={() =>
                        decide.mutate({
                          approvalId: approval.id,
                          decision: "rejected",
                        })
                      }
                      disabled={decide.isPending || !note.trim()}
                    >
                      {t("inspector.reject")}
                    </Button>
                  </div>
                </div>
              ) : approval.decisionNote ? (
                <p className="border-l-4 border-border bg-muted px-4 py-3 text-sm text-foreground">
                  {approval.decisionNote}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function InspectorApplicationView({ projectId }: { projectId: string }) {
  const { language, t } = useLanguage();
  const query = useQuery({
    queryKey: ["inspector-application", projectId],
    queryFn: () => getInspectorApplication(projectId),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <Link
        href="/inspector/dashboard"
        className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ArrowLeft aria-hidden="true" /> {t("inspector.backQueue")}
      </Link>
      {query.isPending ? (
        <div className="mt-8 flex items-center gap-3 border border-border p-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t("inspector.loadingApplication")}
        </div>
      ) : query.isError ? (
        <div
          role="alert"
          className="mt-8 border border-destructive/30 bg-destructive/5 p-6 text-destructive"
        >
          <p className="font-semibold">{t("inspector.applicationLoadError")}</p>
          <p className="mt-1 text-sm">{t("inspector.departmentOnly")}</p>
        </div>
      ) : (
        <>
          <header className="my-8">
            <p className="text-sm font-semibold text-primary">
              {t("inspector.applicationReview")}
            </p>
            <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight text-foreground">
              {query.data.enterpriseName}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t("common.submitted", { date: formatDate(query.data.submittedAt, language) })}
            </p>
          </header>
          <ReviewContent projectId={projectId} application={query.data} />
        </>
      )}
    </div>
  );
}
