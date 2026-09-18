"""Tests for the prototype document reader (inspection + PDF text extraction)."""
import base64
import io
import unittest
from unittest.mock import patch

from pypdf import PdfWriter

from app.domain.api_contract_models import UploadedDocument
from app.services.document_adapter import to_validation_document
from app.services.document_reader import (
    build_document_processor,
    extract_credentials_from_text,
    inspect,
)

PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) + b'\x00' * 16


def blank_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def encrypted_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.encrypt(user_password="secret")
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def upload(**overrides) -> UploadedDocument:
    data = {
        'documentId': 'd1', 'version': 1, 'approvalKey': 'food-licence',
        'documentKey': 'factory-plan', 'fileName': 'plan.pdf', 'mimeType': 'application/pdf',
        'detectedMimeType': None, 'sizeBytes': 10, 'storageKey': None,
        'fileReadStatus': 'not_checked', 'extractionStatus': 'not_run',
        'extractedData': None, 'expiresOn': None,
    }
    data.update(overrides)
    return UploadedDocument.model_validate(data)


class ExtractCredentialsTests(unittest.TestCase):
    def test_finds_identifiers_as_uncertain_candidates(self):
        fields = extract_credentials_from_text('Business PAN AABCS1234F GSTIN 27AABCS1234F1Z5 PIN 411001')
        by_key = {f['key']: f for f in fields}
        self.assertEqual(by_key['pan']['value'], 'AABCS1234F')
        self.assertEqual(by_key['gstin']['value'], '27AABCS1234F1Z5')
        self.assertEqual(by_key['pincode']['value'], '411001')
        self.assertTrue(all(f['status'] == 'uncertain' for f in fields))
        self.assertTrue(all('confirmation' not in f for f in fields))

    def test_returns_nothing_for_text_without_identifiers(self):
        self.assertEqual(extract_credentials_from_text('just some ordinary prose'), [])

    def test_gstin_does_not_produce_a_false_pan(self):
        keys = [f['key'] for f in extract_credentials_from_text('GSTIN 27AABCS1234F1Z5')]
        self.assertIn('gstin', keys)
        self.assertNotIn('pan', keys)

    def test_takes_only_the_first_candidate_per_key(self):
        fields = extract_credentials_from_text('PAN AABCS1234F PAN ZZZZZ9999Z')
        pans = [f for f in fields if f['key'] == 'pan']
        self.assertEqual(len(pans), 1)
        self.assertEqual(pans[0]['value'], 'AABCS1234F')


class InspectTests(unittest.TestCase):
    def test_reads_a_valid_pdf(self):
        result = inspect(blank_pdf())
        self.assertEqual(result.detected_mime_type, 'application/pdf')
        self.assertEqual(result.read_status, 'readable')

    def test_reads_an_image_signature(self):
        result = inspect(PNG)
        self.assertEqual(result.detected_mime_type, 'image/png')
        self.assertEqual(result.read_status, 'readable')

    def test_flags_unrecognised_content_as_unreadable(self):
        result = inspect(b'not a real document at all')
        self.assertIsNone(result.detected_mime_type)
        self.assertEqual(result.read_status, 'unreadable')


class ProcessorTests(unittest.TestCase):
    def setUp(self):
        self.processor = build_document_processor()

    def test_no_content_is_not_processed(self):
        result = self.processor(upload())
        self.assertEqual(result.processing_status, 'not_processed')
        self.assertEqual(to_validation_document(result).extraction_status, 'not_run')

    def test_invalid_base64_fails(self):
        result = self.processor(upload(content='not valid base64 %%%'))
        self.assertEqual(result.processing_status, 'failed')
        self.assertEqual(to_validation_document(result).extraction_status, 'failed')

    def test_pdf_without_identifiers_needs_review(self):
        result = self.processor(upload(content=base64.b64encode(blank_pdf()).decode()))
        self.assertEqual(result.processing_status, 'review_required')
        self.assertEqual(result.file_read_status, 'readable')
        self.assertEqual(result.detected_mime_type, 'application/pdf')
        self.assertEqual(result.fields, [])
        self.assertEqual(to_validation_document(result).extraction_status, 'review_required')

    def test_pdf_with_identifiers_surfaces_them_for_review(self):
        with patch('app.services.document_reader._pdf_text', return_value='PAN AABCS1234F'):
            result = self.processor(upload(content=base64.b64encode(blank_pdf()).decode()))
        self.assertEqual(result.processing_status, 'review_required')
        self.assertEqual(len(result.fields), 1)
        self.assertEqual(result.fields[0].key, 'pan')
        self.assertEqual(result.fields[0].value, 'AABCS1234F')
        self.assertEqual(result.fields[0].status, 'uncertain')
        # Automated extraction never auto-confirms: no verified data reaches validation.
        validation_doc = to_validation_document(result)
        self.assertEqual(validation_doc.extraction_status, 'review_required')
        self.assertIsNone(validation_doc.extracted_data)

    def test_password_protected_pdf_is_flagged_and_not_extracted(self):
        result = self.processor(upload(content=base64.b64encode(encrypted_pdf()).decode()))
        self.assertEqual(result.file_read_status, 'password_protected')
        self.assertEqual(result.fields, [])
        self.assertEqual(to_validation_document(result).extraction_status, 'review_required')

    def test_truncated_pdf_never_becomes_succeeded(self):
        result = self.processor(upload(content=base64.b64encode(b'%PDF-1.7\nthis is not really a pdf').decode()))
        self.assertIn(result.processing_status, {'failed', 'review_required'})
        self.assertEqual(result.fields, [])
        self.assertNotEqual(to_validation_document(result).extraction_status, 'succeeded')

    def test_image_content_requests_manual_review(self):
        result = self.processor(upload(fileName='photo.png', mimeType='image/png', content=base64.b64encode(PNG).decode()))
        self.assertEqual(result.processing_status, 'review_required')
        self.assertEqual(result.detected_mime_type, 'image/png')
        self.assertEqual(result.fields, [])


if __name__ == '__main__':
    unittest.main()
