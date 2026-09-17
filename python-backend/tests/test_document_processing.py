import copy
import json
from datetime import datetime, timezone
from types import SimpleNamespace
import unittest

from app.domain.api_contract_models import EvaluateResponse, UploadedDocument, ValidateRequest
from app.domain.document_models import DocumentProcessingResult
from app.services.document_adapter import to_validation_document
from app.services.document_policy import CrossDocumentRule, DocumentValidationPolicy
from app.services.document_processing import ContentInspection, process_document, prepare_validation_documents
from app.services.validation import validate_application
from test_validation_service import fixture

NOW = datetime(2026, 9, 17, tzinfo=timezone.utc)
# Deliberately truncated bytes: a signature is not a usable PDF.
PDF_CANDIDATE = b'%PDF-1.7\nsynthetic test bytes\n'


def confirmed_fixture(content, inspected):
    """Explicit test provider, never installed as a production extractor."""
    return DocumentProcessingResult.model_validate({
        **inspected.model_dump(by_alias=True), 'processingStatus': 'completed',
        'detectedDocumentType': inspected.declared_document_type, 'typeConfirmed': True,
        'subject': 'business', 'subjectConfirmed': True,
        'fields': [{'key': 'pan', 'value': 'AABCS1234F', 'status': 'confirmed',
                    'source': 'manual_review', 'confirmation': 'manual_review'}],
    })


