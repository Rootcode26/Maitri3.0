# Person 1 / Person 2 review handoff

## Updated prototype response behaviour

Unconfirmed government rules and incomplete departmental checklists are officer
review notes, not applicant errors. /evaluate returns recommendations with their
existing reasons and no research-only blockingIssues. /validate provides one
APPROVAL_OFFICER_REVIEW note per selected recommended approval in reviewItems.
Detailed internal research gaps and evidence remain available to the audit sink.
Older evaluator REGULATORY_REVIEW_REQUIRED / REGULATORY_DECISION_UNRESOLVED
findings are moved to reviewItems. They do not ask applicants to fix internal
regulatory context fields absent from the form.

Missing required answers/files, unreadable or oversized files, identifier
conflicts and document mismatches remain blockingIssues. Uncertain document
reading remains a document review item. Confirmed unmet workflow prerequisites
remain errors (VERIFIED_PREREQUISITE_MISSING). submissionBlocked at the rules
layer now represents confirmed unmet prerequisites rather than research gaps.

validationStatus=review_required means an officer or document reader still needs
to check something; it does not mean the applicant necessarily made a mistake.
For the original demo form with an unread document reference, expect no research
errors and a short officer note plus the two file/readability review items.
No API keys, request fields, rules or document requirements were changed by this
response adjustment. Earlier counts and descriptions below are historical.

Technical prototype integration is complete. It is not legally verified or
production-ready. Branch: feat/rules-engine-v2. No commit/push or dependency install.

Person 1 retains flat normalization, six pinned revision-2 rules (five approvals
plus internal BUS-001), deterministic grouping, conditional preparation documents,
evidence and stage-specific dependencies. The only normalizer change rejects
boolean/fractional/out-of-range shifts. No shipped approval rule was promoted to
VERIFIED. Immediate dependencies permit preparation only.

RulesAdapter is registered in app.main using register_rules_evaluator. The one
/evaluate route and existing /validate route use the same validated evaluator.
projectId/rulesVersion are preserved; evaluatedAt is timezone-aware UTC;
readinessScore=null uses the existing model/schema. Regulatory integration issues,
review reasons and submission blockers become error blockingIssues and survive
document validation and selected-approval filtering. Context is server-owned;
the default does not guess Maharashtra from district/PIN/GSTIN.

Person 2 checks required files/counts, actual trusted size/type/readability,
configured form comparisons, explicit cross-document consistency and established
expiry policies. Missing, uncertain or conflicting extraction requires review.
Personal signatory data is never adapted to enterprise credentials. Narrative
checklists remain review-required. Corrections are assessed afresh for the current
project/document versions. Syntax/matches/OCR do not establish authenticity.

process_document computes byte length and uses explicit inspection/extraction
providers. Signature-only detection never proves readability. Missing providers,
corrupt/encrypted/unsupported files and provider failures fail safely. An optional
existing-worker callable is wired through the processing-result adapter; no
upload/storage infrastructure or runtime regulatory network calls were added.

## Exact files changed in this task

Modified existing working-tree files (teammate content retained):

- app/main.py
- app/rules/normalizer.py
- app/rules/README.md
- app/api/routes/validation.py
- app/services/rule_provider.py
- app/services/validation.py
- tests/test_validation_service.py
- tests/unit/rules/test_normalizer.py
- VALIDATION.md
- DOCUMENT_PROCESSING.md

Added:

- app/api/routes/evaluation.py
- app/services/rules_adapter.py
- app/services/document_policy.py
- app/services/document_processing.py
- tests/test_document_processing.py
- tests/test_rules_integration.py
- scripts/run_relevant_tests.py
- scripts/example_person1_person2.py
- PERSON1_PERSON2_HANDOFF.md

All paths above are relative to python-backend. Hash comparison verified 258
other pre-existing files unchanged, including teammate contracts, rule sets,
fixtures, evaluator/loader/schemas, recommendation/dependency code and all
Node/frontend files. No authentication/database/deployment/risk/readiness code
was changed; the new route reuses the existing internal-token dependency.

## Concrete synthetic food-factory flow

Run `.venv/Scripts/python.exe -m scripts.example_person1_person2` for the full
request, rules response, processing result, validation request and response.

