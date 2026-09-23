"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  listInspectorApplications,
  type ReviewStatus,
} from "@/features/inspector/inspector-api";

const filters: { label: string; value?: ReviewStatus }[] = [
  { label: "All" },
  { label: "New", value: "pending" },
  { label: "Under review", value: "under_review" },
  { label: "Correction", value: "correction_required" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const statusLabel: Record<ReviewStatus, string> = {
  pending: "New",
  under_review: "Under review",
  correction_required: "Correction required",
  approved: "Approved",
  rejected: "Rejected",
};

export function InspectorDashboard() {
  const [filter, setFilter] = useState<ReviewStatus | undefined>();
  const query = useQuery({
    queryKey: ["inspector-applications", filter],
    queryFn: () => listInspectorApplications(filter),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Department review</p>
          <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight text-[#142b45]">
            Application queue
          </h1>
          <p className="mt-2 text-slate-600">
            Only approvals assigned to your department are shown here.
          </p>
        </div>
        {query.data ? (
          <span className="border border-[#d8d3c8] bg-[#faf9f6] px-4 py-2 text-sm font-semibold text-[#142b45]">
            {query.data.pagination.total} assigned
          </span>
        ) : null}
      </div>

      <div className="mt-7 flex flex-wrap gap-2" aria-label="Filter review queue">
        {filters.map((item) => (
          <Button
            key={item.label}
            type="button"
            variant={filter === item.value ? "default" : "outline"}
            className="h-10 rounded-md px-4"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {query.isPending ? (
        <div className="mt-8 flex items-center gap-3 border border-[#e4e0d6] p-6 text-slate-600">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Loading assigned applications…
        </div>
      ) : query.isError ? (
        <div role="alert" className="mt-8 border border-destructive/30 bg-destructive/5 p-6 text-destructive">
          <p className="font-semibold">Could not load the review queue.</p>
          <Button variant="outline" className="mt-4" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.data.applications.length === 0 ? (
        <div className="mt-8 border border-[#e4e0d6] bg-[#faf9f6] p-10 text-center">
          <ClipboardCheck className="mx-auto size-10 text-slate-400" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-[#142b45]">No assigned applications</h2>
          <p className="mt-2 text-sm text-slate-500">There is nothing in this queue right now.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {query.data.applications.map((application) => (
            <Card key={application.approvalId} className="rounded-md border-[#d8d3c8] bg-white">
              <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-[#d8d3c8] bg-[#faf9f6] px-2 py-1 text-xs font-semibold text-slate-700">
                      {statusLabel[application.reviewStatus]}
                    </span>
                    <span className="text-xs font-medium text-slate-500 capitalize">
                      {application.industry} · {application.district}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-[#142b45]">
                    {application.enterpriseName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{application.approvalTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Applicant: {application.applicantName} · Submitted {new Date(application.submittedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Link
                  href={`/inspector/applications/${application.projectId}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Open review <ArrowRight aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
