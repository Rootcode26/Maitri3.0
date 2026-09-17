"""Generate a synthetic fail-safe handoff example through the actual integration."""
import json
from datetime import datetime, timezone
from pathlib import Path

from app.domain.api_contract_models import EvaluateRequest, UploadedDocument, ValidateRequest
from app.services.document_adapter import to_validation_document
from app.services.document_processing import process_document
from app.services.rules_adapter import RulesAdapter
from app.services.validation import validate_application


def example():
    root = Path(__file__).resolve().parents[2]
    request = json.loads((root / 'packages/contracts/examples/evaluations/node/evaluate.request.json').read_text(encoding='utf-8'))
    request['projectId'] = 'synthetic-food-factory'
    request['project'].update(enterpriseName='Synthetic Foods Ltd.', pan='ABCDE1234F', gstin=None,
                              cin=None, udyam=None, hazardousChemicals='yes')
    now = datetime(2026, 9, 17, tzinfo=timezone.utc)
    evaluation = RulesAdapter(clock=lambda: now)(EvaluateRequest.model_validate(request))
    content = b'%PDF-1.7\nDeliberately incomplete synthetic fixture\n'
    upload = UploadedDocument.model_validate({
        'documentId': 'synthetic-signatory-file', 'version': 1, 'approvalKey': 'food-licence',
        'documentKey': 'identity-proof', 'fileName': 'synthetic.pdf', 'mimeType': 'application/pdf',
        'detectedMimeType': None, 'sizeBytes': len(content), 'storageKey': None,
        'fileReadStatus': 'not_checked', 'extractionStatus': 'not_run', 'extractedData': None,
        'expiresOn': None,
    })
    processing = process_document(upload, content)  # No parser/extractor: explicit review.
    validation_request = ValidateRequest.model_validate({
        **request, 'projectVersion': 1, 'documents': [to_validation_document(processing)],
    })
    validation = validate_application(validation_request, evaluation, evaluated_at=now)
    return {
        'note': 'Synthetic prototype; incomplete PDF signature is not a readable document. No production parser/OCR or authenticity verification is configured.',
        'evaluateRequest': request, 'evaluateResponse': evaluation.model_dump(by_alias=True, mode='json'),
        'processingResult': processing.model_dump(by_alias=True, mode='json'),
        'validateRequest': validation_request.model_dump(by_alias=True, mode='json'),
        'validateResponse': validation.model_dump(by_alias=True, mode='json'),
    }


if __name__ == '__main__':
    print(json.dumps(example(), indent=2, ensure_ascii=False))
