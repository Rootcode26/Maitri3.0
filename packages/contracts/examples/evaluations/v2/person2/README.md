# Person 2 response contract

Contains validationFindings, readiness and risk only. Person 1's recommendations,
ruleSetVersion and dependencyMap and the combined request-identification envelope
are intentionally not implemented or modified.

All fields in these response models are explicit and required. Nullable fields must
be supplied as null. Models reject extra keys and type coercion; JSON is camelCase.
Examples are synthetic contract demonstrations, not calculated assessments.

## Findings
code: stable uppercase machine code, not a display label.
severity: error (blocks), warning (attention), info (notice).
field: camelCase path from the request, or null for non-field issues.
documentId and approvalCode: identifier or null.
message: human-readable explanation.
suggestedAction: correction text, or null when no user action applies.
A finding such as missing document data does not prove tampering or invalidity.

## Readiness states
complete: assessment finished; score 0..100, known scoringPolicyVersion and boolean
readyToSubmit are required. Complete does not mean passed.
insufficient_information: required assessment inputs are unavailable.
requirements_not_configured: approval/document requirements are not configured.
policy_not_configured: readiness scoring policy is not configured; version is null.
Unfinished readiness has score null and sections empty; readyToSubmit is false when
known error findings exist, otherwise null. It can NEVER be true before completion.
Counts must exactly match error and warning findings; info findings do not count.
Complete submission eligibility is true exactly when blockingErrorCount is zero.
Section points cannot exceed their positive maximum; section codes are unique.
No weights, total formula or document acceptance policy is implemented.

## Risk states
complete: score 0..100, low/medium/high level, known policy version, no missing fields.
insufficient_information: known policy, nonempty missingFields; score/level null.
policy_not_configured: version, score and level are null.
Unfinished risk has factors empty; do not publish a misleading partial low-risk result.
Positive completed scores need explanatory factors. Factor codes and missingFields
are unique. Threshold mapping, aggregation and clipping remain policy decisions.
Do not penalize identity characteristics or women working nights automatically.

## Integration and verification
No FastAPI endpoint or scoring/pre-validation service is added.
Person2AssessmentResponse is an internal component contract, not the full endpoint
response. Integration will add Person 1 sections and the application/request IDs.
Parse JSON with model_validate_json; serialize model_dump_json(by_alias=True).

From python-backend:
.venv/Scripts/python.exe -m unittest discover -s tests/unit/validation -v
.venv/Scripts/python.exe -m scripts.export_person2_response_schema

JSON Schema captures field structure, not all cross-field Python validators.
The Pydantic models enforce honest states, counts and version consistency.

## Pending checklist
Done: P2 response models, example state snapshots, schema and contract tests.
Pending: teammate approval of response states; P1 integration contract and combined
response envelope; actual completeness validation; document requirements and
verification checks; readiness/risk scoring policies; evaluation endpoint.
Deferred: OCR, authorised registration verification, deployment/security hardening.
Historical examples and parent discussion notes remain unchanged.
