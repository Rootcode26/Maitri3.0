"""Processor output, separate from P1's approval/document requirements."""
from datetime import date
from typing import Annotated, Literal
from pydantic import Field, model_validator
from app.domain.request_models import ContractModel, Identifier, NonEmpty, PositiveInt

CredentialField = Literal[
    'enterpriseName', 'pan', 'gstin', 'cin', 'udyam',
    'district', 'taluka', 'pincode', 'plotNumber',
]


class ExtractedField(ContractModel):
    key: CredentialField
    value: NonEmpty | None
    status: Literal['confirmed', 'uncertain', 'not_found']
    source: Literal['pdf_text', 'ocr', 'manual_review']
    page: PositiveInt | None = None
    # Confidence is descriptive, never a substitute for confirmation.
    confidence: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)] | None = None
    confirmation: Literal['manual_review', 'trusted_structured_source'] | None = None
    reason: NonEmpty | None = None

    @model_validator(mode='after')
    def consistent_field(self):
        if self.status == 'not_found' and self.value is not None:
            raise ValueError('A missing field cannot contain a value')
        if self.status in {'confirmed', 'uncertain'} and self.value is None:
            raise ValueError('An extracted field needs a value')
        if self.status == 'confirmed' and self.confirmation is None:
            raise ValueError('Confirmed values require a trusted confirmation basis')
        if self.status != 'confirmed' and self.confirmation is not None:
            raise ValueError('Only confirmed values can have confirmation')
        return self


class DocumentProcessingResult(ContractModel):
    document_id: Identifier
    version: PositiveInt
    approval_key: Identifier
    document_key: Identifier
    file_name: Annotated[str, Field(min_length=1, max_length=255, pattern=r'^[^/\\]+$')]
    storage_key: Identifier | None
    mime_type: NonEmpty
    detected_mime_type: NonEmpty | None
    size_bytes: PositiveInt
    file_read_status: Literal['not_checked', 'readable', 'unreadable', 'password_protected']
    # Type names are deliberately open until P1 agrees on the document catalog.
    declared_document_type: Identifier | None
    detected_document_type: Identifier | None
    type_confirmed: bool
    subject: Literal['business', 'signatory', 'other', 'unknown']
    subject_confirmed: bool
    processing_status: Literal['not_processed', 'completed', 'review_required', 'failed']
    fields: list[ExtractedField] = Field(default_factory=list, max_length=9)
    # Only independently confirmed expiry may enter validation as authoritative.
    confirmed_expires_on: date | None = None
    notes: list[NonEmpty] = Field(default_factory=list, max_length=20)

    @model_validator(mode='after')
    def consistent_result(self):
        keys = [field.key for field in self.fields]
        if len(keys) != len(set(keys)):
            raise ValueError('Extracted field keys must be unique')
        if self.type_confirmed and self.detected_document_type is None:
            raise ValueError('Confirmed type needs a detected document type')
        if self.subject_confirmed and self.subject == 'unknown':
            raise ValueError('Unknown subject cannot be confirmed')
        if self.processing_status in {'not_processed', 'failed'} and (self.fields or self.confirmed_expires_on is not None):
            raise ValueError('Unprocessed/failed output cannot contain extracted values')
        if self.processing_status == 'completed':
            if self.file_read_status != 'readable' or self.detected_mime_type is None:
                raise ValueError('Completed processing needs readable inspected content')
            if not self.fields or any(field.status != 'confirmed' for field in self.fields):
                raise ValueError('Completed extraction needs confirmed extracted fields')
            if not self.type_confirmed or not self.subject_confirmed:
                raise ValueError('Completed processing needs confirmed document type and subject')
        return self
