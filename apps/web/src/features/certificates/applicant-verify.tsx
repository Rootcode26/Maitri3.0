"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, Search, ShieldX } from "lucide-react";
import { useState } from "react";

import { useLanguage } from "@/components/providers/language-provider";
import { formatDate } from "@/i18n/format";
import { verifyCertificate } from "@/features/inspector/inspector-api";

export function ApplicantVerifyCertificate() {
  const { t, language } = useLanguage();
  const [input, setInput] = useState("");
  const [code, setCode] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["certificate-verify", code],
    queryFn: () => verifyCertificate(code as string),
    enabled: Boolean(code),
    retry: false,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (trimmed) setCode(trimmed);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6 sm:py-9">
      <header className="border-b border-border pb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {t("certificate.verifyTitle")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("certificate.verifyIntro")}</p>
      </header>

      <form onSubmit={submit} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-sm font-medium text-foreground">
            {t("certificate.verifyCodeLabel")}
          </span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("certificate.verifyCodePlaceholder")}
            className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors hover:border-border focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </label>
        <button
          type="submit"
          disabled={!input.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          <Search className="size-4" aria-hidden="true" />
          {t("certificate.verifyAction")}
        </button>
      </form>

      {code ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
          {query.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              {t("certificate.verifyChecking")}
            </div>
          ) : query.isError ? (
            <p className="py-6 text-center font-semibold text-amber-800">
              {t("certificate.verifyError")}
            </p>
          ) : !query.data ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-red-800">
              <ShieldX className="size-9" aria-hidden="true" />
              <p className="font-semibold">{t("certificate.verifyNotFound")}</p>
            </div>
          ) : (
            <div className="space-y-4 duration-500 animate-in fade-in">
              {query.data.valid ? (
                <div className="flex flex-col items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 py-5 text-center text-emerald-800">
                  <BadgeCheck className="size-10" aria-hidden="true" />
                  <p className="text-lg font-bold">{t("certificate.verifyValid")}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-md border border-red-300 bg-red-50 py-5 text-center text-red-800">
                  <ShieldX className="size-10" aria-hidden="true" />
                  <p className="text-lg font-bold">{t("certificate.verifyRevoked")}</p>
                </div>
              )}
              <dl className="divide-y divide-border text-sm">
                <Row label={t("certificate.number")} value={query.data.certificateNumber} />
                <Row label={t("certificate.enterprise")} value={query.data.enterpriseName} />
                <Row label={t("certificate.district")} value={query.data.district} />
                <Row
                  label={t("certificate.issuedOn")}
                  value={formatDate(query.data.issuedAt, language)}
                />
              </dl>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
