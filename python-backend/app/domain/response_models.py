"""Person 2 response contract; no regulatory rules or scoring algorithms."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, model_validator

from app.domain.request_models import ContractModel, Identifier, NonEmpty

Code = Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[A-Z][A-Z0-9_]*$")]
Score = Annotated[int, Field(ge=0, le=100)]
Count = Annotated[int, Field(ge=0)]


class ValidationFinding(ContractModel):
    code: Code
    severity: Literal["error", "warning", "info"]
    field: NonEmpty | None
    document_id: Identifier | None
    approval_code: Identifier | None
    message: NonEmpty
    suggested_action: NonEmpty | None


class ReadinessSection(ContractModel):
    code: Code
    earned_points: Annotated[int, Field(ge=0)]
    maximum_points: Annotated[int, Field(gt=0)]

    @model_validator(mode="after")
    def points_within_section(self) -> ReadinessSection:
        if self.earned_points > self.maximum_points:
            raise ValueError("earnedPoints cannot exceed maximumPoints")
        return self


class ReadinessResult(ContractModel):
    assessment_status: Literal[
        "complete", "insufficient_information",
        "requirements_not_configured", "policy_not_configured",
    ]
    scoring_policy_version: Identifier | None
    score: Score | None
    ready_to_submit: bool | None
    blocking_error_count: Count
    warning_count: Count
    sections: list[ReadinessSection]

    @model_validator(mode="after")
    def assessment_state_is_honest(self) -> ReadinessResult:
        if self.assessment_status == "complete":
            if self.score is None or self.scoring_policy_version is None:
                raise ValueError("Complete readiness requires score and scoringPolicyVersion")
            if self.ready_to_submit is None:
                raise ValueError("Complete readiness requires a boolean readyToSubmit")
            if self.ready_to_submit != (self.blocking_error_count == 0):
                raise ValueError("Submission eligibility must match blocking errors")
        else:
            if self.score is not None or self.sections:
                raise ValueError("Unfinished readiness cannot publish a final score or breakdown")
            expected = False if self.blocking_error_count else None
            if self.ready_to_submit is not expected:
                raise ValueError("Unfinished readiness is false with blocking errors; otherwise null")
        if self.assessment_status == "policy_not_configured" and self.scoring_policy_version is not None:
            raise ValueError("An unconfigured scoring policy has no version")
        codes = [section.code for section in self.sections]
        if len(codes) != len(set(codes)):
            raise ValueError("Readiness section codes must be unique")
        return self


class RiskFactor(ContractModel):
    code: Code
    points: Annotated[int, Field(ge=0)]
    explanation: NonEmpty


class RiskResult(ContractModel):
    assessment_status: Literal["complete", "insufficient_information", "policy_not_configured"]
    scoring_policy_version: Identifier | None
    score: Score | None
    level: Literal["low", "medium", "high"] | None
    missing_fields: list[NonEmpty]
    factors: list[RiskFactor]

    @model_validator(mode="after")
    def assessment_state_is_honest(self) -> RiskResult:
        if self.assessment_status == "complete":
            if self.score is None or self.level is None or self.scoring_policy_version is None:
                raise ValueError("Complete risk requires score, level and scoringPolicyVersion")
            if self.missing_fields:
                raise ValueError("Complete risk cannot have missing risk-critical fields")
            if self.score > 0 and not self.factors:
                raise ValueError("A positive risk score needs explanatory factors")
        else:
            if self.score is not None or self.level is not None or self.factors:
                raise ValueError("Unfinished risk cannot publish a final score, level or factors")
            if self.assessment_status == "insufficient_information":
                if not self.missing_fields or self.scoring_policy_version is None:
                    raise ValueError("Insufficient information requires missingFields and a known policy")
            elif self.scoring_policy_version is not None:
                raise ValueError("An unconfigured policy has no version")
        codes = [factor.code for factor in self.factors]
        if len(codes) != len(set(codes)):
            raise ValueError("Risk factor codes must be unique")
        if len(self.missing_fields) != len(set(self.missing_fields)):
            raise ValueError("missingFields must be unique")
        return self


class Person2AssessmentResponse(ContractModel):
    """Only P2 sections; the combined evaluation envelope belongs to integration."""
    validation_findings: list[ValidationFinding]
    readiness: ReadinessResult
    risk: RiskResult

    @model_validator(mode="after")
    def finding_counts_match(self) -> Person2AssessmentResponse:
        errors = sum(finding.severity == "error" for finding in self.validation_findings)
        warnings = sum(finding.severity == "warning" for finding in self.validation_findings)
        if self.readiness.blocking_error_count != errors:
            raise ValueError("blockingErrorCount must match error findings")
        if self.readiness.warning_count != warnings:
            raise ValueError("warningCount must match warning findings")
        return self
