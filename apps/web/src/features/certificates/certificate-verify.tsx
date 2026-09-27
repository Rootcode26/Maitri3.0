"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, ShieldAlert, ShieldX } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { formatDate } from "@/i18n/format";
import { verifyCertificate } from "@/features/inspector/inspector-api";

export function CertificateVerify({ code }: { code: string }) {
  const { t, language } = useLanguage();
  const query = useQuery({
    queryKey: ["certificate-verify", code],
    queryFn: () => verifyCertificate(code),
    retry: false,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#142b45]">{t("certificate.verifyTitle")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("certificate.verifySubtitle")}</p>
      </div>

      <div className="rounded-lg border border-[#d8d3c8] bg-white p-6 shadow-sm">
        {query.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            {t("certificate.verifyChecking")}
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-amber-800">
            <ShieldAlert className="size-10" aria-hidden="true" />
            <p className="font-semibold">{t("certificate.verifyError")}</p>
          </div>
        ) : !query.data ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-red-800">
            <ShieldX className="size-10" aria-hidden="true" />
            <p className="font-semibold">{t("certificate.verifyNotFound")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {query.data.valid ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 py-6 text-center text-emerald-800">
                <BadgeCheck className="size-12" aria-hidden="true" />
                <p className="text-lg font-bold">{t("certificate.verifyValid")}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-md border border-red-300 bg-red-50 py-6 text-center text-red-800">
                <ShieldX className="size-12" aria-hidden="true" />
                <p className="text-lg font-bold">{t("certificate.verifyRevoked")}</p>
              </div>
            )}
            <dl className="divide-y divide-[#eee] text-sm">
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
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-[#142b45]">{value}</dd>
    </div>
  );
}
