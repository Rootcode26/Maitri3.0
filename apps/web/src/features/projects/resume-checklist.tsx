"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { getProject } from "@/features/projects/project-api";
import { ChecklistResult } from "@/features/projects/new-project-wizard";

/**
 * Reopen a saved project's generated checklist so the applicant can finish
 * uploading documents and submit. It loads the existing project by id (never
 * creating a new one) and hands it to the same ChecklistResult used right after
 * generation, so uploads, "Check documents" and explicit submission all behave
 * identically — nothing here submits the project on its own.
 */
export function ResumeChecklist({ projectId }: { projectId: string }) {
  const { t, text } = useLanguage();
  const query = useQuery({
    queryKey: ["applicant-project", projectId],
    queryFn: () => getProject(projectId),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <Link
        href="/applicant/applications"
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />{" "}
        {t("application.backApplications")}
      </Link>
      <div className="mt-6">
        {query.isPending ? (
          <div className="flex items-center gap-3 border border-border p-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />{" "}
            {text("Loading your checklist…")}
          </div>
        ) : query.isError ? (
          <div
            role="alert"
            className="border border-destructive/30 bg-destructive/5 p-6 text-destructive"
          >
            <p className="font-semibold">
              {query.error instanceof Error
                ? query.error.message
                : text("Could not load this application.")}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-10"
              onClick={() => query.refetch()}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : (
          <ChecklistResult project={query.data} />
        )}
      </div>
    </div>
  );
}
