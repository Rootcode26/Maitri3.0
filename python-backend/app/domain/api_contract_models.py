"""Node-facing contracts aligned to api-contract.md; /validate is an extension proposal."""
from __future__ import annotations
from datetime import date, datetime
from typing import Annotated, Literal
from pydantic import Field, model_validator
from app.domain.request_models import ContractModel, Identifier, NonEmpty

YesNo = Literal["yes", "no"]
NumberText = Annotated[str, Field(pattern=r"^[0-9]+(?:\.[0-9]+)?$")]
Count = Annotated[int, Field(ge=0)]
PositiveCount = Annotated[int, Field(gt=0)]
Base64Content = Annotated[str, Field(min_length=1, max_length=20_000_000)]


class ProjectProfile(ContractModel):
    # Nullable answers permit drafts. Completeness belongs to the validation service.
    enterprise_name: NonEmpty | None = None
    organisation_type: Literal["private-limited", "public-limited", "partnership", "proprietorship", "llp"] | None = None
    industry: Literal["food", "textile", "steel"] | None = None
    cin: Identifier | None = None
    pan: Annotated[str, Field(pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")] | None = None
    gstin: Annotated[str, Field(pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")] | None = None
    udyam: Identifier | None = None
    district: NonEmpty | None = None
    taluka: NonEmpty | None = None
    pincode: Annotated[str, Field(pattern=r"^[1-9][0-9]{5}$")] | None = None
    industrial_area: NonEmpty | None = None
    plot_number: Identifier | None = None
    plot_area: Literal["Up to 500", "500–2,000", "2,000–5,000", "5,000–10,000", "Above 10,000"] | None = None
    built_up_area: Literal["Up to 250", "250–1,000", "1,000–5,000", "Above 5,000"] | None = None
    land_status: Literal["owned", "leased", "allotted-midc", "under-acquisition"] | None = None
    primary_activity: Literal[
        "Food & beverage processing", "Dairy & cold storage", "Bakery & confectionery",
        "Meat & seafood processing", "Spinning", "Weaving", "Knitting", "Dyeing & processing",
        "Garment manufacturing", "Steel & metal fabrication", "Foundry / casting",
        "Rolling mill", "Structural fabrication",
    ] | None = None
    project_stage: Literal["new", "expansion", "modernisation"] | None = None
    investment: Literal["Up to ₹100 lakh (Micro)", "₹100–1,000 lakh (Small)", "₹1,000–5,000 lakh (Medium)", "Above ₹5,000 lakh (Large)"] | None = None
    capacity: NonEmpty | None = None
    shifts: Literal["One shift", "Two shifts", "Three shifts"] | None = None
    boiler: YesNo | None = None
    boiler_capacity: Literal["Up to 1", "1–5", "5–10", "Above 10"] | None = None
    boiler_pressure: NumberText | None = None
    hazardous_chemicals: YesNo | None = None
    processes: list[Literal["Manufacturing / processing", "Packaging and storage", "Boiler operation", "On-site effluent treatment"]] | None = None
    fssai_category: Literal["Central licence", "State licence", "Basic registration"] | None = None
    cold_storage: Literal["None", "Up to 50", "50–500", "500–2,000", "Above 2,000"] | None = None
    wet_processing: YesNo | None = None
    looms_spindles: Literal["Up to 50", "50–200", "200–500", "Above 500"] | None = None
    furnace_type: Literal["Induction furnace", "Electric arc furnace", "Cupola", "None"] | None = None
    furnace_capacity: Literal["Up to 5", "5–20", "20–50", "Above 50"] | None = None
    electricity: Literal["Up to 50", "50–100", "100–500", "500–1,000", "Above 1,000"] | None = None
    dg_set: Literal["None", "Up to 125", "125–500", "500–1,000", "Above 1,000"] | None = None
    water_use: Literal["Up to 10", "10–50", "50–100", "100–500", "Above 500"] | None = None
    water_source: Literal["MIDC supply", "Municipal supply", "Borewell", "Surface water", "Tanker"] | None = None
    wastewater: Literal["Common treatment facility", "On-site treatment plant", "No discharge (zero liquid)", "Municipal sewer"] | None = None
    hazardous_waste: YesNo | None = None
    permanent: Literal["Less than 10", "10–19", "20–49", "50–99", "100–499", "500 or more"] | None = None
    contract: Literal["None", "1–19", "20–49", "50 or more"] | None = None
    women_night: YesNo | None = None
    accommodation: Literal["Not provided", "On-site quarters", "Nearby housing"] | None = None


class EvaluateRequest(ContractModel):
    rules_version: Identifier
    project_id: Identifier
    project: ProjectProfile


class ContractIssue(ContractModel):
    code: Annotated[str, Field(pattern=r"^[A-Z][A-Z0-9_]*$", max_length=100)]
    severity: Literal["error", "warning", "review"]
    field: NonEmpty | None
    approval_key: Identifier | None
    document_key: Identifier | None
    document_id: Identifier | None
    message: NonEmpty
    suggested_action: NonEmpty


class DocumentRequirement(ContractModel):
    key: Identifier
    name: NonEmpty
    description: NonEmpty
    formats: list[Literal["PDF", "JPG", "PNG", "XLSX"]] = Field(min_length=1)
    max_size_mb: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    files_required: PositiveCount
    required: bool
    must_include: list[NonEmpty]
    quality: list[NonEmpty]
    # P1 explicitly selects company/project fields; never infer signatory identity.
    fields_to_compare: list[Literal[
        "enterpriseName", "pan", "gstin", "cin", "udyam",
        "district", "taluka", "pincode", "plotNumber",
    ]] = Field(default_factory=list)


class ApprovalDefinition(ContractModel):
    key: Identifier
    title: NonEmpty
    status: Literal["required", "recommended"]
    reason: NonEmpty
    rule_id: Identifier
    department_key: Identifier
    processing_days: PositiveCount
    documents: list[DocumentRequirement]

    @model_validator(mode="after")
    def document_keys_unique(self):
        keys = [item.key for item in self.documents]
        if len(keys) != len(set(keys)):
            raise ValueError("Document keys must be unique within an approval")
        return self


class TimestampedResponse(ContractModel):
    rules_version: Identifier
    project_id: Identifier
    evaluated_at: datetime

    @model_validator(mode="after")
    def timestamp_has_timezone(self):
        if self.evaluated_at.tzinfo is None or self.evaluated_at.utcoffset() is None:
            raise ValueError("evaluatedAt must include a timezone")
        return self


class EvaluateResponse(TimestampedResponse):
    # Preserves the source example. A numeric placeholder is NOT upload validation.
    readiness_score: Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)] | None
    blocking_issues: list[ContractIssue]
    approvals: list[ApprovalDefinition]

    @model_validator(mode="after")
    def approvals_unique(self):
        keys = [item.key for item in self.approvals]
        if len(keys) != len(set(keys)):
            raise ValueError("Approval keys must be unique")
        if any(issue.severity != "error" for issue in self.blocking_issues):
            raise ValueError("blockingIssues contains only error findings")
        return self


class ExtractedCredentials(ContractModel):
    enterprise_name: NonEmpty | None = None
    pan: Identifier | None = None
    gstin: Identifier | None = None
    cin: Identifier | None = None
    udyam: Identifier | None = None
    district: NonEmpty | None = None
    taluka: NonEmpty | None = None
    pincode: Identifier | None = None
    plot_number: Identifier | None = None


class UploadedDocument(ContractModel):
    document_id: Identifier
    version: PositiveCount
    approval_key: Identifier
    document_key: Identifier
    file_name: Annotated[str, Field(min_length=1, max_length=255, pattern=r"^[^/\\]+$")]
    mime_type: NonEmpty
    detected_mime_type: NonEmpty | None
    size_bytes: PositiveCount
    storage_key: Identifier | None
    file_read_status: Literal["not_checked", "readable", "unreadable", "password_protected"]
    extraction_status: Literal["not_run", "succeeded", "failed", "review_required"]
    extracted_data: ExtractedCredentials | None
    expires_on: date | None
    content: Base64Content | None = None

    @model_validator(mode="after")
    def extraction_state_consistent(self):
        if self.extraction_status != "succeeded" and self.extracted_data is not None:
            raise ValueError("extractedData is supplied only after successful extraction")
        return self


class ValidateRequest(EvaluateRequest):
    # Extension to review with Node.js and P1 before wiring the endpoint.
    project_version: PositiveCount
    documents: list[UploadedDocument] = Field(max_length=100)
    # Omitted means validate the full returned checklist. Node owns selection.
    selected_approval_keys: list[Identifier] | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def upload_bindings_unique(self):
        bindings = [(doc.document_id, doc.version, doc.approval_key, doc.document_key) for doc in self.documents]
        if len(bindings) != len(set(bindings)):
            raise ValueError("Duplicate upload bindings")
        if self.selected_approval_keys is not None and len(set(self.selected_approval_keys)) != len(self.selected_approval_keys):
            raise ValueError("selectedApprovalKeys must be unique")
        return self


class DocumentCheck(ContractModel):
    document_id: Identifier
    approval_key: Identifier
    document_key: Identifier
    field: NonEmpty | None
    status: Literal["matched", "mismatched", "unavailable", "review_required"]
    reason: NonEmpty


AttentionFactorCode = Literal[
    "HAZARDOUS_CHEMICALS",
    "HAZARDOUS_WASTE",
    "BOILER_DECLARED",
    "WET_PROCESSING",
    "FURNACE_DECLARED",
    "BLOCKING_CORRECTIONS",
    "ITEMS_TO_DOUBLE_CHECK",
    "MANUAL_REVIEW_ITEMS",
]
ATTENTION_ASSESSMENT_DISCLAIMER = (
    "This prototype score only estimates the amount of manual review that may be needed. "
    "It does not determine eligibility or predict approval."
)


class AttentionFactor(ContractModel):
    code: AttentionFactorCode
    label: NonEmpty
    points: Annotated[int, Field(ge=0)]
    explanation: NonEmpty


class AttentionAssessment(ContractModel):
    score: Annotated[int, Field(ge=0, le=100)]
    level: Literal["standard", "elevated", "high_attention"]
    policy_version: Literal["prototype-1"]
    factors: list[AttentionFactor]
    disclaimer: Literal[ATTENTION_ASSESSMENT_DISCLAIMER]

    @model_validator(mode="after")
    def assessment_is_consistent(self):
        codes = [factor.code for factor in self.factors]
        if len(codes) != len(set(codes)):
            raise ValueError("Attention factor codes must be unique")
        if self.score != min(100, sum(factor.points for factor in self.factors)):
            raise ValueError("Attention score must equal capped factor points")
        expected_level = (
            "standard" if self.score < 20
            else "elevated" if self.score < 40
            else "high_attention"
        )
        if self.level != expected_level:
            raise ValueError("Attention level must agree with the score")
        return self


class ValidationResult(TimestampedResponse):
    project_version: PositiveCount
    validation_status: Literal["complete", "review_required", "not_evaluated"]
    blocking_issues: list[ContractIssue]
    warnings: list[ContractIssue]
    review_items: list[ContractIssue]
    document_checks: list[DocumentCheck]

    @model_validator(mode="after")
    def issue_groups_consistent(self):
        for items, severity in [(self.blocking_issues, "error"), (self.warnings, "warning"), (self.review_items, "review")]:
            if any(item.severity != severity for item in items):
                raise ValueError("Issue severity must match its response group")
        uncertain = self.review_items or any(
            item.status in {"unavailable", "review_required"} for item in self.document_checks
        )
        if self.validation_status == "complete" and uncertain:
            raise ValueError("Unresolved checks cannot be marked complete")
        if self.validation_status == "not_evaluated" and self.document_checks:
            raise ValueError("Not-evaluated response cannot contain completed checks")
        return self


class ValidateResponse(ValidationResult):
    attention_assessment: AttentionAssessment
