# Backend remaining-work checklist

Reviewed against current Maitri3.0 source on 17 September 2026.
Completed tasks and obsolete historical descriptions have been removed.

## Node and FastAPI connection

- Align Node fallback rules with the finalized five approval types and Python decisions.
- Make FastAPI failures visible instead of silently returning a fallback checklist.
- Preserve blockingIssues and response identifiers/version metadata in Node.
- Align evaluation projectId with the persisted project's ID.
- Connect Node to /validate and display correction/recheck messages in the website.
- Add saved-project editing, revalidation and final submission. Enforce ownership,
  current project/document versions, and rejection of stale results.
- Gate submission using blockingIssues and the agreed review policy:
  validationStatus=complete means checking finished, not necessarily passed.
- Confirm response semantics, nullable readinessScore, range boundaries,
  installed-capacity units and decimal MB versus binary MiB upload limits.
- Run Node/frontend checks and live database/service integration tests.
  The latest offline Python run passed 168 tests, not a live end-to-end test.

## Document upload and reader

- Upload/persist actual files; the website currently remembers filenames only.
- Connect private owned-file retrieval to real bounded parsers and extraction/OCR.
  Enforce byte, page, decompression and execution-time limits.
- Determine document type and business/signatory subject before comparing fields.
- Configure fieldsToCompare, cross-document checks and document-specific expiry
  policies with an established basis. Preserve comparison metadata through Node.
- Agree how uncertain extracted values are reviewed/corrected before reuse.
- Define fuller address comparison if needed beyond district/taluka/pincode/plot.
- Connect document replacement, correction/rechecking and current versions.

## Paused and deployment work

- Decide whether readiness/risk scoring is needed; formulas, weights, thresholds
  and policy versions remain unimplemented.
- Configure internal authentication consistently and wire a secure evidence sink.
- Complete dependency setup, deployment, operational limits and security hardening.

## Inspector boundary

Official authenticity, legal applicability and final acceptance belong to the
inspector, not unfinished applicant-side automation. Suggested approvals,
documents and processing estimates must not be presented as legally verified.
Government-rule research gaps remain officer notes, not applicant errors.
