# Validation implementation

POST /validate is registered in app.main. GET /health is unchanged.
This is an internal Node-to-Python API; send X-Internal-Token.
Set INTERNAL_API_TOKEN in the server process (do not commit the real secret).
Missing authentication configuration returns 503; incorrect/missing token returns 401.

## P1 integration
app.main registers RulesAdapter as the synchronous EvaluateRequest ->
validated EvaluateResponse callable. POST /evaluate and POST /validate share
this registration and the existing internal-token dependency. The adapter
preserves projectId/rulesVersion, uses a timezone-aware UTC evaluatedAt and
returns readinessScore=null (already allowed by the existing Node schema).
It maps integrationIssues, reviewReasons and submissionBlocked into error
blockingIssues; validation preserves them even for selected approvals or
successful document comparisons. Regulatory blockers keep validationStatus
review_required. No scoring policy is implemented.

An owner can replace the registration during server setup:
from app.services.rule_provider import register_rules_evaluator
register_rules_evaluator(app, your_evaluate_function)

The evaluator must reject unsupported versions and derive applicable approvals
from the project. Without it, /validate returns 503 RULES_UNAVAILABLE; it never
uses the illustrative api-contract.md approval list as live regulatory rules.
Unknown evaluator versions/failures and mismatched snapshots fail closed.

## Node request
Use the Node contract examples in packages/contracts/examples/evaluations/node.
Optional selectedApprovalKeys scopes validation to approvals Node has selected;
omitted means the full trusted checklist, including recommended approvals.
At least one selection is required if supplied; unknown selections are errors.
Node must enforce approval selection and ownership for the actual application.
projectVersion is echoed; discard results for a changed application/version.

Node supplies authoritative file metadata/read/extraction statuses. Do not copy
browser claims. The endpoint currently does not download S3 objects or perform OCR.
storageKey is not fetched and cannot trigger arbitrary URL/path access.
detectedMimeType must come from trusted file-content inspection, not the extension.
Unknown actual type/read status/extraction produces review items, not a pass.
Use TLS/private network; this service does not add browser sessions or CORS access.
Request-size and rate limits should also be enforced by the deployment proxy.

## Implemented checks
- Required questionnaire fields, sector questions and conditional boiler capacity.
- Industry/activity mismatch and contradictory boiler/furnace answers.
- Required-document presence and minimum distinct file counts.
- Binding to trusted approvalKey/documentKey requirements.
- Duplicate versions, formats, detected MIME/extension consistency, size and expiry.
- Configured exact credential comparisons, conservative text comparisons.
- Explicit review states for uncertain extraction and narrative content checks.

maxSizeMb uses decimal MB (1 MB = 1,000,000 bytes); confirm with frontend/P1.
Expiry is checked only for explicitly configured server-side expiry_rules with
an official/specification basis. For those types, expiry is valid through
expiresOn; an earlier date is expired and missing confirmed expiry needs review.
An expiry submitted for a type with no established policy needs policy review;
it never creates a universal validity period. No production expiry rules ship.
Required=true applies within each selected approval regardless of required/recommended
approval status. Optional absent documents do not block.
File counts use distinct document IDs, not multiple versions of the same file.

## Structured comparison configuration (P1 extension)
DocumentRequirement now optionally supports fieldsToCompare, e.g. ["pan", "enterpriseName"].
Accepted fields: enterpriseName, pan, gstin, cin, udyam, district, taluka, pincode, plotNumber.
P1 must choose these explicitly; no fields are inferred from mustInclude prose.
This extension is backward-compatible with the original api-contract.md example.
An authorised signatory identity is NOT automatically compared with company identity.
Signatory/other subjects need separate request fields and comparison policy later.
A PAN/GSTIN mismatch reports a correction; malformed extraction or uncertain name/
location differences request review. No comparison proves official authenticity.
Human-readable mustInclude/quality remain review-required until separately automated.

## Response use
200 means the assessment ran, NOT passed. Show blockingIssues, warnings and reviewItems
with message/suggestedAction and use field paths to focus corrections.
Do not erase saved answers; fix affected items and recheck the latest version.
Do not allow automatic final submission while errors or unresolved reviews remain.
No risk/readiness score or official verification status is awarded.

## Before final submission
Call /validate before final submission and after every correction. Display all
findings beside their field/document using message and suggestedAction; preserve
answers and never automatically replace user input with extracted text.
Case/whitespace-only differences do not create errors. Similar but unequal names
get a possible spelling/abbreviation suggestion and remain review-required.
Similarity does not prove identity. Identifier mismatches must be checked against
the original document: an extraction error is not a reason to alter a correct answer.

Node must enforce the final gate on the server, not only disable a frontend button:
- Require a successful authenticated validation response for the current project,
  projectVersion, selected approvals, document versions and rulesVersion.
- Require validationStatus=complete, empty blockingIssues and empty reviewItems.
- Require no mismatched/unavailable/review_required documentChecks.
- Display warnings and ask the applicant to confirm them; warnings are not proof
  of eligibility. Store confirmation for the same unchanged snapshot.
- Reject stale results if any answer, selection or document changes. Revalidate.
- A 401/422/503, timeout or document-processing failure is not a successful check.

This Python service supplies findings only. The Node submission endpoint and
frontend correction screen must implement the gate; they are not changed here.

## Tests from python-backend
.venv/Scripts/python.exe -m pip install -r requirements-validation-dev.txt
.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_validation*.py' -v
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

## Remaining work
Node integration and token setup; owned storage transport; bounded production
PDF/image/XLSX parsers and OCR; signatory comparison inputs; automated narrative
checks/human-review workflow; frontend correction UI.
Risk/readiness scoring and authoritative registration checks remain paused.

## Server-only processing and comparison policies
RulesAdapter accepts a context_provider(projectId, rulesVersion) returning
TrustedRulesContext. Configure this only from owner-reviewed server records,
never by copying browser/Node project answers. Default jurisdiction is unknown;
district, PIN code and GSTIN do not establish Maharashtra context. Confirmed
inputs do not promote shipped screening rules to VERIFIED. An optional audit_sink
receives rules evidence, assessments and dependencies without applicant profile
or extracted credentials; store it in the existing secure owner workflow.

app.state.document_processor(upload) may return DocumentProcessingResult from an
existing trusted worker. /validate calls it on each current document version,
checks bindings and adapts the result. Worker failure never falls back to submitted
extractedData. With no worker configured, the existing internal Node transport
remains supported: actual size/type/read/extraction/expiry metadata MUST originate
from a trusted processor, not browser claims. Missing statuses produce review.

process_document(upload, actual_bytes, inspector=..., extractor=...) provides the
bounded byte-processing boundary. It computes actual size, never accepts extensions
as detected types, and refuses processing over its configured byte limit. Signatures
are candidates only; without a parser, readability stays not_checked. ZIP is not
automatically XLSX. Parser/extractor failures return sanitized failed/review output.
The storage worker must bound retrieval, time, pages and decompression too. No storage
fetch or automatic dependency installation is implemented.

app.state.document_validation_policy can supply DocumentValidationPolicy with
explicit CrossDocumentRule(field, bindings, basis) and expiry_rules. A cross-document
field must ALSO appear in each trusted requirement's fieldsToCompare. Missing or
invalid extracted values produce review; conflicting business values produce
document-specific review findings. No filename-based or signatory/company comparison
is inferred. Shipped preparation documents have no automatic comparison fields.

Run all tests, including legacy function tests, without pytest:
`.venv/Scripts/python.exe -m scripts.run_relevant_tests`
Generate the concrete synthetic flow:
`.venv/Scripts/python.exe -m scripts.example_person1_person2`
