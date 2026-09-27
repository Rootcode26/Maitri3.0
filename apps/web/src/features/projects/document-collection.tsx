"use client";

import { ArrowLeft, Check, Loader2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/language-provider";
import {
  deleteProjectDocument,
  ProjectApiError,
  uploadProjectDocument,
  type ApprovalDocument,
  type ProjectDocument,
} from "@/features/projects/project-api";

type DocSpec = {
  key: string;
  name: string;
  formats: string[];
  maxSizeMb: number;
  filesRequired: string;
  description: string;
  mustInclude: string[];
  quality: string[];
  required: boolean;
};

const knownSpecs: Record<string, Omit<DocSpec, "key" | "name" | "required">> = {
  "food-premises-plan": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "A complete plan of the proposed food-processing premises.",
    mustInclude: [
      "Plot boundary, room names and dimensions",
      "Processing, packaging and storage areas",
      "Water points, drainage and entry / exit routes",
    ],
    quality: [
      "Upload one legible PDF with all drawing sheets in order. Include the drawing date and project name.",
      "Do not use password-protected files. Keep scans upright, readable and free of missing pages.",
    ],
  },
  "authorised-signatory-identity-proof": {
    formats: ["PDF", "JPG", "PNG"],
    maxSizeMb: 2,
    filesRequired: "1 complete file",
    description:
      "Government-issued identity proof of the authorised signatory.",
    mustInclude: [
      "Full name and photograph",
      "Document number clearly visible",
      "Not expired on the date of upload",
    ],
    quality: [
      "Upload a clear colour scan or photograph with all four corners visible.",
      "Avoid glare and shadows. Do not crop out any part of the document.",
    ],
  },
  "water-report": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "A laboratory water-quality test report for the site supply.",
    mustInclude: [
      "Sampling date and source location",
      "Tested parameters and permissible limits",
      "Accredited laboratory name and signature",
    ],
    quality: [
      "Upload the complete signed report as a single PDF.",
      "Ensure result tables are legible and pages are in order.",
    ],
  },
  "unit-plan": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "A layout plan of the proposed textile unit.",
    mustInclude: [
      "Plot boundary and built-up areas",
      "Spinning, weaving and processing sections",
      "Material movement and exit routes",
    ],
    quality: [
      "Upload one legible PDF with all sheets in order and a title block.",
      "Include a scale and north arrow. Do not use password-protected files.",
    ],
  },
  "machinery-list": {
    formats: ["PDF", "XLSX"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "An itemised list of installed plant and machinery.",
    mustInclude: [
      "Machine name, make and model",
      "Rated capacity and power (kW)",
      "Quantity and year of installation",
    ],
    quality: [
      "Provide a signed list as PDF, or an XLSX export.",
      "Group machines by process stage so reviewers can follow the flow.",
    ],
  },
  "ownership-proof": {
    formats: ["PDF", "JPG", "PNG"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "Proof of ownership or the right to use the premises.",
    mustInclude: [
      "Registered sale deed, lease or MIDC allotment letter",
      "Property / survey identifiers matching the site",
      "Valid dates and authorised signatures",
    ],
    quality: [
      "Upload the complete signed document as a single file.",
      "Ensure stamps and registration marks are legible.",
    ],
  },
  "factory-floor-plan": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "A floor plan of the factory building.",
    mustInclude: [
      "Room names, dimensions and machine positions",
      "Aisles, exits and emergency routes",
      "Utility and storage locations",
    ],
    quality: [
      "Upload one legible PDF with all floors in order.",
      "Include a north arrow and a drawing scale.",
    ],
  },
  "workforce-summary": {
    formats: ["PDF", "XLSX"],
    maxSizeMb: 2,
    filesRequired: "1 complete file",
    description: "A summary of the workforce to be employed.",
    mustInclude: [
      "Total, permanent and contract head-count",
      "Shift pattern and women employed",
      "Roles and safety-training status",
    ],
    quality: [
      "Provide a signed summary as PDF or XLSX.",
      "Do not include personal identity numbers.",
    ],
  },
  "fire-architectural-drawings": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "A fire-safety layout of the premises.",
    mustInclude: [
      "Fire exits, assembly points and travel distances",
      "Extinguisher, hydrant and alarm locations",
      "Fire tank and pump-room details",
    ],
    quality: [
      "Upload one legible PDF with a clear legend.",
      "Mark all safety equipment with standard symbols.",
    ],
  },
  "evacuation-plan": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "An emergency evacuation plan for the site.",
    mustInclude: [
      "Escape routes for each area",
      "Assembly points and head-count procedure",
      "Emergency contacts and responsibilities",
    ],
    quality: [
      "Upload a single legible PDF.",
      "Keep floor references consistent with the fire layout.",
    ],
  },
  "site-photograph": {
    formats: ["JPG", "PNG", "PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "Recent photographs of the site or building.",
    mustInclude: [
      "Building frontage and entry",
      "Surrounding access roads",
      "A visible date or landmark reference",
    ],
    quality: [
      "Upload clear, well-lit colour images.",
      "Avoid heavy compression, blur or filters.",
    ],
  },
  "water-balance": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "A water balance statement for the unit.",
    mustInclude: [
      "Fresh-water intake by source",
      "Process, domestic and cooling use",
      "Recycled and discharged quantities",
    ],
    quality: [
      "Provide a signed statement as a single PDF.",
      "Ensure figures reconcile with the declared water use.",
    ],
  },
  "waste-declaration": {
    formats: ["PDF"],
    maxSizeMb: 2,
    filesRequired: "1 complete file",
    description: "A declaration of waste generated and how it is handled.",
    mustInclude: [
      "Solid, liquid and hazardous waste types",
      "Estimated quantity per category",
      "Storage, treatment and disposal route",
    ],
    quality: [
      "Upload a signed declaration as PDF.",
      "List authorised handlers where applicable.",
    ],
  },
  "process-note": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "A description of the manufacturing process.",
    mustInclude: [
      "Process flow from input to output",
      "Emission, effluent and by-product points",
      "Key equipment at each stage",
    ],
    quality: [
      "Upload a concise, legible PDF with a flow diagram.",
      "Keep terminology consistent with the machinery list.",
    ],
  },
  "boiler-drawing": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "An approved drawing of the boiler or pressure vessel.",
    mustInclude: [
      "General arrangement and mounting details",
      "Design pressure, capacity and dimensions",
      "Safety fittings and mountings",
    ],
    quality: [
      "Upload the certified drawing as a single PDF.",
      "Include the manufacturer and drawing number.",
    ],
  },
  "manufacturer-inspection-test-records": {
    formats: ["PDF"],
    maxSizeMb: 2,
    filesRequired: "1 complete file",
    description: "A hydraulic or manufacturer test certificate.",
    mustInclude: [
      "Test date, pressure and result",
      "Boiler / vessel identification",
      "Inspector or manufacturer signature",
    ],
    quality: [
      "Upload the complete signed certificate.",
      "Ensure stamps and seals are legible.",
    ],
  },
  "feed-water-report": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "A feed-water quality report for the boiler.",
    mustInclude: [
      "Sampling date and source",
      "Tested parameters and permissible limits",
      "Accredited laboratory details",
    ],
    quality: [
      "Upload the complete signed report as one PDF.",
      "Ensure result tables are legible.",
    ],
  },
  "etp-design": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "The design of the effluent treatment plant.",
    mustInclude: [
      "Treatment stages and flow diagram",
      "Design capacity and retention times",
      "Target discharge-quality parameters",
    ],
    quality: [
      "Upload one legible PDF with all sheets in order.",
      "Include design calculations where available.",
    ],
  },
  "discharge-plan": {
    formats: ["PDF"],
    maxSizeMb: 5,
    filesRequired: "1 complete file",
    description: "The effluent discharge and disposal plan.",
    mustInclude: [
      "Discharge point and mode",
      "Quantity and quality at discharge",
      "CETP membership or consent reference",
    ],
    quality: [
      "Provide a signed plan as a single PDF.",
      "Keep figures consistent with the water balance.",
    ],
  },
};

