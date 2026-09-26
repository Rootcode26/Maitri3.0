"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  FileCheck2,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { formatDate } from "@/i18n/format";
import { translateStatus } from "@/features/projects/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  decideInspectorApproval,
  createInspectorClarification,
  getInspectorApplication,
  getInspectorDocumentDownload,
  reviewInspectorDocument,
  resolveInspectorClarification,
  startInspectorReview,
  type InspectorApplication,
  type InspectorDocument,
} from "@/features/inspector/inspector-api";

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
    <section className="border-t border-[#e4e0d6] pt-5">
      <h3 className="flex items-center gap-2 font-semibold text-[#142b45]">
        <MessageSquareText className="size-4" aria-hidden="true" />{" "}
        {t("inspector.requestClarification")}
      </h3>
      {clarifications.length ? (
        <div className="mt-3 space-y-3">
          {clarifications.map((clarification) => (
            <article
              key={clarification.id}
              className="border border-[#d8d3c8] bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[#142b45]">
                    {clarification.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
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
                  className="mt-3 border-l-4 border-primary/40 bg-slate-50 px-4 py-3 text-sm"
                >
                  <p className="font-semibold text-[#142b45]">
                    {response.applicantName}
                  </p>
                  <p className="mt-1 text-slate-700">{response.message}</p>
                </div>
              ))}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          {t("documents.empty")}
        </p>
      )}

      {enabled ? (
        <div className="mt-4 grid gap-3 border border-[#d8d3c8] bg-[#faf9f6] p-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-medium text-[#142b45]">
            {t("inspector.applicant")}
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-[#aeb7c4] bg-white p-3"
              value={message}
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t("inspector.clarificationPlaceholder")}
            />
          </label>
          <label className="text-sm font-medium text-[#142b45]">
            {t("documents.document")} {t("inspector.optional")}
            <select
              className="mt-1 h-10 w-full rounded-md border border-[#aeb7c4] bg-white px-3"
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
          <label className="text-sm font-medium text-[#142b45]">
            {t("inspector.dateDue", { date: "" })}
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-md border border-[#aeb7c4] bg-white px-3"
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
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<
    "accepted" | "correction_required" | "rejected"
  >(document.review.status === "pending" ? "accepted" : document.review.status);
  const [comment, setComment] = useState(document.review.comment ?? "");
  const [message, setMessage] = useState<string | null>(null);
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

  return (
    <div className="border border-[#d8d3c8] bg-[#faf9f6] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#142b45]">
            {document.fileName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {document.documentKey} · version {document.version} ·{" "}
            {(document.sizeBytes / 1_000_000).toFixed(2)} MB
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600">
            {t("inspector.currentReview", { status: translateStatus(t, document.review.status) })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-md"
          onClick={download}
        >
          <Download aria-hidden="true" /> {t("inspector.openFile")}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[13rem_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-[#142b45]">
          {t("inspector.reviewResult")}
          <select
            className="mt-1 block h-10 w-full rounded-md border border-[#aeb7c4] bg-white px-3"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            disabled={!reviewEnabled || review.isPending}
          >
            <option value="accepted">{t("inspector.accept")}</option>
            <option value="correction_required">{t("status.correction_required")}</option>
            <option value="rejected">{t("inspector.reject")}</option>
          </select>
        </label>
        <label className="text-sm font-medium text-[#142b45]">
          {t("inspector.comment")} {status !== "accepted" ? t("inspector.required") : t("inspector.optional")}
          <input
            className="mt-1 block h-10 w-full rounded-md border border-[#aeb7c4] bg-white px-3"
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
        <p className="mt-3 text-sm text-slate-600" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ReviewContent({
  projectId,
  application,
}: {
  projectId: string;
  application: InspectorApplication;
}) {
  const { t } = useLanguage();
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
      <Card className="rounded-md border-[#d8d3c8]">
        <CardHeader>
          <CardTitle className="text-xl text-[#142b45]">
            {t("inspector.applicantProject")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t("inspector.applicant"), application.applicant.name],
            [t("inspector.mobile"), application.applicant.phoneNumber],
            [t("inspector.industry"), humanize(application.industry)],
            [t("inspector.district"), application.district],
            [t("inspector.activity"), application.primaryActivity],
            [t("inspector.projectStatus"), translateStatus(t, application.projectStatus)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {label}
              </p>
              <p className="mt-1 text-sm font-medium text-[#142b45]">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-md border-[#d8d3c8]">
        <CardHeader>
          <CardTitle className="text-xl text-[#142b45]">
            {t("inspector.questionnaire")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {questionnaire.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {humanize(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}
                </dt>
                <dd className="mt-1 break-words text-sm font-medium text-[#142b45]">
                  {Array.isArray(value) ? value.join(", ") : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

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
          <Card key={approval.id} className="rounded-md border-[#d8d3c8]">
            <CardHeader className="border-b border-[#e4e0d6]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                    {translateStatus(t, approval.reviewStatus)}
                  </p>
                  <CardTitle className="mt-2 text-2xl text-[#142b45]">
                    {approval.title}
                  </CardTitle>
                </div>
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
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="font-semibold text-[#142b45]">{t("inspector.documents")}</h3>
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
                <div className="border-t border-[#e4e0d6] pt-5">
                  <label className="block text-sm font-semibold text-[#142b45]">
                    {t("inspector.decisionNote")}
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border border-[#aeb7c4] bg-white p-3 font-normal"
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
                <p className="border-l-4 border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
        className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d8d3c8] bg-white px-4 text-sm font-semibold text-[#142b45] shadow-sm hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ArrowLeft aria-hidden="true" /> {t("inspector.backQueue")}
      </Link>
      {query.isPending ? (
        <div className="mt-8 flex items-center gap-3 border border-[#e4e0d6] p-8 text-slate-600">
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
            <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight text-[#142b45]">
              {query.data.enterpriseName}
            </h1>
            <p className="mt-2 text-slate-600">
              {t("common.submitted", { date: formatDate(query.data.submittedAt, language) })}
            </p>
          </header>
          <ReviewContent projectId={projectId} application={query.data} />
        </>
      )}
    </div>
  );
}
