# Evaluation request contract v2

Implemented request structure based on the inspected food, textile and steel wizard.
This is a proposed integration contract requiring review by the Node.js and Person 1
developers. It is not an approved regulatory policy.

The active application is in the top-level python-backend folder. Older
services/python-backend placeholders are preserved, not duplicated or deleted.
Historical examples and discussion notes in the parent directory remain unchanged.

## Envelope and parsing
POST /api/v1/evaluations is the proposed endpoint; no endpoint is implemented here.
Required: requestId, applicationId, applicationVersion (integer >=1), evaluationDate
(ISO date), businessProfile, location, operations, utilities, workforce,
sectorDetails (object or null), documents (array), completedApprovalCodes (array).
JSON uses camelCase. Python uses snake_case internally and explicit aliases.
Unexpected fields, incorrect types, invalid enums and malformed dates are rejected.
Do not send passwords, sessions, file contents, S3 keys, or credentials.
Use model_validate_json for JSON input; strict Python model_validate expects actual
date objects. Serialize with model_dump_json(by_alias=True).

## Draft semantics
Nullable business answers may be omitted or sent as null; both mean unanswered.
Top-level sections must exist, but businessProfile/location/operations/utilities/
workforce may be empty objects in a draft. sectorDetails is null until a sector is
known, then use sector: food, textile, or steel with that sector's nullable answers.
Never default unanswered booleans to false, or missing ranges to none.
An explicit empty processesUsed list means answered with no processes selected;
null means unanswered. Node.js must not turn untouched UI defaults into answers.
Cross-sector details or activities and duplicate document ID/version pairs are
rejected as contradictory payloads. Missing answers, including missing boiler
capacity when a boiler is declared, remain completeness findings for later.

## Section mapping
Business: legalName, organisationType, industrySector, registrationNumber, pan,
gstin, udyamRegistrationNumber. PAN/GSTIN checks are shape-only, not government
verification. Identity fields do not automatically contribute hazard risk.
Location: stateCode, district, taluka, postalCode, industrialArea, plotNumber,
plotAreaBand, builtUpAreaBand, landStatus. The UI has no state selector; Node.js must
supply jurisdiction explicitly, never assume MH inside FastAPI.
Operations: primaryActivity, projectStage, investmentBand, installedCapacity,
operatingShifts, hasBoilerOrPressureVessel, boilerCapacityBand,
boilerWorkingPressureKgCm2, handlesHazardousChemicals, processesUsed.
Utilities: electricityDemandBand, dgSetCapacityBand, dailyWaterUseBand,
waterSource, wastewaterDischarge, generatesHazardousWaste.
Workforce: permanentEmployeeBand, contractWorkerBand,
womenEmployedInNightShift, workerAccommodation.
Food: fssaiLicenceCategory, coldStorageCapacityBand.
Textile: involvesDyeingOrBleaching, loomsOrSpindlesBand.
Steel: furnaceType, furnaceCapacityBand.

## Units and categorical bands
The Pydantic model and generated JSON Schema list every accepted enum.
Frontend values need explicit mapping by the Node.js developer.
Band names preserve displayed categories; overlapping boundaries are NOT resolved.
Do not fabricate numeric values or infer exact employee totals from ranges.
Plot/built-up area: square metres. Investment: lakh INR. Boiler: TPH.
Boiler working pressure: kg/cm². Electricity/DG: kVA. Daily water: KL/day.
Cold storage: MT. Furnace: MT/heat. Looms/spindles: counts.
Installed capacity is free text in the UI: preserve rawText without interpreting it.
Optional structured capacity requires value, unit and period together.
Food/textile units and canonical numerical boundary interpretations require review.
No MSME eligibility inference is made from the UI investment labels alone.

## Documents
documentType is a free code pending the approval/document catalogue.
Metadata requires documentId, documentType, version, fileName, mimeType, sizeBytes,
verificationStatus. expiresOn and extractedData may be null.
No extension allowlist, MIME allowlist, maximum upload size or mandatory document
types are invented. Node.js handles storage and upload-security checks.
Empty documents does not mean validation passed. Missing extraction does not mean
facts matched. Verification status is supplied by Node.js, not awarded here.
Extracted PAN/GSTIN remain raw strings for comparison rather than shape validation.

## Submission completeness policy to implement later
UI-required fields: legalName, organisationType, industrySector, pan; district,
postalCode, plotAreaBand, landStatus; primaryActivity, projectStage,
hasBoilerOrPressureVessel, handlesHazardousChemicals; electricityDemandBand,
dailyWaterUseBand, wastewaterDischarge, generatesHazardousWaste;
permanentEmployeeBand; sector-specific fssaiLicenceCategory / involvesDyeingOrBleaching /
furnaceType. Boiler capacity is conditional on a Yes answer.
stateCode is needed for jurisdiction even though not displayed on the wizard.
Optional/conditional requirements may later vary by approval and rule version.
Gender/night shift answers are compliance inputs, not automatic risk penalties.

## Verification
From python-backend:
- .venv/Scripts/python.exe -m unittest discover -s tests/unit/validation -v
- .venv/Scripts/python.exe -m scripts.export_request_schema

JSON Schema enforces structure; Pydantic additionally enforces cross-sector and
uniqueness checks. Consumers must not assume schema-only validation is sufficient.
Examples are synthetic snapshots, not verified businesses or final policies.

## Remaining work / deferred decisions
- Teammate review of enums, aliases, ranges, units and snapshot semantics.
- Exact range boundaries; installed-capacity parsing and unit policy.
- Document catalogue, upload limits and verification requirements.
- Cross-field business consistency findings (boiler/process, furnace/capacity,
  primary activity versus wet processing) in the completeness layer.
- Revised response including unknown/incomplete/not-configured assessment states.
- Regulatory rules and dependencies (Person 1).
- Completeness/pre-validation service and tests (Person 2).
- Readiness formula; risk factors, weights, thresholds and policy versioning.
- FastAPI evaluation endpoint, internal authentication and integration.
- OCR and authorised registration verification, deployment and hardening.

No risk scoring, completeness assessment or response models are implemented here.
