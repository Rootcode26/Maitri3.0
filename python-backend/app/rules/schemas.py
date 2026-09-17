"""Small deterministic rule DSL; regulatory evidence is separate from policy."""
from datetime import date as Date
from math import isfinite
from typing import Annotated, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StrictInt, field_validator, model_validator

Verification = Literal['VERIFIED', 'PROTOTYPE_ASSUMPTION', 'NEEDS_REVIEW']
Text = Annotated[str, Field(min_length=1, max_length=2000)]
Code = Annotated[str, Field(min_length=1, max_length=100)]
FieldPath = Annotated[str, Field(pattern=r'^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$')]
APPROVAL_CODES = frozenset({'food-licence', 'factory-registration', 'fire-noc', 'consent-to-operate', 'boiler-registration'})


class RuleModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class EvidenceSource(RuleModel):
    organization: Text
    title: Text
    url: HttpUrl
    date: Date | None = None
    notes: Text | None = None


def validate_scalar(value: Any) -> Any:
    if type(value) not in (str, int, float, bool) or (isinstance(value, float) and not isfinite(value)):
        raise ValueError('Operators require non-null finite scalar values')
    return value


class RuleCondition(RuleModel):
    field: FieldPath
    applicableIndustries: list[Literal['food', 'textile', 'steel']] | None = Field(default=None, min_length=1)
    equals: Any | None = None
    greaterThan: Any | None = None
    in_: list[Any] | None = Field(default=None, alias='in', min_length=1)

    @model_validator(mode='after')
    def one_operator(self) -> 'RuleCondition':
        operators = self.model_fields_set & {'equals', 'greaterThan', 'in_'}
        if len(operators) != 1:
            raise ValueError('Each condition requires exactly one operator')
        if 'equals' in operators:
            validate_scalar(self.equals)
        elif 'greaterThan' in operators:
            validate_scalar(self.greaterThan)
            if type(self.greaterThan) not in (int, float):
                raise ValueError('greaterThan requires a finite numeric threshold, not boolean')
        else:
            if self.in_ is None:
                raise ValueError('in requires a non-empty list')
            for value in self.in_:
                validate_scalar(value)
        return self


class RuleConditions(RuleModel):
    all: list[RuleCondition] | None = Field(default=None, min_length=1)
    any: list[RuleCondition] | None = Field(default=None, min_length=1)

    @model_validator(mode='after')
    def one_group(self) -> 'RuleConditions':
        groups = self.model_fields_set & {'all', 'any'}
        if len(groups) != 1 or (self.all is None and self.any is None):
            raise ValueError('Exactly one non-empty all/any condition group is required')
        return self


class DependencySpec(RuleModel):
    prerequisite: Code
    stage: Code
    external: bool = False
    verification: Verification = 'NEEDS_REVIEW'
    reason: Text
    sources: list[EvidenceSource] = Field(default_factory=list)

    @model_validator(mode='after')
    def has_evidence(self) -> 'DependencySpec':
        if self.verification == 'VERIFIED' and not self.sources:
            raise ValueError('Verified dependencies require evidence')
        return self


class DocumentRequirement(RuleModel):
    key: Code
    name: Text
    description: Text
    reason: Text
    required: bool
    when: RuleConditions | None = None
    formats: list[Literal['PDF', 'JPG', 'PNG', 'XLSX']] = Field(min_length=1)
    maxSizeMb: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    filesRequired: Annotated[StrictInt, Field(gt=0)] = 1
    mustInclude: list[Text] = Field(default_factory=list)
    quality: list[Text] = Field(default_factory=list)
    fieldsToCompare: list[Literal['enterpriseName', 'pan', 'gstin', 'cin', 'udyam', 'district', 'taluka', 'pincode', 'plotNumber']] = Field(default_factory=list)
    verification: Verification = 'PROTOTYPE_ASSUMPTION'
    sources: list[EvidenceSource] = Field(default_factory=list)
    jurisdiction: Code
    effectiveFrom: Date | None = None
    requirementBasis: Literal['REGULATORY_REQUIREMENT', 'APPLICATION_POLICY', 'PROTOTYPE_POLICY']
    policyNote: Text

    @model_validator(mode='after')
    def has_evidence(self) -> 'DocumentRequirement':
        if self.verification == 'VERIFIED' and (not self.sources or self.requirementBasis != 'REGULATORY_REQUIREMENT'):
            raise ValueError('Verified regulatory documents require sources and regulatory basis')
        return self


class RuleAction(RuleModel):
    # Open for old unit fixtures; production loading enforces finalized codes.
    recommend: Code
    scope: Literal['approval', 'internal_prerequisite'] = 'approval'
    status: Literal['required', 'recommended'] = 'recommended'


class Rule(RuleModel):
    id: Code
    version: Annotated[StrictInt, Field(ge=1)]
    when: RuleConditions
    then: RuleAction
    explanation: Text
    requiredDocuments: list[str | DocumentRequirement] = Field(default_factory=list)
    verification: Verification = 'PROTOTYPE_ASSUMPTION'
    sources: list[EvidenceSource] = Field(default_factory=list)
    jurisdiction: Code | None = None
    effectiveFrom: Date | None = None
    effectiveTo: Date | None = None
    decisionInputs: list[FieldPath] = Field(default_factory=list)
    limitations: list[Text] = Field(default_factory=list)
    dependencies: list[DependencySpec] = Field(default_factory=list)

    @field_validator('requiredDocuments')
    @classmethod
    def unique_documents(cls, documents: list[str | DocumentRequirement]) -> list[str | DocumentRequirement]:
        keys = [document if isinstance(document, str) else document.key for document in documents]
        if any(not key.strip() for key in keys) or len(keys) != len(set(keys)):
            raise ValueError('Document keys must be non-empty and unique within a rule')
        return documents

    @model_validator(mode='after')
    def evidence_consistent(self) -> 'Rule':
        if self.verification == 'VERIFIED' and (not self.sources or not self.jurisdiction):
            raise ValueError('Verified rules require evidence and jurisdiction')
        # Application-policy "required" (what the applicant must submit to complete
        # the application) does not assert a statutory determination, so it is
        # allowed for unverified rules. Legal verification is tracked separately.
        if self.effectiveFrom and self.effectiveTo and self.effectiveFrom > self.effectiveTo:
            raise ValueError('Invalid effective date interval')
        if len(self.decisionInputs) != len(set(self.decisionInputs)):
            raise ValueError('decisionInputs must be unique')
        return self
