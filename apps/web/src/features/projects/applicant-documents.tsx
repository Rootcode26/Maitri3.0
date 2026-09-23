"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileSearch, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getProjectDocumentDownload,
  listApplicantDocuments,
  listProjects,
} from "@/features/projects/project-api";
import { StatusBadge } from "@/features/projects/status-badge";

export function ApplicantDocuments() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const documents = useQuery({
    queryKey: ["applicant-documents"],
    queryFn: listApplicantDocuments,
  });
  const projects = useQuery({
    queryKey: ["applicant-projects"],
    queryFn: listProjects,
  });
  const projectNames = useMemo(
    () =>
      new Map(
        (projects.data ?? []).map((project) => [
          project.id,
          project.enterpriseName,
        ]),
      ),
    [projects.data],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (documents.data ?? []).filter((document) => {
      const review = document.review?.status ?? "pending";
      const haystack =
        `${document.fileName} ${document.documentName} ${document.departmentName} ${projectNames.get(document.projectId ?? "") ?? ""}`.toLowerCase();
      return (
        (status === "all" || review === status) &&
        (!term || haystack.includes(term))
      );
    });
  }, [documents.data, projectNames, search, status]);

  async function download(projectId: string, documentId: string) {
    setError(null);
    try {
      const url = await getProjectDocumentDownload(projectId, documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not open the document.",
      );
    }
  }

  const pending = documents.isPending || projects.isPending;
  const failed = documents.isError || projects.isError;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <header>
        <p className="text-sm font-semibold text-primary">
          Applicant workspace
        </p>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-[#142b45] sm:text-4xl">
          Documents
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Find every uploaded file, its version history and the latest
          departmental review result.
        </p>
      </header>
      <div className="mt-7 grid gap-3 border-y border-[#e4e0d6] py-4 md:grid-cols-[1fr_15rem]">
        <label className="relative">
          <span className="sr-only">Search documents</span>
          <Search
            className="pointer-events-none absolute top-3 left-3 size-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-md border border-[#aeb7c4] pr-3 pl-10 text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
            placeholder="Search file, project or department"
          />
        </label>
        <label>
          <span className="sr-only">Filter by review status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 w-full rounded-md border border-[#aeb7c4] bg-white px-3 text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="all">All review statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="correction_required">Correction required</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
      {pending ? (
        <div className="mt-8 flex items-center gap-3 border border-[#e4e0d6] p-8 text-slate-600">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Loading
          documents…
        </div>
      ) : failed ? (
        <div
          role="alert"
          className="mt-8 border border-destructive/30 bg-destructive/5 p-6 text-destructive"
        >
          <p className="font-semibold">Documents could not be loaded.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 h-10"
            onClick={() => {
              documents.refetch();
              projects.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : filtered.length ? (
        <div className="mt-6 overflow-hidden border border-[#d8d3c8]">
          <div className="hidden grid-cols-[1.4fr_1fr_0.7fr_auto] gap-4 bg-[#f7f6f2] px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase md:grid">
            <span>Document</span>
            <span>Application</span>
            <span>Review</span>
            <span>Action</span>
          </div>
          <ul className="divide-y divide-[#e4e0d6]">
            {filtered.map((document) => {
              const projectId = document.projectId ?? "";
              return (
                <li
                  key={document.id}
                  className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_0.7fr_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#142b45]">
                      {document.documentName ?? document.fileName}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {document.fileName} · v{document.version} ·{" "}
                      {(document.sizeBytes / 1_000_000).toFixed(2)} MB
                    </p>
                    {document.review?.comment ? (
                      <p className="mt-2 text-sm text-slate-700">
                        {document.review.comment}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Link
                      href={`/applicant/applications/${projectId}`}
                      className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {projectNames.get(projectId) ?? "Open application"}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.departmentName}
                    </p>
                  </div>
                  <StatusBadge status={document.review?.status ?? "pending"} />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-md justify-self-start"
                    onClick={() => download(projectId, document.id)}
                  >
                    <Download aria-hidden="true" /> Open
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-8 border border-dashed border-[#aeb7c4] p-10 text-center">
          <FileSearch
            className="mx-auto size-8 text-slate-400"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-lg font-semibold text-[#142b45]">
            No matching documents
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Uploaded documents and their review results will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
