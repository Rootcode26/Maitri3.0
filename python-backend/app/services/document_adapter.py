"""Fail-closed bridge from a trusted processor result to existing /validate input."""
from app.domain.api_contract_models import UploadedDocument
from app.domain.document_models import DocumentProcessingResult


def to_validation_document(result: DocumentProcessingResult) -> UploadedDocument:
    type_matches = (
        result.declared_document_type is not None
        and result.detected_document_type == result.declared_document_type
        and result.type_confirmed
    )
    usable = (
        result.processing_status == 'completed' and type_matches
        and result.subject == 'business' and result.subject_confirmed
    )
    if usable:
        extraction_status = 'succeeded'
    elif result.processing_status == 'failed':
        extraction_status = 'failed'
    elif result.processing_status == 'not_processed':
        extraction_status = 'not_run'
    else:
        extraction_status = 'review_required'
    return UploadedDocument.model_validate({
        'documentId': result.document_id, 'version': result.version,
        'approvalKey': result.approval_key, 'documentKey': result.document_key,
        'fileName': result.file_name, 'storageKey': result.storage_key,
        'mimeType': result.mime_type, 'detectedMimeType': result.detected_mime_type,
        'sizeBytes': result.size_bytes, 'fileReadStatus': result.file_read_status,
        'extractionStatus': extraction_status,
        'extractedData': {field.key: field.value for field in result.fields} if usable else None,
        'expiresOn': result.confirmed_expires_on,
    })
