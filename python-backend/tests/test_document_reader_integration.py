"""End-to-end: /validate with the document reader enabled surfaces a mismatch."""
import base64
import io
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.api.routes.evaluation import router as evaluation_router
from app.api.routes.validation import router as validation_router
from app.services.document_reader import build_document_processor
from app.services.rule_provider import register_rules_evaluator
from app.services.rules_adapter import RulesAdapter, TrustedRulesContext
from test_validation_service import fixture


def blank_pdf_b64() -> str:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    return base64.b64encode(buffer.getvalue()).decode()


class ReaderRouteIntegrationTests(unittest.TestCase):
    def setUp(self):
        request, _ = fixture()
        self.payload = {k: request[k] for k in ('rulesVersion', 'projectId', 'project', 'projectVersion', 'documents')}
        self.payload['documents'][0]['content'] = blank_pdf_b64()
        self.app = FastAPI()
        self.app.include_router(evaluation_router)
        self.app.include_router(validation_router)
        register_rules_evaluator(
            self.app, RulesAdapter(lambda project_id, version: TrustedRulesContext(jurisdiction='MH'))
        )
        self.app.state.document_processor = build_document_processor()

    def test_validate_surfaces_a_mismatch_warning_from_the_read_document(self):
        # The form PAN is AABCS1234F; make the reader "see" a different PAN.
        with patch('app.services.document_reader._pdf_text', return_value='PAN ZZZZZ9999Z'), patch.dict(
            'os.environ', {'INTERNAL_API_TOKEN': 'tok'}
        ), TestClient(self.app) as client:
            response = client.post('/validate', json=self.payload, headers={'X-Internal-Token': 'tok'})

        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertTrue(
            any(w['code'] == 'DOCUMENT_VALUE_LOOKS_DIFFERENT' for w in body['warnings']),
            body['warnings'],
        )

    def test_validate_has_no_mismatch_warning_when_values_agree(self):
        with patch('app.services.document_reader._pdf_text', return_value='PAN AABCS1234F'), patch.dict(
            'os.environ', {'INTERNAL_API_TOKEN': 'tok'}
        ), TestClient(self.app) as client:
            response = client.post('/validate', json=self.payload, headers={'X-Internal-Token': 'tok'})

        self.assertEqual(response.status_code, 200, response.text)
        codes = [w['code'] for w in response.json()['warnings']]
        self.assertNotIn('DOCUMENT_VALUE_LOOKS_DIFFERENT', codes)


if __name__ == '__main__':
    unittest.main()