/**
 * Builds the display spec for a document. The rules-engine fields take
 * precedence; anything the engine omits falls back to the built-in catalog
 * (keyed by document key, which both the engine and the built-in derivation
 * agree on) and then to generic defaults, so both the enriched engine
 * response and the minimal built-in derivation render fully.
 */
function specFor(document: ApprovalDocument): DocSpec {
  const known = knownSpecs[document.key];
  const generic = {
    formats: ["PDF"],
    maxSizeMb: 5,
    description: `Supporting document: ${document.name}.`,
    mustInclude: [
      "Clear, complete and legible content",
      "All pages included and in order",
      "Relevant to the selected approval",
    ],
    quality: [
      "Upload a single legible PDF.",
      "Do not use password-protected files.",
    ],
  };
  const formats = document.formats?.length
    ? document.formats
    : (known?.formats ?? generic.formats);
  const filesRequired = document.filesRequired
    ? `${document.filesRequired} complete ${document.filesRequired === 1 ? "file" : "files"}`
    : (known?.filesRequired ?? "1 complete file");
  return {
    key: document.key,
    name: document.name,
    formats,
    maxSizeMb: document.maxSizeMb ?? known?.maxSizeMb ?? generic.maxSizeMb,
    filesRequired,
    description:
      document.description ?? known?.description ?? generic.description,
    mustInclude: document.mustInclude?.length
      ? document.mustInclude
      : (known?.mustInclude ?? generic.mustInclude),
    quality: document.quality?.length
      ? document.quality
      : (known?.quality ?? generic.quality),
    required: document.required ?? true,
  };
}