The flat request has rulesVersion=2026.09, projectId=synthetic-food-factory,
enterpriseName=Synthetic Foods Ltd., industry=food,
primaryActivity=Food & beverage processing, boiler=yes, boilerCapacity=1–5,
hazardousChemicals=yes, and the source example's other bands. No trusted state or
statutory eligibility inputs are supplied. PAN is a synthetic fixture value.

The rules response returns boiler-registration, consent-to-operate,
factory-registration, fire-noc and food-licence, all recommended, with optional
preparation documents, readinessScore=null and 35 blocking issues. Examples of
missing inputs are location.stateCode, regulatory.annualTurnover and
regulatory.waterUsedAsIngredient. BUS-001 never becomes an approval.

A 51-byte deliberately incomplete PDF fixture is attached to food-licence /
identity-proof. No parser is configured: signature is only a candidate type,
readability remains not_checked and extraction review_required. Validation
returns the same 35 regulatory blockers, validationStatus=review_required,
DOCUMENT_READ_CHECK_PENDING and an unavailable document check. Optional missing
preparation documents are not turned into required uploads or complete submission.
Separate end-to-end tests explicitly prove successful synthetic extraction and
matched fields also cannot clear regulatory blockers.

## Validation results

- pytest unavailable; nothing installed.
- Top-level unittest discovery: 65 passed.
- Rules unittest discovery: 69 passed.
- Contract unittest discovery: 21 passed.
- Combined offline runner: 165 passed, including 10 existing function tests.
- py_compile: all 15 changed/added Python files passed.
- git diff --check: passed; tracked/untracked changes inspected.
- Starlette/httpx emitted a deprecation warning; HTTP tests passed.

## Remaining setup and owner actions

Server owner: configure INTERNAL_API_TOKEN, reviewed context resolver and secure
evidence sink; connect existing owned-file worker or trusted Node processing
snapshots. This environment lacks pypdf, Pillow, openpyxl and production OCR.
Provide bounded content parsers/extractors, including limits on file retrieval,
pages, decompression and execution time. No production OCR values are fabricated.
Configure document comparison/validity rules only with an established basis;
shipped preparation documents have no automatic comparison fields or expiry rules.

Node owner: agree missing field names/options/units and enforce ownership, trusted
processor metadata and final submission gating for the unchanged projectVersion,
rulesVersion, selected approvals and current document versions. Reject stale
results and revalidate after corrections. Shared contracts were not changed;
existing proposed nullable-score/validation conventions still need owner agreement.

Person 1/regulatory reviewer: resolve jurisdiction and exact eligibility inputs:

- Food: annualTurnover, foodKindOfBusiness, foodEligibilityConfirmed,
  waterUsedAsIngredient for the conditional preparation report.
- Factory: manufacturingWithPower, maximumWorkers, factoryApplicabilityConfirmed.
- Fire: fireOccupancy, buildingHeight, fireApprovalStage, fireApplicabilityConfirmed.
- Consent: consentCategory, consentExemptionConfirmed, operationStage.
- Boiler: boilerApplicabilityConfirmed, boilerRegistrationStage,
  boilerExistingRegistration; current-law coverage still needs authoritative review.

These are internal regulatory input names, not new browser fields. Confirmation
flags alone cannot establish law or promote the screening rules. Verify current
frameworks, classifications/exemptions, complete departmental checklists,
stage-specific prerequisites and processing estimates before production.

Official sources checked in this task:

- [FSSAI March 2026 FAQ](https://fssai.gov.in/upload/advisories/2026/03/69c6a23234827order_27032026.pdf): changed turnover/validity arrangements reinforce using turnover and avoiding assumed renewal periods.
- [DISH services](https://mahadish.in/online_services): published services do not settle current framework applicability.
- [Fire guidance](https://mahafireservice.gov.in/e-fire.php): provisional/final stages and conditional prerequisites.
- [MPCB consent](https://www.mpcb.gov.in/en/consentmgt/water-and-air-act) and [documents](https://www.mpcb.gov.in/en/consentmgt/water-and-air-act/document): consent stages and published applicable-application checklist.
- [Historical boiler guidance](https://mahaboiler.in/boiler/writereaddata/Portal/Images/pdf/Registration_of_Boilers_Economisers_Guidelines_27102017.pdf): workflow context, not definitive current statutory coverage.
- [PAN format specification](https://www.incometax.gov.in/iec/foportal/sites/default/files/2020-07/Instructions_ITR_4_AY_2018-19.pdf): format only; no authoritative identity/ownership/authenticity verification mechanism is connected.
