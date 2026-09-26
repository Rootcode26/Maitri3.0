# Current Node-facing contracts

api-contract.md at the repository root is the source for POST /evaluate.
The flat project object and display strings are intentionally preserved.
Earlier v2 grouped-request and Person 2 response examples are LEGACY design drafts;
do not send those shapes to Node.js. They remain unchanged for history.
api_contract_models.py is the current boundary model; no HTTP endpoint is added.

EvaluateRequest and EvaluateResponse validate the source Markdown examples.
Enums extend the food example using observed textile/steel wizard choices.
Enums not exemplified in api-contract.md need confirmation with Node.js/P1.
The source's legislative assertions and document requirements are project-provided
configuration, not independently verified legal guidance.

## Proposed POST /validate extension
Run only after Node.js has saved questionnaire answers and uploaded documents.
Required: rulesVersion, projectId, projectVersion, project, documents.
projectVersion is new: Node.js must reject results for stale application snapshots.
documents binds each upload to approvalKey + documentKey from P1.
Node.js supplies metadata/extraction state from trusted backend storage, not browser
claims. Declared mimeType is not proof of file format; detectedMimeType may be null.
storageKey is an opaque private object reference (no arbitrary URL/path fetching).
Node.js must validate ownership; transport for file reading is still pending.
No files, base64, public links, passwords or credentials are accepted here.

Python must derive the requirements from the selected trusted P1 rulesVersion
internally; /validate does not accept user-provided requirements.
Unsupported/missing rule versions must fail, never look like an empty checklist.
Extraction may be not_run, succeeded, failed or review_required.
extractedData is present only for succeeded extraction; missing fields remain null.
The illustrative PAN mismatch is not proof of fraud. Unavailable/uncertain extraction
or unstructured requirements such as drawing content need explicit human review.

## Proposed validation response
rulesVersion, projectId, projectVersion, evaluatedAt (timezone required),
validationStatus, blockingIssues, warnings, reviewItems, documentChecks.
Each issue has stable code, severity, field (project.pan etc.), approvalKey,
documentKey, documentId, message and suggestedAction.
Issue groups use error, warning and review respectively.
validationStatus: complete, review_required, not_evaluated.
Complete means assessment performed, NOT passed; blockingIssues can still exist.
Unresolved review items/checks cannot be marked complete.
No readiness or risk score is calculated by this extension.
No-check/not-evaluated result must not be interpreted as passed.
Node.js/inspectors retain responsibility for final submission and official acceptance.

DocumentCheck reports matched, mismatched, unavailable or review_required plus reason.
The examples are synthetic format demonstrations, not actual computed evaluations.

## Source fields requiring agreement
/evaluate readinessScore may be null in the model (proposed extension).
The source 0.0 placeholder remains valid but NEVER implies document checks ran.
blockingIssues has a proposed object structure because the source defines only [].
maxSizeMb means megabytes, but decimal MB versus binary MiB needs agreement before
implementation. filesRequired means minimum count; optional-document semantics,
draft/final validation modes and recommended-approval document enforcement need review.
mustInclude/quality are human-readable instructions, not executable validation rules.
P1 must add structured fieldsToCompare/check definitions for reliable automation.
Identity-proof full name refers to authorised signatory, NOT automatically enterpriseName.
Location matching lacks a full questionnaire address; compare only available fields.
Response envelope and new /validate route need teammate review.

## Commands from python-backend
.venv/Scripts/python.exe -m unittest discover -s tests/unit/validation -v
.venv/Scripts/python.exe -m scripts.export_node_contract_schemas

## Pending checklist

See python-backend/PERSON1_PERSON2_HANDOFF.md for the maintained checklist.

- Team agreement on response semantics, units and final submission policy.
- Align fallback approvals, expose service failures and preserve response metadata.
- Align evaluation and persisted project IDs.
- Connect /validate and frontend correction/rechecking.
- Real file upload/access and bounded parsers/extraction/OCR.
- Configure/preserve comparison fields, cross-document and expiry policies.
- Enforce current snapshots, reject stale results and gate final submission.
- Live integration tests, deployment and hardening.
- Risk/readiness scoring remain paused.

Boundary models, schema/contract tests, required-file checking and matching/review
logic, /evaluate, /validate and shared rules integration are implemented.
Official authenticity verification remains the inspector's responsibility.
