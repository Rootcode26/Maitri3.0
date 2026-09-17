# Regulatory rules handoff (Person 1)

`engine.evaluate_project(project, rules_version, ...)` is the owner-integration
entry point. It preserves flat request -> normalizer -> nested assessment ->
grouping -> dependencies -> enrichment. It is not the API route.

Integration update: app.main now registers services.rules_adapter.RulesAdapter
through register_rules_evaluator. /evaluate and /validate share that callable.
The earlier Person 1-only ownership notes below describe the original handoff;
registration and blocking-issue mapping are now implemented under the expanded
Python integration boundary. readinessScore remains null. Server context defaults
to unknown and must come from owner-reviewed records, not applicant confirmations.
Person 2 receives the trusted optional preparation catalog and cannot clear
regulatory blockers through upload/extraction success. See VALIDATION.md and
PERSON1_PERSON2_HANDOFF.md for the current status and remaining owner actions.

## Version and evidence

`sets/2026.09/manifest.json` selects six rules and pins every rule to revision 2. The `.yaml` files
use JSON-compatible YAML 1.2 so offline loading works without PyYAML. Existing
block-style YAML still works when PyYAML is installed; otherwise loading it
fails clearly. No dependency was installed. Duplicate properties and rule IDs,
unknown production approval codes and unsupported versions fail explicitly.

Each rule contains trigger, explanation, jurisdiction, decision inputs,
verification, evidence sources, limitations, document metadata and dependencies.
Source dates are publication dates where established, not invented effective dates.
Sources were reviewed 2026-09-17. No runtime network calls are made.

No shipped approval screening rule is VERIFIED. That is intentional: the
finalized flat request does not establish definitive statutory applicability.
Adding confirmed inputs does not promote a screening rule into law.

| Rule | Approval/scope | Status | Requirement and unresolved inputs |
| --- | --- | --- | --- |
| BUS-001 | Internal business profile | PROTOTYPE_ASSUMPTION | Preserve preparation metadata; never a sixth approval or food licence. |
| FOOD-001 | food-licence | NEEDS_REVIEW | FSSAI route needs annual turnover, kind of food business and eligibility confirmation; investment and selected category are not substitutes. |
| FACT-001 | factory-registration | NEEDS_REVIEW | Need manufacturing-with-power, maximum actual workers and current-framework applicability; old worker/electricity/boiler OR heuristic withdrawn. |
| FIRE-008 | fire-noc | NEEDS_REVIEW | Need occupancy, height, stage and applicability confirmation; old area/power thresholds withdrawn. |
| ENV-004 | consent-to-operate | PROTOTYPE_ASSUMPTION | Pollution indicators are screening, not classification. Need category, exemptions and operation stage. Simple garment stitching is not a verified consent trigger. |
| BOILER-001 | boiler-registration | NEEDS_REVIEW | Need current-law applicability, registration stage and existing registration. TPH/pressure alone do not establish coverage. |

## Official research record

* FSSAI: https://fssai.gov.in/upload/advisories/2026/03/69c6a23234827order_27032026.pdf
  March 2026 FAQ establishes changed licensing/registration arrangements.
  Effective April 2026 turnover changes make old eligibility assumptions unsafe.
  No turnover thresholds or licence validity are inferred by this engine.
* DISH: https://mahadish.in/online_services
  Published factory services provide workflow context, not sufficient evidence
  for current labour-code applicability thresholds. Current Maharashtra
  implementation needs legal/department review.
* Fire: https://mahafireservice.gov.in/e-fire.php
  Published provisional/final application stages and architectural drawings.
  Final guidance mentions provisional NOC **if any**. No universal dependency,
  building threshold or 21-day statutory SLA is asserted.
* MPCB: https://www.mpcb.gov.in/en/consentmgt/water-and-air-act
  Distinguishes CTE before establishment and CTO before relevant operation.
  Category/exemption and unit-specific applicability remain unresolved.
* MPCB documents: https://www.mpcb.gov.in/en/consentmgt/water-and-air-act/document
  Published CTO/renewal items: capital investment evidence, manufacturing
  process, industry registration, land ownership, pollution control proposal,
  previous consent copy. These six item descriptions are VERIFIED as published
  checklist entries **for applicable consent applications**, not proof that a
  unit needs consent or that this list covers every sector/current portal.
* Boilers: https://mahaboiler.in/boiler/writereaddata/Portal/Images/pdf/Registration_of_Boilers_Economisers_Guidelines_27102017.pdf
  Historical inspection/testing/registration sequence. It does NOT establish
  current statutory coverage under the newer framework. No 1923 thresholds
  or old processing times are implemented.

## Documents and missing information

Food, factory, fire and boiler preparation documents are NEEDS_REVIEW;
they must not be presented as complete statutory checklists. Water-report
preparation is conditional on confirmed water-as-ingredient input. Unknown
conditions produce an integration issue, not a compulsory upload.
Identity proof belongs to the authorised signatory, not the enterprise; no
automatic identity/company-name cross-match is prescribed.

The schema supports accepted formats, sizes, counts, mustInclude, quality,
comparison fields, conditional applicability, sources and effective dates.
PDF / 5 MB / one electronic file are prototype APPLICATION policies, never
statutory requirements. Required uploads are only emitted for a definitive
verified rule and verified applicable document. Screening documents are optional
preparation suggestions with full evidence kept separately.

