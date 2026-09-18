"""Extreme edge cases for the Node-facing contract and evaluator robustness."""
import json
import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from app.domain.api_contract_models import EvaluateRequest, EvaluateResponse
from app.services.rules_adapter import RulesAdapter, TrustedRulesContext

NOW = datetime(2026, 9, 17, tzinfo=timezone.utc)
FIVE = {'food-licence', 'factory-registration', 'fire-noc', 'consent-to-operate', 'boiler-registration'}


def _response(approvals):
    return {
        'rulesVersion': '2026.09',
        'projectId': 'a1b2c3d4-0000-4444-8888-1234567890ab',
        'evaluatedAt': '2026-09-17T00:00:00Z',
        'readinessScore': None,
        'blockingIssues': [],
        'approvals': approvals,
    }


def _approval(**overrides):
    base = {
        'key': 'consent-to-operate', 'title': 'Consent to operate', 'status': 'recommended',
        'reason': 'Test only', 'ruleId': 'ENV-004', 'departmentKey': 'mpcb',
        'processingDays': 60, 'documents': [],
    }
    base.update(overrides)
    return base


class ContractEdgeCaseTests(unittest.TestCase):
    def setUp(self):
        self.mh = RulesAdapter(lambda project_id, version: TrustedRulesContext(jurisdiction='MH'), clock=lambda: NOW)

    def test_all_null_draft_project_evaluates_without_crashing(self):
        request = EvaluateRequest.model_validate({
            'rulesVersion': '2026.09',
            'projectId': 'a1b2c3d4-0000-4444-8888-1234567890ab',
            'project': {},
        })
        response = self.mh(request)
        self.assertEqual(response.project_id, request.project_id)
        self.assertTrue({a.key for a in response.approvals} <= FIVE)
        self.assertFalse(response.blocking_issues)

    def test_response_permits_an_approval_with_zero_documents(self):
        parsed = EvaluateResponse.model_validate_json(json.dumps(_response([_approval(documents=[])])))
        self.assertEqual(parsed.approvals[0].documents, [])

    def test_zero_processing_days_is_rejected(self):
        with self.assertRaises(ValidationError):
            EvaluateResponse.model_validate_json(json.dumps(_response([_approval(processingDays=0)])))
        parsed = EvaluateResponse.model_validate_json(json.dumps(_response([_approval(processingDays=1)])))
        self.assertEqual(parsed.approvals[0].processing_days, 1)

    def test_snake_case_project_keys_are_rejected(self):
        with self.assertRaises(ValidationError):
            EvaluateRequest.model_validate({
                'rulesVersion': '2026.09',
                'projectId': 'a1b2c3d4-0000-4444-8888-1234567890ab',
                'project': {'enterprise_name': 'Snake Case Foods'},
            })

    def test_unknown_project_key_is_rejected(self):
        with self.assertRaises(ValidationError):
            EvaluateRequest.model_validate({
                'rulesVersion': '2026.09',
                'projectId': 'a1b2c3d4-0000-4444-8888-1234567890ab',
                'project': {'enterpriseName': 'Foods', 'notARealField': 'x'},
            })

    def test_non_enumerated_band_value_is_rejected(self):
        with self.assertRaises(ValidationError):
            EvaluateRequest.model_validate({
                'rulesVersion': '2026.09',
                'projectId': 'a1b2c3d4-0000-4444-8888-1234567890ab',
                'project': {'plotArea': 'quite large'},
            })

    def test_duplicate_approval_keys_are_rejected(self):
        with self.assertRaises(ValidationError):
            EvaluateResponse.model_validate_json(json.dumps(_response([_approval(), _approval()])))

    def test_blocking_issues_must_be_errors_only(self):
        payload = _response([_approval()])
        payload['blockingIssues'] = [{
            'code': 'SOME_REVIEW', 'severity': 'review', 'field': None, 'approvalKey': None,
            'documentKey': None, 'documentId': None, 'message': 'x', 'suggestedAction': 'y',
        }]
        with self.assertRaises(ValidationError):
            EvaluateResponse.model_validate_json(json.dumps(payload))

    def test_evaluated_at_must_be_timezone_aware(self):
        payload = _response([_approval()])
        payload['evaluatedAt'] = '2026-09-17T00:00:00'
        with self.assertRaises(ValidationError):
            EvaluateResponse.model_validate_json(json.dumps(payload))


if __name__ == '__main__':
    unittest.main()