function acceptedExtensions(formats: string[]): string[] {
  return formats.flatMap((format) => {
    const f = format.toLowerCase();
    return f === "jpg" || f === "jpeg" ? ["jpg", "jpeg"] : [f];
  });
}

function validateFile(file: File, spec: DocSpec): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!acceptedExtensions(spec.formats).includes(ext)) {
    return `File must be ${spec.formats.join(", ")}.`;
  }
  if (file.size > spec.maxSizeMb * 1_000_000) {
    return `File must be ${spec.maxSizeMb} MB or smaller.`;
  }
  return null;
}

export function DocumentCollection({
  projectId,
  approvalKey,
  approvalTitle,
  documents,
  uploaded,
  onBack,
  onUploadedChange,
}: {
  projectId: string;
  approvalKey: string;
  approvalTitle: string;
  documents: ApprovalDocument[];
  uploaded: ProjectDocument[];
  onBack: () => void;
  onUploadedChange?: (documents: ProjectDocument[]) => void;
}) {
  const { t, text } = useLanguage();
  const specs = useMemo(() => documents.map(specFor), [documents]);
  const total = specs.length;

  const initialByKey = useMemo(() => {
    const map: Record<string, ProjectDocument> = {};
    for (const doc of uploaded) {
      const existing = map[doc.documentKey];
      if (!existing || doc.version > existing.version)
        map[doc.documentKey] = doc;
    }
    return map;
  }, [uploaded]);

  const [uploadedByKey, setUploadedByKey] =
    useState<Record<string, ProjectDocument>>(initialByKey);
  const [current, setCurrent] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expiresOnByKey, setExpiresOnByKey] = useState<Record<string, string>>(
    {},
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadedCount = Object.keys(uploadedByKey).length;
  const remaining = total - uploadedCount;
  const progress = total ? Math.round((uploadedCount / total) * 100) : 0;

  if (total === 0) {
    return (
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("documents.backApprovals")}
        </button>
        <div className="rounded-2xl bg-white p-8 ring-1 ring-[#e4e0d6]">
          <h2 className="font-heading text-2xl font-semibold text-[#142b45]">
            {text(approvalTitle)}
          </h2>
          <p className="mt-3 text-base text-slate-600">
            {text("No documents are required for this approval right now.")}
          </p>
        </div>
      </div>
    );
  }

  const spec = specs[current]!;
  const isLast = current === total - 1;

  const errorFor = (key: string, message: string) =>
    setErrors((prev) => ({ ...prev, [key]: message }));
  const clearError = (key: string) =>
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  async function acceptFile(file: File | undefined) {
    if (!file) return;
    const key = spec.key;
    const localError = validateFile(file, spec);
    if (localError) {
      errorFor(key, localError);
      return;
    }
    clearError(key);
    setBusyKey(key);
    try {
      const document = await uploadProjectDocument(
        projectId,
        approvalKey,
        key,
        file,
        expiresOnByKey[key] || undefined,
      );
      setUploadedByKey((previous) => ({ ...previous, [key]: document }));
      onUploadedChange?.([
        ...Object.values(uploadedByKey).filter((uploaded) => uploaded.documentKey !== key),
        document,
      ]);
    } catch (cause) {
      errorFor(
        key,
        cause instanceof ProjectApiError
          ? cause.message
          : text("Could not upload the file. Please try again."),
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function removeFile() {
    const key = spec.key;
    const document = uploadedByKey[key];
    if (!document) return;
    setBusyKey(key);
    try {
      await deleteProjectDocument(projectId, document.id);
      setUploadedByKey((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      onUploadedChange?.(
        Object.values(uploadedByKey).filter((uploaded) => uploaded.documentKey !== key),
      );
    } catch (cause) {
      errorFor(
        key,
        cause instanceof ProjectApiError
          ? cause.message
          : text("Could not remove the file."),
      );
    } finally {
      setBusyKey(null);
    }
  }

  const currentError = errors[spec.key];
  const currentUploaded = uploadedByKey[spec.key];
  const busy = busyKey === spec.key;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("documents.backApprovals")}
      </button>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Left rail */}
        <aside className="h-fit rounded-2xl bg-white p-6 ring-1 ring-[#e4e0d6]">
          <h2 className="font-heading text-xl font-semibold text-[#142b45]">
            {t("documents.requiredDocuments")}
          </h2>
          <p className="mt-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
            {text(approvalTitle)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {text("{{uploaded}} of {{total}} files uploaded", { uploaded: uploadedCount, total })}
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>

          <ol className="mt-5 space-y-1">
            {specs.map((docSpec, index) => {
              const isCurrent = index === current;
              const done = uploadedByKey[docSpec.key] !== undefined;
              return (
                <li key={docSpec.name}>
                  <button
                    type="button"
                    onClick={() => setCurrent(index)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      isCurrent
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold ${
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : isCurrent
                            ? "border-primary text-primary"
                            : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {done ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#142b45]">
                        {text(docSpec.name)}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {text("{{formats}} · Up to {{size}} MB", { formats: docSpec.formats.join(", "), size: docSpec.maxSizeMb })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 border-t border-[#e4e0d6] pt-4">
            <p className="text-sm font-semibold text-[#142b45]">
              {text("Prepare before submitting")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {text("All {{total}} documents are required for this demonstration bundle. Selecting a file does not submit an application.", { total })}
            </p>
          </div>
        </aside>

        {/* Right panel */}
        <div className="rounded-2xl bg-white p-6 ring-1 ring-[#e4e0d6] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">
                {text("Document {{current}} of {{total}}", { current: current + 1, total })}
              </p>
              <h3 className="mt-1 font-heading text-3xl font-bold text-[#142b45]">
                {text(spec.name)}
              </h3>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                spec.required
                  ? "bg-primary/10 text-primary"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <span
                className={`size-2 rounded-full ${spec.required ? "bg-primary" : "bg-slate-500"}`}
                aria-hidden="true"
              />
              {spec.required ? t("documents.required") : t("documents.optional")}
            </span>
          </div>
          <p className="mt-3 text-base text-slate-600">
            {spec.description === `Supporting document: ${spec.name}.`
              ? text("Supporting document: {{document}}.", { document: text(spec.name) })
              : text(spec.description)}
          </p>

          <hr className="my-6 border-[#e4e0d6]" />

          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-500">{t("documents.acceptedFormats")}</dt>
              <dd className="mt-1 font-semibold text-[#142b45]">
                {spec.formats.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">{t("documents.maximumSize")}</dt>
              <dd className="mt-1 font-semibold text-[#142b45]">
                {spec.maxSizeMb} {t("documents.perFile")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">{t("documents.filesRequired")}</dt>
              <dd className="mt-1 font-semibold text-[#142b45]">
                {text(spec.filesRequired)}
              </dd>
            </div>
          </dl>

          <hr className="my-6 border-[#e4e0d6]" />

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <h4 className="font-heading text-lg font-semibold text-[#142b45]">
                {t("documents.mustInclude")}
              </h4>
              <ul className="mt-3 space-y-2.5 text-slate-600">
                {spec.mustInclude.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-400"
                      aria-hidden="true"
                    />
                    {text(item)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-heading text-lg font-semibold text-[#142b45]">
                {t("documents.quality")}
              </h4>
              {spec.quality.map((para) => (
                <p key={para} className="mt-3 leading-relaxed text-slate-600">
                  {text(para)}
                </p>
              ))}
            </div>
          </div>

          <hr className="my-6 border-[#e4e0d6]" />

          <h4 className="font-heading text-lg font-semibold text-[#142b45]">
            {t("documents.selectDocument")}
          </h4>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-[#142b45]">
              {t("documents.expiryLabel")}
            </span>
            <input
              type="date"
              value={expiresOnByKey[spec.key] ?? ""}
              onChange={(event) =>
                setExpiresOnByKey((previous) => ({
                  ...previous,
                  [spec.key]: event.target.value,
                }))
              }
              className="mt-1 block h-11 w-full max-w-xs rounded-md border border-[#aeb7c4] px-3 text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </label>

          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={acceptedExtensions(spec.formats)
              .map((ext) => `.${ext}`)
              .join(",")}
            onChange={(e) => {
              void acceptFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {busy ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
              <Loader2
                className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-[#142b45]">
                {t("documents.uploading")}
              </span>
            </div>
          ) : currentUploaded ? (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4">
              <span className="flex min-w-0 items-center gap-3">
                <Check
                  className="size-5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[#142b45]">
                    {currentUploaded.fileName}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {t("documents.uploadedVersion", { version: currentUploaded.version })}
                  </span>
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t("documents.replace")}
                </button>
                <button
                  type="button"
                  onClick={removeFile}
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-slate-600 hover:text-destructive focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <X className="size-4" aria-hidden="true" />
                  {t("documents.remove")}
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void acceptFile(e.dataTransfer.files?.[0]);
              }}
              className={`mt-4 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : currentError
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-primary/40 bg-primary/5"
              }`}
            >
              <Upload className="size-7 text-primary" aria-hidden="true" />
              <p className="text-lg font-semibold text-[#142b45]">
                {t("documents.dropHere")}
              </p>
              <p className="text-sm text-slate-500">
                {t("documents.orSelect")}
              </p>
              <Button
                size="lg"
                className="h-11 rounded-full px-6"
                onClick={() => inputRef.current?.click()}
              >
                {t("documents.selectFolder")}
              </Button>
              <p className="text-sm text-slate-500">
                {t("documents.fileLimit", { formats: spec.formats.join(", "), size: spec.maxSizeMb })}
              </p>
            </div>
          )}

          {currentError && (
            <p className="mt-3 text-sm font-medium text-destructive">
              {currentError}
            </p>
          )}

          <p className="mt-6 text-sm leading-relaxed text-slate-500">
            {t("documents.secureUpload")}
          </p>

          <hr className="my-6 border-[#e4e0d6]" />

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {remaining === 1 ? t("documents.remainingOne") : t("documents.remainingMany", { count: remaining })}
            </p>
            {isLast ? (
              <Button
                size="lg"
                className="h-11 rounded-full px-6"
                onClick={onBack}
              >
                {t("documents.backApproval")}
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-11 rounded-full px-6"
                onClick={() => setCurrent((c) => Math.min(c + 1, total - 1))}
              >
                {t("documents.next")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