An unknown assessment is `insufficient_information`, an unverified positive
screen is `needs_review`. `not_matched` means only this rule did not match;
it NEVER establishes legal exemption. Legacy bool evaluator helpers are retained
for compatibility and must not be used for statutory exemption decisions.

## Dependency semantics

Edges are stage-specific, external prerequisites never become extra approvals.
CTE -> CTO operation, provisional fire -> final fire, inspection -> hydraulic
test, hydraulic test -> boiler registration are recorded as NEEDS_REVIEW
conditional workflow candidates, not universal chains. Unmet review edges
produce `needsReview`, not a verified legal dependency. Verified edges require
evidence and are accepted only after owner/department confirmation.

`immediate` means no supplied current-stage prerequisite remains unmet (or all
are completed), NOT permission to commence legal processing. `parallel` requires
explicit groups and is limited to prototype document preparation. Verified
unmet prerequisites produce `dependent`. Cycles, unknown nodes and conflicting
document metadata fail explicitly. Ordering is lexical and deterministic.

## API owner integration (Suryansh)

No API, domain, validation, risk, readiness or Node file was modified.
The facade returns `approvals`, `integrationIssues`, `evidence`, `assessments`
and `dependencies` internally. Approval objects use the finalized contract
keys. Select singular `ruleId` by definite verified match first, then lexical
rule ID/version. Grouped explanations and all contributor IDs remain available
through assessments/evidence. Legacy grouping is retained and excludes BUS-001.

The API owner must:

1. Call this facade instead of silently using legacy prototype rules or boolean
   matches. Supply validated flat `project` and selected `rulesVersion`.
2. Supply trusted jurisdiction (explicit MH) and evaluation date. Never infer
   state from district/pincode or applicant text. Flat normalization leaves state
   unknown. Confirmed regulatory inputs are an INTERNAL extension, not new
   request fields accepted automatically from Node.
3. Adapt `integrationIssues` into the existing domain/API blocking-issue model.
   They intentionally are NOT the finalized blockingIssues payload. Do not
   return a successful submission with unresolved applicability/checklist review.
4. Add projectId/evaluatedAt/readinessScore through their owned response layer;
   those are not generated here. Preserve the distinction between review and
   validated submission. No risk/readiness scoring is implemented.
5. Keep evidence/review metadata available to reviewers; the external contract
   cannot express all verification and dependency states.
6. Treat processingDays (30/45/21/60/30) as contract-example prototype estimates,
   NOT official SLAs. Verify or revise with contract owners before production.
7. Confirm full current departmental rules/checklists, labour-code transition,
   boiler framework, MPCB categorisation/exemptions and fire authority/stage
   before introducing VERIFIED applicability rules or compulsory uploads.

Nested v2 example snapshots are tested directly by the evaluator. They are not
flat API requests and must not be passed into the flat normalizer.

## Person 1 technical closeout and Person 2 handoff

The prototype engine is ready for Person 2 development/testing, NOT final
regulatory certification or production submission. `submissionBlocked` and
`reviewReasons` are INTERNAL handoff fields, not changes to the external API.
They explicitly keep screening-only cases blocked even when a rule does not
match. The API owner must preserve these blockers in the existing response
model. Upload validation alone cannot make unresolved applicability ready.

Document `fieldsToCompare` values now reach the existing domain contract.
Only explicitly selected company/project fields may be compared. Production
metadata currently selects no such fields: guessing fields from a filename or
comparing a signatory's name against enterpriseName would be incorrect.
Person 2 must report unsupported/uncertain extraction as such, not verified.

Conditional-document issues identify the missing decision field. Effective
document dates need an explicit evaluation date; future requirements are not
requested early. Conflicting grouped document metadata still fails clearly;
otherwise required flags merge using OR and singular ruleId selection remains
stable. Review-only documents produce explicit checklist review issues.

Deferred register (do not forget when Node owner returns):

| Item | Owner / exit condition |
| --- | --- |
| Missing form inputs | Node + Person 1: agree exact fields/options/units before changing shared request contracts. |
| Food eligibility | Person 1: verify current official eligibility and turn-over/activity/capacity inputs; no applicant confirmation checkbox as a substitute. |
| Factory, fire, pollution, boiler applicability | Person 1 + regulatory reviewer: verify current jurisdiction, thresholds, classifications and exemptions. |
| Full mandatory document checklists | Person 1 + departments: verify each approval/stage; suggestions are not a complete list. |
| Workflow prerequisites | Person 1 + departments: verify conditional stages before marking any shipped edge VERIFIED. |
| API registration and blocking issues | Suryansh: wrap evaluate_project as the existing EvaluateRequest -> EvaluateResponse callable, map all review/submission blockers and register it. |
| Processing estimates | Contract owners: verify SLAs or label prototype estimates in the UI. |

Person 2 can proceed now with document adaptation, upload/extracted-field
validation and its own tests using trusted synthetic requirement fixtures.
Do not silently promote optional screening documents into mandatory legal
requirements, relax extraction uncertainty, or bypass Person 1 review blockers.
Risk/readiness scoring, route registration and extraction implementation are
outside this Person 1 closeout and were not changed.
