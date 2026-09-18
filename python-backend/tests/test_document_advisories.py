"""Tests for the non-blocking document/form mismatch advisories."""
import base64
import io
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from pypdf import PdfWriter

from app.domain.api_contract_models import ValidateRequest
from app.services.document_advisories import build_document_advisories
from app.services.document_reader import build_document_processor


def blank_pdf_b64() -> str:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    return base64.b64encode(buffer.getvalue()).decode()


def payload(pan: str | None = None, project: dict | None = None) -> ValidateRequest:
    return ValidateRequest.model_validate({
        'rulesVersion': '2026.09',
        'projectId': 'a1b2c3d4-0000-4444-8888-1234567890ab',
        'projectVersion': 1,
        'project': project if project is not None else {'pan': pan},
        'documents': [{
            'documentId': 'd1', 'version': 1, 'approvalKey': 'food-licence',
            'documentKey': 'factory-plan', 'fileName': 'plan.pdf', 'mimeType': 'application/pdf',
            'detectedMimeType': None, 'sizeBytes': 10, 'storageKey': None,
            'fileReadStatus': 'not_checked', 'extractionStatus': 'not_run',
            'extractedData': None, 'expiresOn': None, 'content': blank_pdf_b64(),
        }],
    })


def app_with_reader():
    return SimpleNamespace(state=SimpleNamespace(document_processor=build_document_processor()))


class AdvisoryTests(unittest.TestCase):
    def test_warns_when_the_document_pan_differs_from_the_form(self):
        with patch('app.services.document_reader._pdf_text', return_value='PAN AABCS9999Z'):
            advisories = build_document_advisories(app_with_reader(), payload('AABCS1234F'))
        self.assertEqual(len(advisories), 1)
        self.assertEqual(advisories[0].code, 'DOCUMENT_VALUE_LOOKS_DIFFERENT')
        self.assertEqual(advisories[0].severity, 'warning')
        self.assertEqual(advisories[0].field, 'project.pan')
        self.assertIn('AABCS9999Z', advisories[0].message)

    def test_no_warning_when_the_document_pan_matches(self):
        with patch('app.services.document_reader._pdf_text', return_value='PAN AABCS1234F'):
            advisories = build_document_advisories(app_with_reader(), payload('AABCS1234F'))
        self.assertEqual(advisories, [])

    def test_match_is_case_and_space_insensitive(self):
        with patch('app.services.document_reader._pdf_text', return_value='pan  aabcs1234f'):
            advisories = build_document_advisories(app_with_reader(), payload('AABCS1234F'))
        self.assertEqual(advisories, [])

    def test_no_advisories_when_reader_is_disabled(self):
        app = SimpleNamespace(state=SimpleNamespace())
        self.assertEqual(build_document_advisories(app, payload('AABCS1234F')), [])

    def test_no_advisory_when_form_field_is_empty(self):
        # Nothing entered to compare against → no false "mismatch".
        with patch('app.services.document_reader._pdf_text', return_value='PAN AABCS9999Z'):
            advisories = build_document_advisories(app_with_reader(), payload(project={}))
        self.assertEqual(advisories, [])

    def test_pincode_difference_does_not_raise_an_advisory(self):
        # Pincode is low-precision, so it never triggers a mismatch warning.
        with patch('app.services.document_reader._pdf_text', return_value='PIN 999999'):
            advisories = build_document_advisories(app_with_reader(), payload(project={'pincode': '411001'}))
        self.assertEqual(advisories, [])

    def test_gstin_mismatch_is_flagged(self):
        with patch('app.services.document_reader._pdf_text', return_value='GSTIN 27ZZZZZ9999Z1Z5'):
            advisories = build_document_advisories(
                app_with_reader(), payload(project={'gstin': '27AABCS1234F1Z5'})
            )
        self.assertEqual(len(advisories), 1)
        self.assertEqual(advisories[0].field, 'project.gstin')
