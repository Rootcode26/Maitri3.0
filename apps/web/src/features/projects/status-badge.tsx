import { cn } from "cn";

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
      {humanizeStatus(status)}
    </span>
  );
}
