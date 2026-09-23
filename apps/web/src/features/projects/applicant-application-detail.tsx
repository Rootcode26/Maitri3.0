"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getApplicantApplication,
  getProjectDocumentDownload,
  uploadProjectDocument,
  type ProjectDocument,
} from "@/features/projects/project-api";
import { humanizeStatus, StatusBadge } from "@/features/projects/status-badge";

function CorrectDocument({
  projectId,
  document,
}: {
  projectId: string;
  document: ProjectDocument;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadProjectDocument(
        projectId,
        document.approvalKey,
        document.documentKey,
        file,
      ),
    onSuccess: async () => {
      setMessage("Corrected version submitted for review.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["applicant-application", projectId],
        }),
        queryClient.invalidateQueries({ queryKey: ["applicant-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["applicant-projects"] }),
      ]);
    },
    onError: (cause) =>
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Could not upload the corrected file.",
      ),
  });
  return (
    <div className="mt-3 border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-950">
        Correction requested
      </p>
      <p className="mt-1 text-sm text-amber-900">
        {document.review?.comment ??
          "Replace this document with a corrected version."}
      </p>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        className="mt-3 h-10 rounded-md px-4"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp aria-hidden="true" />{" "}
        {upload.isPending ? "Uploading…" : "Upload corrected version"}
      </Button>
      {message ? (
        <p role="status" className="mt-2 text-sm font-medium text-slate-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function ApplicantApplicationDetail({
  projectId,
}: {
  projectId: string;
}) {
  const query = useQuery({
    queryKey: ["applicant-application", projectId],
    queryFn: () => getApplicantApplication(projectId),
  });
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const latestDocuments = useMemo(() => {
    const latest = new Map<string, ProjectDocument>();
    for (const document of query.data?.documents ?? []) {
      const key = `${document.approvalKey}:${document.documentKey}`;
      const current = latest.get(key);
      if (!current || document.version > current.version)
        latest.set(key, document);
    }
    return [...latest.values()];
  }, [query.data?.documents]);

  async function download(document: ProjectDocument) {
    setDownloadError(null);
    try {
      const url = await getProjectDocumentDownload(projectId, document.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setDownloadError(
        cause instanceof Error ? cause.message : "Could not open the document.",
      );
    }
  }

  if (query.isPending)
    return (
      <div className="m-6 flex items-center gap-3 border border-[#e4e0d6] p-8 text-slate-600">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Loading
        application…
      </div>
    );
  if (query.isError)
    return (
      <div
        role="alert"
        className="m-6 border border-destructive/30 bg-destructive/5 p-6 text-destructive"
      >
        <p className="font-semibold">This application could not be loaded.</p>
        <Link
          href="/applicant/applications"
          className="mt-3 inline-block font-semibold underline"
        >
          Return to applications
        </Link>
      </div>
    );
  const application = query.data;
  const questionnaire = Object.entries(application.details).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      value !== "" &&
      (!Array.isArray(value) || value.length),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <Link
        href="/applicant/applications"
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to applications
      </Link>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#e4e0d6] pb-6">
        <div>
          <p className="text-sm font-semibold text-primary">
            Application details
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-[#142b45] sm:text-4xl">
            {application.enterpriseName}
          </h1>
          <p className="mt-2 text-slate-600">
            {humanizeStatus(application.industry)} · {application.district} ·{" "}
            {application.primaryActivity}
          </p>
        </div>
        <StatusBadge
          status={application.status}
          className="min-h-9 px-3 text-sm"
        />
      </header>
      {application.status === "correction_required" ? (
        <div className="mt-6 border-l-4 border-amber-500 bg-amber-50 px-5 py-4">
          <h2 className="font-semibold text-amber-950">
            Corrections are required
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            Replace each document marked for correction. The affected
            departmental review will automatically return to the inspector.
          </p>
        </div>
      ) : null}

      <section className="mt-7">
        <h2 className="text-2xl font-bold text-[#142b45]">
          Department progress
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {application.approvals.map((approval) => (
            <Card key={approval.id} className="rounded-md border-[#d8d3c8]">
              <CardHeader className="border-b border-[#e4e0d6]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-[#142b45]">
                      {approval.title}
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      {approval.department.name}
                    </p>
                  </div>
                  <StatusBadge status={approval.reviewStatus ?? "pending"} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">
                  Expected processing time: {approval.processingDays} days
                </p>
                {approval.decisionNote ? (
                  <p className="mt-3 border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {approval.decisionNote}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[#142b45]">Documents</h2>
            <p className="mt-1 text-sm text-slate-600">
              Latest version of every submitted document.
            </p>
          </div>
          <Link
            href="/applicant/documents"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            View all versions
          </Link>
        </div>
        {downloadError ? (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            {downloadError}
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          {latestDocuments.length ? (
            latestDocuments.map((document) => (
              <article
                key={document.id}
                className="border border-[#d8d3c8] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#142b45]">
                      {document.documentName ?? document.fileName}
                    </p>
                    <p className="mt-1 break-all text-sm text-slate-600">
                      {document.fileName} · Version {document.version} ·{" "}
                      {(document.sizeBytes / 1_000_000).toFixed(2)} MB
                    </p>
                    <div className="mt-2">
                      <StatusBadge
                        status={document.review?.status ?? "pending"}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-md"
                    onClick={() => download(document)}
                  >
                    <Download aria-hidden="true" /> Open
                  </Button>
                </div>
                {application.status === "correction_required" &&
                ["correction_required", "rejected"].includes(
                  document.review?.status ?? "",
                ) ? (
                  <CorrectDocument projectId={projectId} document={document} />
                ) : document.review?.comment ? (
                  <p className="mt-3 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {document.review.comment}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <p className="border border-dashed border-[#aeb7c4] p-6 text-sm text-slate-600">
              No documents have been uploaded.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-md border-[#d8d3c8]">
          <CardHeader>
            <CardTitle className="text-xl text-[#142b45]">
              Questionnaire summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {questionnaire.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {humanizeStatus(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-[#142b45]">
                    {Array.isArray(value) ? value.join(", ") : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card className="rounded-md border-[#d8d3c8]">
          <CardHeader>
            <CardTitle className="text-xl text-[#142b45]">
              Status timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {application.timeline.length ? (
              <ol className="space-y-5">
                {application.timeline.map((event) => (
                  <li
                    key={event.id}
                    className="relative border-l-2 border-[#d8d3c8] pl-4"
                  >
                    <span
                      className="absolute top-1 -left-[5px] size-2 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    <p className="font-semibold text-[#142b45]">
                      {humanizeStatus(event.toStatus)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {event.approvalTitle ? `${event.approvalTitle} · ` : ""}
                      {event.note ?? `Updated by ${event.actorName}`}
                    </p>
                    <time className="mt-1 block text-xs text-slate-500">
                      {new Date(event.createdAt).toLocaleString("en-IN")}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-600">
                No status changes have been recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
