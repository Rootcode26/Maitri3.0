import { cn } from "cn";
import { useLanguage } from "@/components/providers/language-provider";
import type { TranslationKey } from "@/i18n/language/en";

export const statusTranslationKeys: Record<string, TranslationKey> = {
  draft: "status.draft", submitted: "status.submitted", under_review: "status.under_review",
  correction_required: "status.correction_required", approved: "status.approved", rejected: "status.rejected",
  pending: "status.pending", resolved: "status.resolved", open: "status.open", accepted: "status.accepted",
  responded: "status.responded", verified: "status.verified", expired: "status.expired",
  awaiting_verification: "status.awaiting_verification",
};

export function translateStatus(t: (key: TranslationKey) => string, status: string) {
  return statusTranslationKeys[status] ? t(statusTranslationKeys[status]) : humanizeStatus(status);
}

export function humanizeStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const tone =
    status === "approved" || status === "accepted" || status === "resolved"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : status === "rejected"
        ? "border-red-300 bg-red-50 text-red-800"
        : status === "correction_required" || status === "open"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : status === "under_review" || status === "responded"
            ? "border-blue-300 bg-blue-50 text-blue-800"
            : "border-slate-300 bg-slate-50 text-slate-700";
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-semibold",
        tone,
        className,
      )}
    >
      {translateStatus(t, status)}
    </span>
  );
}