class DocumentProcessingTests(unittest.TestCase):
    def setUp(self):
        self.request, self.evaluation = fixture()
        self.upload = UploadedDocument.model_validate(self.request['documents'][0])

    def process(self, **kwargs):
        return process_document(self.upload, PDF_CANDIDATE, **kwargs)

    def test_actual_size_and_signature_override_claims(self):
        result = self.process()
        self.assertEqual(result.size_bytes, len(PDF_CANDIDATE))
        self.assertEqual(result.detected_mime_type, 'application/pdf')
        self.assertEqual(result.file_read_status, 'not_checked')
        self.assertEqual(to_validation_document(result).extraction_status, 'review_required')

    def test_unsupported_bytes_not_trusted_from_name(self):
        result = process_document(self.upload, b'not a PDF')
        self.assertIsNone(result.detected_mime_type)
        result = process_document(self.upload, b'PK\x03\x04not necessarily XLSX')
        self.assertIsNone(result.detected_mime_type)

    def test_bounded_content_does_not_call_provider(self):
        def forbidden(content):
            self.fail('Parser must not run above the byte limit')
        result = self.process(inspector=forbidden, max_bytes=5)
        self.assertEqual(result.size_bytes, len(PDF_CANDIDATE))
        self.assertEqual(result.file_read_status, 'not_checked')

    def test_corrupt_and_encrypted_files(self):
        for status in ('unreadable', 'password_protected'):
            with self.subTest(status=status):
                result = self.process(inspector=lambda b: ContentInspection('application/pdf', status), extractor=confirmed_fixture)
                self.assertEqual(result.file_read_status, status)
                self.assertIsNone(to_validation_document(result).extracted_data)

    def test_provider_failure_is_sanitized(self):
        def broken(*args):
            raise RuntimeError('sensitive provider detail')
        for kwargs in ({'inspector': broken}, {'inspector': lambda b: ContentInspection('application/pdf', 'readable'), 'extractor': broken}):
            result = self.process(**kwargs)
            self.assertEqual(result.processing_status, 'failed')
            self.assertNotIn('sensitive', result.model_dump_json())

    def test_missing_extractor_returns_review(self):
        result = self.process(inspector=lambda b: ContentInspection('application/pdf', 'readable'))
        self.assertEqual(result.processing_status, 'review_required')
        self.assertFalse(result.fields)

    def test_explicit_success_fixture_and_revalidation(self):
        result = self.process(inspector=lambda b: ContentInspection('application/pdf', 'readable'), extractor=confirmed_fixture)
        self.assertEqual(result.processing_status, 'completed')
        self.assertEqual(result.size_bytes, len(PDF_CANDIDATE))
        self.request['documents'] = [to_validation_document(result).model_dump(by_alias=True)]
        evaluation = EvaluateResponse.model_validate_json(json.dumps(self.evaluation))
        self.request['project']['pan'] = 'ABCDE1234F'
        self.request['project']['gstin'] = None
        mismatch = validate_application(ValidateRequest.model_validate(self.request), evaluation, evaluated_at=NOW)
        self.assertIn('DOCUMENT_DATA_MISMATCH', {i.code for i in mismatch.blocking_issues})
        self.request['project']['pan'] = 'AABCS1234F'
        self.request['projectVersion'] = 2
        corrected = validate_application(ValidateRequest.model_validate(self.request), evaluation, evaluated_at=NOW)
        self.assertEqual(corrected.project_version, 2)
        self.assertFalse(corrected.blocking_issues)
        self.assertEqual(corrected.document_checks[0].status, 'matched')
        # Replace with an unreadable new version; old success must not survive.
        self.request['documents'][0].update(version=2, fileReadStatus='unreadable')
        replaced = validate_application(ValidateRequest.model_validate(self.request), evaluation, evaluated_at=NOW)
        self.assertTrue(replaced.blocking_issues)
        self.assertFalse(any(c.status == 'matched' for c in replaced.document_checks))

    def test_uncertain_extraction_and_signatory_never_company_match(self):
        for subject, status in (('business', 'uncertain'), ('signatory', 'confirmed')):
            def provider(content, inspected):
                data = confirmed_fixture(content, inspected).model_dump(by_alias=True)
                data['subject'] = subject
                if status == 'uncertain':
                    data['processingStatus'] = 'review_required'
                    data['fields'][0].update(status='uncertain', confirmation=None, source='ocr', confidence=0.99)
                return DocumentProcessingResult.model_validate(data)
            result = self.process(inspector=lambda b: ContentInspection('application/pdf', 'readable'), extractor=provider)
            self.request['documents'] = [to_validation_document(result).model_dump(by_alias=True)]
            validation = validate_application(ValidateRequest.model_validate(self.request), EvaluateResponse.model_validate_json(json.dumps(self.evaluation)), evaluated_at=NOW)
            self.assertEqual(validation.validation_status, 'review_required')
            self.assertFalse(any(c.status == 'matched' for c in validation.document_checks))

    def test_extractor_cannot_change_binding_or_inspection(self):
        for field, value in (('documentId', 'other'), ('sizeBytes', 1000), ('detectedMimeType', 'image/png')):
            def provider(content, inspected):
                return DocumentProcessingResult.model_validate({**confirmed_fixture(content, inspected).model_dump(by_alias=True), field: value})
            self.assertEqual(self.process(inspector=lambda b: ContentInspection('application/pdf', 'readable'), extractor=provider).processing_status, 'failed')

    def test_worker_failure_no_fallback_to_request_claims(self):
        app = SimpleNamespace(state=SimpleNamespace(document_processor=lambda upload: None))
        request = prepare_validation_documents(app, ValidateRequest.model_validate(self.request))
        self.assertEqual(request.documents[0].extraction_status, 'failed')
        self.assertIsNone(request.documents[0].extracted_data)
        self.assertIsNone(request.documents[0].detected_mime_type)

    def test_worker_result_replaces_actual_metadata(self):
        result = self.process(inspector=lambda b: ContentInspection('application/pdf', 'readable'), extractor=confirmed_fixture)
        app = SimpleNamespace(state=SimpleNamespace(document_processor=lambda upload: result))
        request = prepare_validation_documents(app, ValidateRequest.model_validate(self.request))
        self.assertEqual(request.documents[0].size_bytes, len(PDF_CANDIDATE))


