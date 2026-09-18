"""Bounded in-process byte inspection/extraction; no upload, storage or OCR mocks.

The storage owner supplies bytes after ownership checks. Parser and extractor
providers are explicit; signatures identify candidate types, never readability.
Providers must enforce CPU/time/page/decompression limits in their worker.
"""
from dataclasses import dataclass
from typing import Callable

from app.domain.api_contract_models import UploadedDocument
from app.domain.document_models import DocumentProcessingResult
from app.services.document_adapter import to_validation_document


@dataclass(frozen=True)
class ContentInspection:
    detected_mime_type: str | None
    read_status: str  # readable, unreadable, password_protected, not_checked


def candidate_mime(content: bytes) -> str | None:
    if content.startswith(b'%PDF-'):
        return 'application/pdf'
    if content.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if content.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    # ZIP is not necessarily XLSX. Only a configured bounded parser may say so.
    return None


def process_document(upload: UploadedDocument, content: bytes, *, inspector=None,
                     extractor=None, max_bytes=20_000_000) -> DocumentProcessingResult:
    if not isinstance(content, bytes) or not content:
        raise ValueError('Processor requires nonempty actual file bytes')
    if type(max_bytes) is not int or max_bytes <= 0:
        raise ValueError('Processor limit must be a positive integer')
    data = {
        **upload.model_dump(
            by_alias=True,
            exclude={'extraction_status', 'extracted_data', 'expires_on', 'content'},
        ),
        'sizeBytes': len(content), 'detectedMimeType': None, 'fileReadStatus': 'not_checked',
        'declaredDocumentType': upload.document_key, 'detectedDocumentType': None,
        'typeConfirmed': False, 'subject': 'unknown', 'subjectConfirmed': False,
        'processingStatus': 'review_required', 'fields': [], 'confirmedExpiresOn': None,
        'notes': [],
    }
    if len(content) > max_bytes:
        data['notes'] = ['Content exceeds the configured processor byte limit; processing was not attempted.']
        return DocumentProcessingResult.model_validate(data)
    if inspector is None:
        data['detectedMimeType'] = candidate_mime(content)
        data['notes'] = ['Content parser is not configured; signature alone does not establish readability or document type.']
        return DocumentProcessingResult.model_validate(data)
    try:
        inspected = inspector(content)
        if not isinstance(inspected, ContentInspection) or inspected.read_status not in {'readable', 'unreadable', 'password_protected', 'not_checked'}:
            raise ValueError('Invalid inspection output')
        data.update(detectedMimeType=inspected.detected_mime_type, fileReadStatus=inspected.read_status)
        if inspected.read_status != 'readable' or inspected.detected_mime_type is None:
            data['notes'] = ['File is corrupt, encrypted, unsupported or not reliably readable.']
        elif extractor is None:
            data['notes'] = ['Extraction provider is not configured; request manual review.']
        else:
            result = extractor(content, DocumentProcessingResult.model_validate(data))
            if not isinstance(result, DocumentProcessingResult):
                raise ValueError('Extractor must return validated processing output')
            expected = DocumentProcessingResult.model_validate(data)
            for key in ('document_id', 'version', 'approval_key', 'document_key', 'file_name', 'storage_key', 'mime_type', 'size_bytes', 'detected_mime_type', 'file_read_status', 'declared_document_type'):
                if getattr(result, key) != getattr(expected, key):
                    raise ValueError('Extractor changed the inspected file binding')
            return result
    except Exception:
        # Do not expose parser exceptions or extracted credentials in logs/results.
        data.update(processingStatus='failed', fields=[], confirmedExpiresOn=None,
                    notes=['Document provider failed; retry processing or obtain manual review.'])
    return DocumentProcessingResult.model_validate(data)


def prepare_validation_documents(app, request):
    """Optional existing-worker integration; default transport remains trusted Node.

    Register app.state.document_processor(upload) -> DocumentProcessingResult.
    The callback resolves owned storage references; this service fetches no path/URL.
    A configured worker's failure must never fall back to request extraction claims.
    """
    provider: Callable | None = getattr(app.state, 'document_processor', None)
    if provider is None:
        return request
    documents = []
    for upload in request.documents:
        try:
            result = provider(upload)
            if not isinstance(result, DocumentProcessingResult):
                raise ValueError('Invalid processing output')
            if any(getattr(result, key) != getattr(upload, key) for key in ('document_id', 'version', 'approval_key', 'document_key', 'file_name', 'storage_key')):
                raise ValueError('Document snapshot differs')
            documents.append(to_validation_document(result))
        except Exception:
            # Snapshot/provider failure is unavailable, never a successful upload.
            documents.append(UploadedDocument.model_validate({
                **upload.model_dump(by_alias=True), 'detectedMimeType': None,
                'fileReadStatus': 'not_checked', 'extractionStatus': 'failed',
                'extractedData': None, 'expiresOn': None,
            }))
    return type(request).model_validate({**request.model_dump(by_alias=True), 'documents': documents})
