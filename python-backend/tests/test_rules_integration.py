import json
from datetime import datetime, timezone
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.api.routes.evaluation import router as evaluation_router
from app.api.routes.validation import router as validation_router
from app.domain.api_contract_models import EvaluateRequest, EvaluateResponse, ValidateRequest
from app.services.rule_provider import register_rules_evaluator, evaluate_registered, RulesUnavailable
from app.services.rules_adapter import RulesAdapter, TrustedRulesContext
from app.services.validation import validate_application
from test_validation_service import fixture

NOW = datetime(2026, 9, 17, tzinfo=timezone.utc)


class RulesIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.request, self.evaluation = fixture()
        self.payload = {k: self.request[k] for k in ('rulesVersion', 'projectId', 'project')}
        self.adapter = RulesAdapter(clock=lambda: NOW)

    def evaluate(self):
        return self.adapter(EvaluateRequest.model_validate(self.payload))

    def test_valid_envelope_and_five_code_limit(self):
        response = self.evaluate()
        self.assertEqual(response.project_id, self.payload['projectId'])
        self.assertEqual(response.rules_version, '2026.09')
        self.assertEqual(response.evaluated_at, NOW)
        self.assertIsNone(response.readiness_score)
        self.assertTrue(response.blocking_issues)
        self.assertTrue({a.key for a in response.approvals} <= {'food-licence', 'factory-registration', 'fire-noc', 'consent-to-operate', 'boiler-registration'})
        EvaluateResponse.model_validate_json(response.model_dump_json(by_alias=True))

    def test_missing_context_explicit(self):
        response = self.evaluate()
        fields = {i.field for i in response.blocking_issues}
        self.assertIn('location.stateCode', fields)
        self.assertIn('regulatory.annualTurnover', fields)
        self.assertIn('regulatory.waterUsedAsIngredient', fields)

    def test_context_confirmation_does_not_promote_rules(self):
        resolver = lambda project_id, version: TrustedRulesContext(jurisdiction='MH', regulatory_inputs={'annualTurnover': 1, 'foodKindOfBusiness': 'test', 'foodEligibilityConfirmed': True})
        response = RulesAdapter(resolver, clock=lambda: NOW)(EvaluateRequest.model_validate(self.payload))
        self.assertTrue(all(a.status == 'recommended' for a in response.approvals))
        self.assertTrue(response.blocking_issues)

    def test_untrusted_context_rejected_at_contract(self):
        for key in ('jurisdiction', 'regulatoryInputs'):
            payload = {**self.payload, key: 'MH'}
            with self.assertRaises(ValidationError):
                EvaluateRequest.model_validate(payload)

    def test_version_and_clock_fail_explicitly(self):
        self.payload['rulesVersion'] = '2026.08'
        with self.assertRaises(ValueError):
            self.evaluate()
        with self.assertRaises(ValueError):
            RulesAdapter(clock=lambda: datetime(2026, 9, 17))(EvaluateRequest.model_validate(self.payload))

    def test_registration_requires_validated_matching_response(self):
        app = SimpleNamespace(state=SimpleNamespace())
        request = EvaluateRequest.model_validate(self.payload)
        for provider in (lambda r: {}, lambda r: EvaluateResponse.model_validate_json(json.dumps({**self.evaluation, 'projectId': 'other'}))):
            register_rules_evaluator(app, provider)
            with self.assertRaises(RulesUnavailable):
                evaluate_registered(app, request)
        register_rules_evaluator(app, self.adapter)
        self.assertEqual(evaluate_registered(app, request).project_id, request.project_id)

    def test_audit_retains_evidence_and_dependency_semantics(self):
        records = []
        adapter = RulesAdapter(audit_sink=lambda p, v, result: records.append(result), clock=lambda: NOW)
        adapter(EvaluateRequest.model_validate(self.payload))
        self.assertTrue(records[0]['evidence'])
        self.assertTrue(records[0]['submissionBlocked'])
        self.assertTrue(records[0]['dependencies']['immediate'])
        self.assertNotIn('project', records[0])

    def test_full_flow_and_regulatory_blockers_survive(self):
        response = self.evaluate()
        self.request['documents'] = []
        result = validate_application(ValidateRequest.model_validate(self.request), response, evaluated_at=NOW)
        self.assertEqual(result.validation_status, 'review_required')
        self.assertEqual(result.blocking_issues, response.blocking_issues)
        self.assertFalse(any(i.code == 'REQUIRED_DOCUMENT_MISSING' for i in result.blocking_issues))
        # Even successful synthetic document checks cannot erase engine blockers.
        evaluation = EvaluateResponse.model_validate_json(json.dumps({**self.evaluation, 'blockingIssues': [i.model_dump(by_alias=True) for i in response.blocking_issues]}))
        self.request, _ = fixture()
        checked = validate_application(ValidateRequest.model_validate(self.request), evaluation, evaluated_at=NOW)
        self.assertEqual(checked.document_checks[0].status, 'matched')
        self.assertEqual(checked.validation_status, 'review_required')
        self.assertTrue(checked.blocking_issues)

    def test_routes_use_same_registered_engine(self):
        app = FastAPI()
        app.include_router(evaluation_router)
        app.include_router(validation_router)
        register_rules_evaluator(app, self.adapter)
        with patch.dict('os.environ', {'INTERNAL_API_TOKEN': 'synthetic-token'}), TestClient(app) as client:
            headers = {'X-Internal-Token': 'synthetic-token'}
            result = client.post('/evaluate', json=self.payload, headers=headers)
            self.assertEqual(result.status_code, 200, result.text)
            self.assertIsNone(result.json()['readinessScore'])
            self.request['documents'] = []
            validation = client.post('/validate', json=self.request, headers=headers)
            self.assertEqual(validation.status_code, 200, validation.text)
            self.assertTrue(validation.json()['blockingIssues'])
            self.assertEqual(client.post('/evaluate', json=self.payload).status_code, 401)
            self.payload['rulesVersion'] = '2026.08'
            self.assertEqual(client.post('/evaluate', json=self.payload, headers=headers).status_code, 503)

    def test_real_engine_to_processing_adapter_to_validation(self):
        from app.services.document_processing import ContentInspection, process_document, prepare_validation_documents
        from test_document_processing import confirmed_fixture, PDF_CANDIDATE
        app = SimpleNamespace(state=SimpleNamespace())
        # This is an explicit synthetic parser/extractor fixture, not production OCR.
        app.state.document_processor = lambda upload: process_document(upload, PDF_CANDIDATE,
            inspector=lambda b: ContentInspection('application/pdf', 'readable'), extractor=confirmed_fixture)
        response = self.evaluate()
        request = prepare_validation_documents(app, ValidateRequest.model_validate(self.request))
        result = validate_application(request, response, evaluated_at=NOW)
        self.assertEqual(request.documents[0].size_bytes, len(PDF_CANDIDATE))
        self.assertEqual(request.documents[0].extraction_status, 'succeeded')
        self.assertEqual(result.validation_status, 'review_required')
        self.assertTrue(any(i.code.startswith('REGULATORY_') for i in result.blocking_issues))
        self.assertTrue(any(i.code == 'DOCUMENT_CONTENT_REVIEW_NEEDED' for i in result.review_items))

    def test_main_registers_engine_once(self):
        # Other API tests intentionally remove their registration; test in isolation.
        from app import main
        import importlib
        importlib.reload(main)
        self.assertIsInstance(main.app.state.rules_evaluator, RulesAdapter)
        self.assertEqual(set(main.app.openapi()['paths']), {'/evaluate', '/validate', '/health'})