class ExplicitPolicyTests(unittest.TestCase):
    def setUp(self):
        self.request, self.evaluation = fixture()

    def validate(self, policy=None):
        return validate_application(ValidateRequest.model_validate_json(json.dumps(self.request)), EvaluateResponse.model_validate_json(json.dumps(self.evaluation)), evaluated_at=NOW, policy=policy)

    def codes(self, result):
        return {i.code for i in result.blocking_issues + result.review_items}

    def second_document(self):
        requirement = copy.deepcopy(self.evaluation['approvals'][0]['documents'][0])
        requirement['key'] = 'second-business-pan'
        self.evaluation['approvals'][0]['documents'].append(requirement)
        upload = copy.deepcopy(self.request['documents'][0])
        upload.update(documentId='second', documentKey='second-business-pan')
        self.request['documents'].append(upload)

    def cross_policy(self):
        return DocumentValidationPolicy(cross_document_rules=(CrossDocumentRule('pan', (('food-licence', 'identity-proof'), ('food-licence', 'second-business-pan')), 'Synthetic business PAN consistency specification'),))

    def test_cross_document_conflict_only_explicitly_configured(self):
        self.second_document()
        self.request['documents'][1]['extractedData']['pan'] = 'ABCDE5678F'
        self.assertNotIn('CROSS_DOCUMENT_CONFLICT', self.codes(self.validate()))
        result = self.validate(self.cross_policy())
        self.assertIn('CROSS_DOCUMENT_CONFLICT', self.codes(result))
        self.assertEqual(result.validation_status, 'review_required')
        self.request['documents'][1]['extractedData']['pan'] = self.request['project']['pan']
        self.assertFalse(self.validate(self.cross_policy()).review_items)

    def test_cross_document_missing_or_invalid_extraction_review(self):
        self.second_document()
        self.request['documents'][1]['extractedData']['pan'] = 'bad'
        result = self.validate(self.cross_policy())
        self.assertIn('EXTRACTED_FIELD_UNRELIABLE', self.codes(result))
        self.assertIn('CROSS_DOCUMENT_COMPARISON_UNAVAILABLE', self.codes(result))

    def test_no_universal_expiry(self):
        self.request['documents'][0]['expiresOn'] = '2000-01-01'
        result = self.validate()
        self.assertNotIn('DOCUMENT_EXPIRED', self.codes(result))
        self.assertIn('DOCUMENT_VALIDITY_POLICY_UNRESOLVED', self.codes(result))

    def test_established_expiry_missing_past_and_today(self):
        policy = DocumentValidationPolicy(expiry_rules=(('food-licence', 'identity-proof', 'Synthetic printed-expiry fixture specification'),))
        self.request['documents'][0]['expiresOn'] = None
        self.assertIn('DOCUMENT_EXPIRY_REVIEW_NEEDED', self.codes(self.validate(policy)))
        self.request['documents'][0]['expiresOn'] = '2026-09-16'
        self.assertIn('DOCUMENT_EXPIRED', self.codes(self.validate(policy)))
        self.request['documents'][0]['expiresOn'] = '2026-09-17'
        self.assertFalse(self.validate(policy).blocking_issues)

    def test_required_file_count_and_actual_type_size(self):
        self.evaluation['approvals'][0]['documents'][0]['filesRequired'] = 2
        self.assertIn('REQUIRED_DOCUMENT_MISSING', self.codes(self.validate()))
        upload = copy.deepcopy(self.request['documents'][0])
        upload['documentId'] = 'second-file'
        self.request['documents'].append(upload)
        self.assertNotIn('REQUIRED_DOCUMENT_MISSING', self.codes(self.validate()))
        self.request['documents'][0].update(detectedMimeType='image/png', sizeBytes=1000001)
        self.assertTrue({'DOCUMENT_FORMAT_NOT_ALLOWED', 'DOCUMENT_TOO_LARGE'} <= self.codes(self.validate()))

    def test_pending_readability_does_not_match_fields(self):
        self.request['documents'][0]['fileReadStatus'] = 'not_checked'
        result = self.validate()
        self.assertEqual(result.validation_status, 'review_required')
        self.assertFalse(any(c.status == 'matched' for c in result.document_checks))

    def test_extraction_failure_without_comparison_still_review(self):
        self.evaluation['approvals'][0]['documents'][0].update(fieldsToCompare=[], quality=['Review drawing'])
        self.request['documents'][0].update(extractionStatus='failed', extractedData=None)
        self.assertIn('DOCUMENT_PROCESSING_UNRESOLVED', self.codes(self.validate()))

    def test_policy_rejects_missing_basis_or_personal_field(self):
        with self.assertRaises(ValueError):
            CrossDocumentRule('signatoryName', (('a', 'b'), ('a', 'c')), 'test')
        with self.assertRaises(ValueError):
            DocumentValidationPolicy(expiry_rules=(('a', 'b', ''),))
