"""Prototype document reader: inspects file bytes and extracts candidate
identifiers from PDF text. Extracted values are always 'uncertain' and routed to
officer review — automated reading never auto-confirms a credential."""
import base64
import io
import re
from typing import Callable

from app.domain.api_contract_models import UploadedDocument
from app.domain.document_models import DocumentProcessingResult
from app.services.document_processing import ContentInspection, candidate_mime, process_document

_PATTERNS: dict[str, re.Pattern[str]] = {
    'pan': re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b'),
    'gstin': re.compile(r'\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b'),
    'cin': re.compile(r'\b[A-Z][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{4,6}\b'),
    'udyam': re.compile(r'\bUDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}\b'),
    'pincode': re.compile(r'\b[1-9][0-9]{5}\b'),
}

_MAX_PAGES = 20


def extract_credentials_from_text(text: str) -> list[dict]:
    """Pure text → candidate fields. Every value is 'uncertain' (needs review)."""
    normalized = re.sub(r'\s+', ' ', text.upper())
    fields: list[dict] = []
    for key, pattern in _PATTERNS.items():
        match = pattern.search(normalized)
        if match:
            fields.append({
                'key': key,
                'value': match.group(0),
                'status': 'uncertain',
                'source': 'pdf_text',
                'confidence': 0.6,
                'reason': 'Matched a known identifier pattern in the document text; not independently verified.',
            })
    return fields


def _pdf_text(content: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(content))
    parts: list[str] = []
    for page in reader.pages[:_MAX_PAGES]:
        try:
            parts.append(page.extract_text() or '')
        except Exception:
            continue
    return '\n'.join(parts)


def inspect(content: bytes) -> ContentInspection:
    mime = candidate_mime(content)
    if mime is None:
        return ContentInspection(detected_mime_type=None, read_status='unreadable')
    if mime == 'application/pdf':
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                return ContentInspection(detected_mime_type=mime, read_status='password_protected')
        except Exception:
            return ContentInspection(detected_mime_type=mime, read_status='unreadable')
    return ContentInspection(detected_mime_type=mime, read_status='readable')


def extract(content: bytes, base: DocumentProcessingResult) -> DocumentProcessingResult:
    data = base.model_dump(by_alias=True)
    data['processingStatus'] = 'review_required'
    if base.detected_mime_type != 'application/pdf':
        data['fields'] = []
        data['notes'] = ['Automated extraction supports PDF text only; this file needs manual review.']
        return DocumentProcessingResult.model_validate(data)

    fields = extract_credentials_from_text(_pdf_text(content))
    data['fields'] = fields
    data['notes'] = (
        ['Extracted candidate identifiers from the PDF text for officer review.']
        if fields
        else ['No known identifiers were found in the document text; manual review required.']
    )
    return DocumentProcessingResult.model_validate(data)


def _skeleton(upload: UploadedDocument, status: str, notes: list[str]) -> DocumentProcessingResult:
    return DocumentProcessingResult.model_validate({
        **upload.model_dump(
            by_alias=True,
            exclude={'extraction_status', 'extracted_data', 'expires_on', 'content'},
        ),
        'detectedMimeType': None,
        'fileReadStatus': 'not_checked',
        'declaredDocumentType': upload.document_key,
        'detectedDocumentType': None,
        'typeConfirmed': False,
        'subject': 'unknown',
        'subjectConfirmed': False,
        'processingStatus': status,
        'fields': [],
        'confirmedExpiresOn': None,
        'notes': notes,
    })


def build_document_processor() -> Callable[[UploadedDocument], DocumentProcessingResult]:
    def processor(upload: UploadedDocument) -> DocumentProcessingResult:
        if not upload.content:
            return _skeleton(upload, 'not_processed', [])
        try:
            content = base64.b64decode(upload.content, validate=True)
        except Exception:
            return _skeleton(upload, 'failed', ['Document bytes could not be decoded.'])
        if not content:
            return _skeleton(upload, 'failed', ['Document bytes were empty.'])
        return process_document(upload, content, inspector=inspect, extractor=extract)

    return processor
