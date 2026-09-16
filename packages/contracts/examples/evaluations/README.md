# UdyogSetu evaluation contract discussion

This is contract preparation only. `evaluation-request.v2.draft.json` is an
incomplete design draft, not a validated executable contract. Its empty sections
are intentionally unspecified. The full request and response contracts are not
finalized; these notes do not implement endpoints, validation, regulatory rules,
readiness calculations, or risk scoring.

Earlier `evaluation-request.example.json` and `evaluation-response.example.json`,
where present, remain unchanged historical examples, not the final revised
contract. The earlier response example contains illustrative scores, not approved
scoring policy.

## Architecture and ownership

Both Python developers contribute to one internal FastAPI service called by
Node.js, not directly by browsers. Node.js/Express owns authentication,
application persistence, PostgreSQL, S3, notifications, timelines, certificates,
and audit persistence.

Person 1 owns regulatory approval rules, recommendations, required-document
definitions, explanations, rule versions, and approval dependencies. Person 2
owns FastAPI endpoints, Pydantic contracts, application pre-validation, readiness
calculations, risk scoring, and integration tests. Those implementation tasks are
outside this preparation step.

## Proposed request conventions

- Proposed endpoint: `POST /api/v1/evaluations`.
- JSON field names use camelCase.
- `requestId` and `applicationId` are non-empty strings.
- `applicationVersion` is an integer greater than or equal to 1.
- `evaluationDate` is an ISO `YYYY-MM-DD` date.
- Business fields can be `null` for incomplete applications.
- `organisationType` values: `private_limited`, `public_limited`, `partnership`,
  `proprietorship`, `llp`.
- `industrySector` values: `food`, `textile`, `steel`.
- `legalName` corresponds to the UI's Enterprise name.
- PAN, GSTIN, and registration numbers are strings when provided.
- Identity fields do not automatically add hazard-risk points.
- Format checks do not prove government registration validity.
- Operations must distinguish `true`, `false`, and `null`/unanswered.
- UI-selected ranges must remain ranges; never fabricate exact values.

## Assessment and response semantics

- Document requirements have not been decided.
- An empty document list does not mean document checks passed.
- No extracted document data means comparison was not performed, not that
  details matched.
- A completed evaluation with correctable findings returns HTTP 200.
- Invalid request structure or types return HTTP 422.
- An unsuccessful evaluation must not look like an empty successful result.
- Missing risk-critical answers must not silently produce low risk.

The revised response must represent incomplete assessments explicitly; its
fields and states are still pending. No scoring formula or policy is approved
by these examples.

## Pending decisions

- Location fields and range codes.
- Shared operation fields and industry-specific fields.
- Utilities and workforce models.
- Required, optional, and conditionally required questionnaire fields.
- Installed-capacity units and time periods.
- Required documents and upload restrictions.
- Treatment of uploaded versus verified documents.
- Revised response contract, including incomplete-assessment states.
- Readiness formula and scoring weights.
- Risk factors, weights, thresholds, and policy versioning.
- Person 1's recommendation and dependency interfaces.
