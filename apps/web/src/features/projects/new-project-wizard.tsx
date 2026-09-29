"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Info,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  Fragment,
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import { DocumentCollection } from "@/features/projects/document-collection";
import {
  createProject,
  listProjectDocuments,
  ProjectApiError,
  validateProjectDocuments,
  submitProject,
  type Project,
  type ProjectApproval,
  type ProjectDocument,
  type ValidationIssue,
  type ValidationResult,
} from "@/features/projects/project-api";

type FieldType = "text" | "select" | "number" | "textarea" | "checkboxes";

type Field = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  options?: string[];
  /** For checkbox groups: options ticked on first render. */
  checkedByDefault?: string[];
  /** Half-width on desktop so two fields sit side by side. */
  half?: boolean;
  /** Renders a full-width section divider above this field. */
  sectionStart?: string;
  /** Only show this field when another field currently equals a value. */
  showIf?: { field: string; equals: string };
};

type Step = {
  id: string;
  label: string;
  title: string;
  description: string;
  /** Pill text shown top-right of the panel (defaults to "In progress"). */
  badge?: string;
  fields: Field[];
};

const steps: Step[] = [
  {
    id: "business",
    label: "Business",
    title: "Business details",
    description: "Tell us about the enterprise applying for approvals.",
    fields: [
      {
        name: "enterpriseName",
        label: "Enterprise name",
        type: "text",
        placeholder: "Sahyadri Foods Pvt. Ltd.",
        required: true,
        half: true,
      },
      {
        name: "orgType",
        label: "Organisation type",
        type: "select",
        options: [
          "Private limited company",
          "Public limited company",
          "Partnership",
          "Proprietorship",
          "LLP",
        ],
        required: true,
        half: true,
      },
      {
        name: "industry",
        label: "Industry sector",
        type: "select",
        options: ["Food processing", "Textiles", "Steel & metals"],
        required: true,
        half: true,
      },
      {
        name: "cin",
        label: "CIN / registration number",
        type: "text",
        placeholder: "U15490PN2026PTC00124",
        helper: "As printed on your certificate of incorporation.",
        half: true,
      },
      {
        name: "pan",
        label: "Business PAN",
        type: "text",
        placeholder: "AABCS1234F",
        required: true,
        half: true,
      },
      {
        name: "gstin",
        label: "GSTIN",
        type: "text",
        placeholder: "27AABCS1234F1Z5",
        half: true,
      },
      {
        name: "udyam",
        label: "Udyam / MSME registration",
        type: "text",
        placeholder: "UDYAM-MH-00-0000000",
        helper: "Optional — used for MSME classification and incentives.",
      },
    ],
  },
  {
    id: "location",
    label: "Location",
    title: "Location details",
    description: "Where will the industrial unit operate?",
    fields: [
      {
        name: "district",
        label: "District",
        type: "text",
        placeholder: "Pune",
        required: true,
        half: true,
      },
      {
        name: "taluka",
        label: "Taluka / tehsil",
        type: "text",
        placeholder: "Khed",
        half: true,
      },
      {
        name: "pincode",
        label: "PIN code",
        type: "text",
        placeholder: "410501",
        required: true,
        half: true,
      },
      {
        name: "industrialArea",
        label: "Industrial area / estate",
        type: "text",
        placeholder: "Chakan MIDC",
        half: true,
      },
      {
        name: "plotNumber",
        label: "Plot / survey number",
        type: "text",
        placeholder: "Plot D-42",
        half: true,
      },
      {
        name: "plotArea",
        label: "Plot area (sq. m)",
        type: "select",
        options: [
          "Up to 500",
          "500–2,000",
          "2,000–5,000",
          "5,000–10,000",
          "Above 10,000",
        ],
        required: true,
        half: true,
      },
      {
        name: "builtUpArea",
        label: "Built-up area (sq. m)",
        type: "select",
        options: ["Up to 250", "250–1,000", "1,000–5,000", "Above 5,000"],
        helper: "Covered construction — used for fire and building approvals.",
        half: true,
      },
      {
        name: "landStatus",
        label: "Land status",
        type: "select",
        options: ["Owned", "Leased", "Allotted (MIDC)", "Under acquisition"],
        required: true,
        half: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    title: "Operations details",
    description: "Describe what the unit will manufacture or process.",
    fields: [
      // Options are replaced per selected industry (see activityOptions).
      {
        name: "primaryActivity",
        label: "Primary activity",
        type: "select",
        options: [],
        required: true,
        half: true,
      },
      {
        name: "projectStage",
        label: "Project stage",
        type: "select",
        options: ["New unit", "Expansion", "Modernisation"],
        required: true,
        half: true,
      },
      {
        name: "investment",
        label: "Proposed investment",
        type: "select",
        options: [
          "Up to ₹100 lakh (Micro)",
          "₹100–1,000 lakh (Small)",
          "₹1,000–5,000 lakh (Medium)",
          "Above ₹5,000 lakh (Large)",
        ],
        half: true,
      },
      {
        name: "capacity",
        label: "Installed capacity",
        type: "text",
        placeholder: "18 tonnes / day",
        half: true,
      },
      {
        name: "shifts",
        label: "Operating shifts",
        type: "select",
        options: ["One shift", "Two shifts", "Three shifts"],
        half: true,
      },
      {
        name: "boiler",
        label: "Boiler / pressure vessel on site?",
        type: "select",
        options: ["No", "Yes"],
        required: true,
        half: true,
      },
      {
        name: "boilerCapacity",
        label: "Boiler capacity (TPH)",
        type: "select",
        options: ["Up to 1", "1–5", "5–10", "Above 10"],
        required: true,
        half: true,
        showIf: { field: "boiler", equals: "Yes" },
      },
      {
        name: "boilerPressure",
        label: "Working pressure (kg/cm²)",
        type: "number",
        placeholder: "10.5",
        helper: "Declared to the Directorate of Steam Boilers.",
        half: true,
        showIf: { field: "boiler", equals: "Yes" },
      },
      {
        name: "hazardousChemicals",
        label: "Stores or handles hazardous chemicals?",
        type: "select",
        options: ["No", "Yes"],
        required: true,
        half: true,
      },
      {
        name: "processes",
        label: "Processes used",
        type: "checkboxes",
        options: [
          "Manufacturing / processing",
          "Packaging and storage",
          "Boiler operation",
          "On-site effluent treatment",
        ],
        checkedByDefault: [
          "Manufacturing / processing",
          "Packaging and storage",
        ],
      },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    title: "Utilities details",
    description: "Power, water and effluent characteristics.",
    fields: [
      {
        name: "electricity",
        label: "Electricity demand (kVA)",
        type: "select",
        options: ["Up to 50", "50–100", "100–500", "500–1,000", "Above 1,000"],
        required: true,
        half: true,
      },
      {
        name: "dgSet",
        label: "DG set capacity (kVA)",
        type: "select",
        options: ["None", "Up to 125", "125–500", "500–1,000", "Above 1,000"],
        helper: "Diesel generators trigger air-emission consent.",
        half: true,
      },
      {
        name: "waterUse",
        label: "Daily water use (KL)",
        type: "select",
        options: ["Up to 10", "10–50", "50–100", "100–500", "Above 500"],
        required: true,
        half: true,
      },
      {
        name: "waterSource",
        label: "Water source",
        type: "select",
        options: [
          "MIDC supply",
          "Municipal supply",
          "Borewell",
          "Surface water",
          "Tanker",
        ],
        half: true,
      },
      {
        name: "wastewater",
        label: "Wastewater discharge",
        type: "select",
        options: [
          "Common treatment facility",
          "On-site treatment plant",
          "No discharge (zero liquid)",
          "Municipal sewer",
        ],
        required: true,
        half: true,
      },
      {
        name: "hazardousWaste",
        label: "Generates hazardous waste?",
        type: "select",
        options: ["No", "Yes"],
        required: true,
        half: true,
      },
    ],
  },
  {
    id: "workforce",
    label: "Workforce",
    title: "Workforce details",
    description: "Staffing informs labour and safety clearances.",
    fields: [
      {
        name: "permanent",
        label: "Permanent employees",
        type: "select",
        options: [
          "Less than 10",
          "10–19",
          "20–49",
          "50–99",
          "100–499",
          "500 or more",
        ],
        required: true,
        half: true,
      },
      {
        name: "contract",
        label: "Contract workers",
        type: "select",
        options: ["None", "1–19", "20–49", "50 or more"],
        half: true,
      },
      {
        name: "womenNight",
        label: "Women employed in night shift",
        type: "select",
        options: ["No", "Yes"],
        half: true,
      },
      {
        name: "accommodation",
        label: "Worker accommodation",
        type: "select",
        options: ["Not provided", "On-site quarters", "Nearby housing"],
        half: true,
      },
    ],
  },
];

/**
 * Extra Operations fields that only apply to a specific industry sector.
 * Keyed by the "industry" answer selected on the Business step.
 */
const industryFields: Record<string, Field[]> = {
  "Food processing": [
    {
      name: "fssaiCategory",
      label: "FSSAI licence category",
      type: "select",
      options: ["Central licence", "State licence", "Basic registration"],
      required: true,
      half: true,
      sectionStart: "Specific to food processing",
    },
    {
      name: "coldStorage",
      label: "Cold storage capacity (MT)",
      type: "select",
      options: ["None", "Up to 50", "50–500", "500–2,000", "Above 2,000"],
      helper: "Select None if no cold chain is used.",
      half: true,
    },
  ],
  Textiles: [
    {
      name: "wetProcessing",
      label: "Involves dyeing / bleaching?",
      type: "select",
      options: ["No", "Yes"],
      required: true,
      helper: "Wet processing raises MPCB effluent requirements.",
      half: true,
      sectionStart: "Specific to textiles",
    },
    {
      name: "loomsSpindles",
      label: "Looms / spindles installed",
      type: "select",
      options: ["Up to 50", "50–200", "200–500", "Above 500"],
      half: true,
    },
  ],
  "Steel & metals": [
    {
      name: "furnaceType",
      label: "Furnace type",
      type: "select",
      options: ["Induction furnace", "Electric arc furnace", "Cupola", "None"],
      required: true,
      half: true,
      sectionStart: "Specific to steel & metals",
    },
    {
      name: "furnaceCapacity",
      label: "Furnace capacity (MT / heat)",
      type: "select",
      options: ["Up to 5", "5–20", "20–50", "Above 50"],
      half: true,
    },
  ],
};

/** Primary-activity options depend on the chosen industry sector. */
const activityOptions: Record<string, string[]> = {
  "Food processing": [
    "Food & beverage processing",
    "Dairy & cold storage",
    "Bakery & confectionery",
    "Meat & seafood processing",
  ],
  Textiles: [
    "Spinning",
    "Weaving",
    "Knitting",
    "Dyeing & processing",
    "Garment manufacturing",
  ],
  "Steel & metals": [
    "Steel & metal fabrication",
    "Foundry / casting",
    "Rolling mill",
    "Structural fabrication",
  ],
};

/** Installed-capacity is measured in different units per industry sector. */
const capacityHint: Record<string, { placeholder: string; helper: string }> = {
  "Food processing": {
    placeholder: "18 tonnes / day",
    helper: "Processed output per day.",
  },
  Textiles: {
    placeholder: "60,000 metres / month",
    helper: "Fabric or yarn output per month.",
  },
  "Steel & metals": {
    placeholder: "500 MT / month",
    helper: "Metal output in tonnes per month.",
  },
};

const totalSteps = steps.length + 1; // + checklist

/**
 * Required fields across every step given the collected answers, honouring
 * industry-specific fields and conditional (showIf) visibility. Used to catch
 * gaps before submitting, since the stepper rail lets users skip validation.
 */
function requiredFieldsFor(
  answers: Record<string, string>,
): { name: string; label: string; stepIndex: number }[] {
  const industry = answers.industry ?? "";
  const result: { name: string; label: string; stepIndex: number }[] = [];
  steps.forEach((step, stepIndex) => {
    const fields =
      step.id === "operations"
        ? [...step.fields, ...(industryFields[industry] ?? [])]
        : step.fields;
    for (const field of fields) {
      if (!field.required) continue;
      if (
        field.showIf &&
        (answers[field.showIf.field] ?? "") !== field.showIf.equals
      )
        continue;
      result.push({ name: field.name, label: field.label, stepIndex });
    }
  });
  return result;
}

function FieldControl({
  field,
  error,
  describedById,
  defaultValue,
}: {
  field: Field;
  error?: string;
  describedById: string;
  defaultValue?: string;
}) {
  const { t, text } = useLanguage();
  const base =
    "w-full rounded-lg border bg-card px-3.5 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:border-primary aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/25";
  const invalid = Boolean(error);
  const common = {
    id: field.name,
    name: field.name,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedById || undefined,
  };

  if (field.type === "textarea") {
    return (
      <textarea
        {...common}
        rows={4}
        defaultValue={defaultValue}
        placeholder={field.placeholder ? text(field.placeholder) : undefined}
        className={`${base} min-h-28 resize-y py-3 leading-relaxed`}
      />
    );
  }
  if (field.type === "select") {
    return (
      <div className="relative">
        <select
          {...common}
          defaultValue={defaultValue ?? ""}
          className={`${base} h-12 appearance-none pr-10`}
        >
          <option value="" disabled>
            {t("wizard.selectOption")}
          </option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {text(opt)}
            </option>
          ))}
        </select>
        <ArrowRight
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 rotate-90 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  }
  return (
    <input
      {...common}
      type={field.type}
      defaultValue={defaultValue}
      placeholder={field.placeholder ? text(field.placeholder) : undefined}
      className={`${base} h-12`}
    />
  );
}

function ApprovalCard({
  approval,
  index,
  onOpen,
}: {
  approval: ProjectApproval;
  index: number;
  onOpen: () => void;
}) {
  const { text } = useLanguage();
  const required = approval.status === "required";
  return (
    <article className="flex flex-col rounded-xl bg-card p-6 ring-1 ring-border transition-shadow hover:ring-2 hover:ring-primary/50 focus-within:ring-2 focus-within:ring-primary">
      <div className="flex items-start justify-between">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold capitalize ${required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          <span
            className={`size-2 rounded-full ${required ? "bg-primary" : "bg-slate-500"}`}
            aria-hidden="true"
          />
          {text(required ? "Required" : "Recommended")}
        </span>
        <span className="text-4xl font-bold text-slate-200" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-4 font-heading text-xl font-semibold text-foreground">
        {text(approval.title)}
      </h3>
      <div className="mt-2">
        <p className="text-xs font-medium text-muted-foreground">
          {text("Assigned department")}
        </p>
        <div className="mt-1 flex min-h-10 items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
          <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{text(approval.department.name)}</span>
        </div>
      </div>
      {approval.reason ? (
        <p className="mt-2 text-sm text-muted-foreground">{text(approval.reason)}</p>
      ) : null}
      <hr className="my-4 border-border" />
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">
          {approval.documents.map((document) => text(document.name)).join(", ")}
        </span>
        <span className="shrink-0 font-semibold text-foreground">
          {text("{{count}} days", { count: approval.processingDays })}
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 inline-flex items-center gap-1 self-start rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {text(
          approval.documents.length === 1
            ? "View {{count}} document requirement"
            : "View {{count}} document requirements",
          { count: approval.documents.length },
        )}
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </article>
  );
}

/** Placeholder cards shown while the checklist is being generated. */
function ChecklistSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse motion-reduce:animate-none"
    >
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="mt-3 h-10 w-72 rounded bg-slate-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-muted" />
      <hr className="my-6 border-border" />
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl bg-card p-6 ring-1 ring-border"
          >
            <div className="flex items-start justify-between">
              <div className="h-6 w-24 rounded-full bg-slate-200" />
              <div className="h-8 w-8 rounded bg-muted" />
            </div>
            <div className="mt-4 h-6 w-3/4 rounded bg-slate-200" />
            <div className="mt-3 h-9 w-full rounded-md bg-muted" />
            <hr className="my-4 border-border" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="mt-4 h-4 w-40 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function IssueList({
  title,
  issues,
  tone,
  onOpenApproval,
}: {
  title: string;
  issues: ValidationIssue[];
  tone: "error" | "warning" | "review";
  onOpenApproval?: (approvalKey: string) => void;
}) {
  const { text } = useLanguage();
  if (issues.length === 0) return null;
  const toneClass = {
    error: "border-destructive/30 bg-destructive/5 text-destructive",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    review: "border-border bg-muted text-foreground",
  }[tone];
  return (
    <div className={`mt-4 rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-2">
        {issues.map((issue, index) => (
          <li
            key={`${issue.code}-${index}`}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <span>
              <span className="font-medium">{text(issue.message)}</span>
              {issue.suggestedAction ? (
                <span className="mt-0.5 block text-xs opacity-80">
                  {text(issue.suggestedAction)}
                </span>
              ) : null}
            </span>
            {issue.approvalKey && onOpenApproval ? (
              <button
                type="button"
                onClick={() => onOpenApproval(issue.approvalKey!)}
                className="shrink-0 rounded-sm text-xs font-semibold underline underline-offset-4 hover:opacity-80 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                {text("Review documents")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ValidationReport({
  result,
  approvals,
  onOpenApproval,
}: {
  result: ValidationResult;
  approvals: ProjectApproval[];
  onOpenApproval?: (approvalKey: string) => void;
}) {
  const { text } = useLanguage();
  // "Verified" here means only that nothing is blocking submission. Uploaded
  // documents are still read and cross-checked, and any officer-review items are
  // shown so we never imply a document was fully authenticated automatically.
  const verified = result.blockingIssues.length === 0;
  const hasReview = result.reviewItems.length > 0;

  if (!verified) {
    return (
      <div className="mt-5">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
          <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">
              {text("Not verified yet — a few things need your attention")}
            </p>
            <p className="mt-0.5 text-sm opacity-90">
              {text(
                "Fix the items below, then run “Check documents” again. You can submit once these are cleared.",
              )}
            </p>
          </div>
        </div>
        <IssueList
          title={text("Must be fixed before submitting")}
          issues={result.blockingIssues}
          tone="error"
          onOpenApproval={onOpenApproval}
        />
        <IssueList
          title={text("Also worth double-checking")}
          issues={result.warnings}
          tone="warning"
          onOpenApproval={onOpenApproval}
        />
        <IssueList
          title={text("An officer will review these")}
          issues={result.reviewItems}
          tone="review"
          onOpenApproval={onOpenApproval}
        />
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
        <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">
            {hasReview
              ? text("No blocking problems found")
              : text("Verified by our system")}
          </p>
          <p className="mt-0.5 text-sm opacity-90">
            {hasReview
              ? text(
                  "Nothing is stopping you from submitting. We read your documents and cross-checked their details against your answers; the department officer will confirm the items below.",
                )
              : text(
                  "Your documents passed all automated checks. Nothing else is needed from you right now — you can submit.",
                )}
          </p>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <IssueList
          title={text("Optional — you may want to double-check these")}
          issues={result.warnings}
          tone="warning"
          onOpenApproval={onOpenApproval}
        />
      )}

      <IssueList
        title={text("An officer will review these")}
        issues={result.reviewItems}
        tone="review"
        onOpenApproval={onOpenApproval}
      />

      <div className="mt-4 rounded-lg border border-border bg-card px-4 py-4">
        <p className="text-sm font-semibold text-foreground">
          {text("What happens after you submit")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {text(
            "Each department’s officer will review the documents assigned to them:",
          )}
        </p>
        <ul className="mt-3 space-y-3">
          {approvals.map((approval) => {
            const required = approval.documents.filter(
              (doc) => doc.required !== false,
            );
            const docs = required.length ? required : approval.documents;
            return (
              <li
                key={approval.approvalKey}
                className="rounded-md bg-muted px-3 py-3 ring-1 ring-[#eee9dd]"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Building2
                    className="size-4 shrink-0 text-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {approval.department?.name ?? text("Assigned department")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {text("for")} {text(approval.title)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 pl-6">
                  {docs.map((doc) => (
                    <li
                      key={doc.key}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <Check
                        className="size-3.5 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                      {doc.name}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {text(
            "Our system confirms your files are present and readable. An officer always verifies the actual contents — this review step is normal and needs nothing further from you.",
          )}
        </p>
      </div>
    </div>
  );
}

export function ChecklistResult({ project }: { project: Project }) {
  const { t, text } = useLanguage();
  const [savedProject, setSavedProject] = useState(project);
  const approvals = project.approvals;
  const [openApproval, setOpenApproval] = useState<ProjectApproval | null>(
    null,
  );
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    listProjectDocuments(project.id)
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, [project.id]);

  async function runValidation() {
    setValidating(true);
    setValidationError(null);
    try {
      setValidation(await validateProjectDocuments(project.id));
    } catch (cause) {
      setValidationError(
        cause instanceof ProjectApiError
          ? cause.message
          : text("Could not validate the documents."),
      );
    } finally {
      setValidating(false);
    }
  }

  // The applicant may submit only after a check that surfaced no blocking
  // issues. Warnings and officer-review items are allowed through — the server
  // enforces the same rule, this just mirrors it so the button reflects intent.
  const hasBlockingIssues = (validation?.blockingIssues.length ?? 0) > 0;
  const canSubmit = validation !== null && !hasBlockingIssues;

  async function submitApplication() {
    setSubmittingApplication(true);
    setSubmissionError(null);
    try {
      setSavedProject(await submitProject(project.id));
    } catch (cause) {
      setSubmissionError(
        cause instanceof ProjectApiError
          ? cause.message
          : text("Could not submit the application."),
      );
    } finally {
      setSubmittingApplication(false);
    }
  }

  if (openApproval) {
    return (
      <DocumentCollection
        projectId={project.id}
        approvalKey={openApproval.approvalKey}
        approvalTitle={openApproval.title}
        documents={openApproval.documents}
        uploaded={documents.filter(
          (doc) => doc.approvalKey === openApproval.approvalKey,
        )}
        onBack={() => setOpenApproval(null)}
        onUploadedChange={(next) =>
          setDocuments((current) => [
            ...current.filter(
              (doc) => doc.approvalKey !== openApproval.approvalKey,
            ),
            ...next,
          ])
        }
      />
    );
  }

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">
            {text("Checklist generated")}
          </p>
          <h2 className="mt-1 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {text("{{count}} approvals recommended", { count: approvals.length })}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">
            {project.enterpriseName} · {text(project.primaryActivity)} ·{" "}
            {text("{{district}} district", { district: text(project.district) })}
          </p>
        </div>
      </header>

      <hr className="my-6 border-border" />

      <section
        aria-label={t("wizard.checklist")}
        className="grid gap-5 sm:grid-cols-2"
      >
        {approvals.map((approval, index) => (
          <ApprovalCard
            key={approval.approvalKey}
            approval={approval}
            index={index}
            onOpen={() => setOpenApproval(approval)}
          />
        ))}
      </section>

      <aside className="mt-6 border-l-4 border-amber-500 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900">
        <strong>{t("wizard.whyApprovals")}</strong> {t("wizard.approvalRationale")}
      </aside>

      <section className="mt-6 rounded-2xl bg-card p-6 ring-1 ring-border sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-heading text-xl font-semibold text-foreground">
              {t("wizard.checkDocuments")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {text("Run a pre-submission check on the documents you have uploaded so far.")}
            </p>
          </div>
          <Button
            size="lg"
            className="h-11 rounded-full px-6"
            onClick={runValidation}
            disabled={validating}
            aria-busy={validating}
          >
            {validating
              ? t("common.loading")
              : validation
                ? t("wizard.checkDocuments")
                : t("wizard.checkDocuments")}
            {validating ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <ShieldCheck className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        {validationError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
          >
            {validationError}
          </p>
        )}

        {validation && !validationError && (
          <ValidationReport
            result={validation}
            approvals={approvals}
            onOpenApproval={(approvalKey) => {
              const approval = approvals.find(
                (a) => a.approvalKey === approvalKey,
              );
              if (approval) setOpenApproval(approval);
            }}
          />
        )}
      </section>

      <section className="mt-6 border border-border bg-muted p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-heading text-xl font-semibold text-foreground">
              {savedProject.status === "draft"
                ? t("wizard.submitForReview")
                : t("wizard.applicationSubmitted")}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {savedProject.status === "draft"
                ? t("wizard.documentsReady")
                : t("wizard.departmentsCanReview")}
            </p>
          </div>
          {savedProject.status === "draft" ? (
            <Button
              size="lg"
              className="h-11 rounded-md px-6"
              onClick={submitApplication}
              disabled={submittingApplication || !canSubmit}
              aria-busy={submittingApplication}
            >
              {submittingApplication ? t("wizard.submitting") : t("wizard.submitApplication")}
              {submittingApplication ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </Button>
          ) : (
            <span className="border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {text("Submitted")}
            </span>
          )}
        </div>
        {submissionError ? (
          <p
            role="alert"
            className="mt-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
          >
            {submissionError}
          </p>
        ) : savedProject.status === "draft" && !canSubmit ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {validation === null
              ? "Run “Check documents” above before submitting."
              : "Resolve the blocking issues above, then re-check to enable submission."}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function NewProjectWizard() {
  const { t, text } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Project | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Live values for fields on the current step, so conditional fields can
  // react as the user changes a control (before we capture on navigation).
  const [watched, setWatched] = useState<Record<string, string>>({});
  const errorPrefix = useId();

  const isChecklist = current === steps.length;
  const step = steps[current];
  const progress = Math.round(((current + 1) / totalSteps) * 100);

  // Fields for the current step, plus any industry-specific fields for the
  // Operations step based on the sector chosen on the Business step.
  const selectedIndustry = answers.industry ?? "";
  const currentValue = (name: string) => watched[name] ?? answers[name] ?? "";
  const isVisible = (field: Field) =>
    !field.showIf || currentValue(field.showIf.field) === field.showIf.equals;
  const activeFields: Field[] = isChecklist
    ? []
    : (step.id === "operations"
        ? [...step.fields, ...(industryFields[selectedIndustry] ?? [])].map(
            (field) => {
              if (field.name === "primaryActivity") {
                return {
                  ...field,
                  options: activityOptions[selectedIndustry] ?? field.options,
                };
              }
              if (field.name === "capacity" && capacityHint[selectedIndustry]) {
                return { ...field, ...capacityHint[selectedIndustry] };
              }
              return field;
            },
          )
        : step.fields
      ).filter(isVisible);

  const stepList = useMemo(
    () => [
      ...steps.map((s) => ({ id: s.id, label: s.label })),
      { id: "checklist", label: "Checklist" },
    ],
    [],
  );

  const summary = [
    { label: "Industry", value: answers.industry || "—" },
    { label: "Activity", value: answers.primaryActivity || "—" },
    { label: "District", value: answers.district || "—" },
    { label: "Permanent employees", value: answers.permanent || "—" },
  ];

  function validate(): boolean {
    if (isChecklist) return true;
    const form = document.getElementById(
      "wizard-form",
    ) as HTMLFormElement | null;
    const next: Record<string, string> = {};
    for (const field of activeFields) {
      if (!field.required) continue;
      const value = (
        form?.elements.namedItem(field.name) as HTMLInputElement | null
      )?.value?.trim();
      if (!value) next[field.name] = t("wizard.requiredError", { field: text(field.label) });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /** Read the current step's field values out of the DOM before we navigate away. */
  function captureForm() {
    if (isChecklist) return;
    const form = document.getElementById(
      "wizard-form",
    ) as HTMLFormElement | null;
    if (!form) return;
    const captured: Record<string, string> = {};
    for (const field of activeFields) {
      if (field.type === "checkboxes") {
        const checked = Array.from(
          form.querySelectorAll<HTMLInputElement>(
            `input[name="${field.name}"]:checked`,
          ),
        ).map((el) => el.value);
        captured[field.name] = checked.join(", ");
      } else {
        const el = form.elements.namedItem(field.name) as
          HTMLInputElement | HTMLSelectElement | null;
        if (el) captured[field.name] = el.value.trim();
      }
    }
    setAnswers((prev) => ({ ...prev, ...captured }));
  }

  // Track live control values so conditional fields react before navigation.
  function handleFieldChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target as
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (target?.name)
      setWatched((prev) => ({ ...prev, [target.name]: target.value }));
  }

  function goTo(index: number) {
    captureForm();
    setErrors({});
    setWatched({});
    setCurrent(index);
  }

  function handleContinue() {
    if (!validate()) {
      const firstError = document.querySelector(
        "[aria-invalid='true']",
      ) as HTMLElement | null;
      firstError?.focus();
      return;
    }
    captureForm();
    setWatched({});
    setCompleted((prev) => new Set(prev).add(current));
    setCurrent((c) => Math.min(c + 1, totalSteps - 1));
  }

  async function handleGenerate() {
    // Catch missing required answers before the request, and send the user to
    // the earliest step that needs attention with inline errors shown.
    const missing = requiredFieldsFor(answers).filter(
      (field) => !(answers[field.name] ?? "").trim(),
    );
    if (missing.length > 0) {
      setErrors(
        Object.fromEntries(
          missing.map((field) => [field.name, t("wizard.requiredError", { field: text(field.label) })]),
        ),
      );
      setSubmitError(
        t("wizard.completeFields", { fields: missing.map((field) => text(field.label)).join(", ") }),
      );
      setWatched({});
      setCurrent(Math.min(...missing.map((field) => field.stepIndex)));
      return;
    }

    const allIndustrySpecific = Object.values(industryFields)
      .flat()
      .map((field) => field.name);
    const keepForIndustry = new Set(
      (industryFields[answers.industry ?? ""] ?? []).map((field) => field.name),
    );
    const cleaned = { ...answers };
    for (const name of allIndustrySpecific) {
      if (!keepForIndustry.has(name)) delete cleaned[name];
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      setResult(await createProject(cleaned));
    } catch (cause) {
      setSubmitError(
        cause instanceof ProjectApiError
          ? cause.message
          : text("Could not save the project. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <ChecklistResult project={result} />;
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[0_20px_50px_-24px_rgba(20,43,69,0.35)] ring-1 ring-border md:grid md:grid-cols-[19rem_1fr]">
      {/* Stepper rail */}
      <div className="bg-[#142b45] px-6 py-7 text-white sm:px-8">
        <div className="mb-7">
          <div className="flex items-center justify-between text-xs font-medium text-slate-300">
            <span>{t("wizard.progress")}</span>
            <span>{progress}%</span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-card/15"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ol className="space-y-1.5">
          {stepList.map((s, index) => {
            const isDone = completed.has(index) && index !== current;
            const isCurrent = index === current;
            const reachable = index <= current || completed.has(index);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => reachable && goTo(index)}
                  disabled={!reachable}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                    isCurrent
                      ? "bg-primary shadow-sm"
                      : reachable
                        ? "hover:bg-card/10"
                        : "cursor-not-allowed opacity-55"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold ${
                      isCurrent
                        ? "border-white bg-card text-primary"
                        : isDone
                          ? "border-amber-400 text-amber-400"
                          : "border-white/40 text-slate-200"
                    }`}
                  >
                    {isDone ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={`text-sm font-medium ${isCurrent ? "text-white" : isDone ? "text-amber-400" : "text-slate-200"}`}
                  >
                    {text(s.label)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Form panel */}
      <div className="px-6 py-7 sm:px-10 sm:py-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("wizard.stepOf", { current: current + 1, total: totalSteps })}
            </p>
            <h2 className="mt-1 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
              {isChecklist ? t("wizard.checklist") : text(step.title)}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isChecklist
                ? t("wizard.confirmClearances")
                : text(step.description)}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary">
            <span
              className="size-2 rounded-full bg-primary"
              aria-hidden="true"
            />
            {isChecklist
              ? t("wizard.review")
              : step.id === "operations" && selectedIndustry
                ? text(selectedIndustry)
                : (step.badge ? text(step.badge) : t("wizard.inProgress"))}
          </span>
        </div>

        <hr className="my-6 border-border" />

        {isChecklist && submitting ? (
          <ChecklistSkeleton />
        ) : isChecklist ? (
          <div className="rounded-2xl border border-border bg-muted px-6 py-7 sm:px-8">
            <h3 className="font-heading text-xl font-semibold text-foreground">
              {t("wizard.readyToGenerate")}
            </h3>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              {t("wizard.projectComplete")}
            </p>
            <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {summary.map((item) => (
                <div key={item.label}>
                  <dt className="text-sm text-muted-foreground">{text(item.label)}</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {item.value === "—" ? item.value : text(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <form
            key={`${step.id}-${selectedIndustry}`}
            id="wizard-form"
            className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2"
            onChange={handleFieldChange}
            onSubmit={(e) => e.preventDefault()}
          >
            {activeFields.map((field) => {
              const error = errors[field.name];
              const errorId = error ? `${errorPrefix}-${field.name}` : "";
              const helperId = field.helper
                ? `${errorPrefix}-${field.name}-help`
                : "";
              const describedBy = [errorId, helperId].filter(Boolean).join(" ");
              const sectionHeader = field.sectionStart ? (
                <div className="flex items-center gap-3 pt-2 sm:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {text(field.sectionStart)}
                  </span>
                  <span
                    className="h-px flex-1 bg-border"
                    aria-hidden="true"
                  />
                </div>
              ) : null;

              if (field.type === "checkboxes") {
                const saved = answers[field.name];
                const savedSet =
                  saved !== undefined
                    ? new Set(saved.split(", ").filter(Boolean))
                    : null;
                return (
                  <fieldset key={field.name} className="sm:col-span-2">
                    <legend className="mb-3 text-sm font-semibold text-foreground">
                      {text(field.label)}
                    </legend>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                      {field.options?.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-3 text-sm text-foreground"
                        >
                          <input
                            type="checkbox"
                            name={field.name}
                            value={opt}
                            defaultChecked={
                              savedSet
                                ? savedSet.has(opt)
                                : field.checkedByDefault?.includes(opt)
                            }
                            className="size-5 shrink-0 rounded accent-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          />
                          {text(opt)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              }

              return (
                <Fragment key={field.name}>
                  {sectionHeader}
                  <div
                    className={`flex flex-col gap-2 ${field.half ? "sm:col-span-1" : "sm:col-span-2"}`}
                  >
                    <label
                      htmlFor={field.name}
                      className="text-sm font-semibold text-foreground"
                    >
                      {text(field.label)}
                      {field.required && (
                        <span className="ml-1 text-destructive">*</span>
                      )}
                    </label>
                    <FieldControl
                      field={field}
                      error={error}
                      describedById={describedBy}
                      defaultValue={answers[field.name]}
                    />
                    {field.helper && !error && (
                      <p id={helperId} className="text-xs text-muted-foreground">
                        {text(field.helper)}
                      </p>
                    )}
                    {error && (
                      <p
                        id={errorId}
                        className="text-xs font-medium text-destructive"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </form>
        )}

        <hr className="my-7 border-border" />

        {submitError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
          >
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="lg"
            className="h-11 rounded-full px-5"
            disabled={current === 0 || submitting}
            onClick={() => goTo(Math.max(current - 1, 0))}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("wizard.back")}
          </Button>
          {isChecklist ? (
            <Button
              size="lg"
              className="h-11 rounded-full px-6"
              onClick={handleGenerate}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? t("wizard.generating") : t("wizard.generateChecklist")}
              {submitting ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-11 rounded-full px-6"
              onClick={handleContinue}
            >
              {text("Save and continue")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
