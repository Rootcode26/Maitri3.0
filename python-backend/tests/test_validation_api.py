import json
import os
from unittest.mock import patch
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.domain.api_contract_models import EvaluateResponse
from app.services.rule_provider import register_rules_evaluator
from test_validation_service import fixture


class ValidationAPITests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'INTERNAL_API_TOKEN': 'test-secret'})
        self.env.start()
        if hasattr(app.state, 'rules_evaluator'):
            del app.state.rules_evaluator
        self.client = TestClient(app)
        self.request, self.evaluation = fixture()

    def tearDown(self):
        self.client.close()
        self.env.stop()
        if hasattr(app.state, 'rules_evaluator'):
            del app.state.rules_evaluator

    def post(self, token='test-secret'):
        return self.client.post('/validate', json=self.request, headers={'X-Internal-Token': token})

    def connect(self):
        register_rules_evaluator(app, lambda request: EvaluateResponse.model_validate_json(json.dumps(self.evaluation)))

    def test_main_route(self):
        self.connect()
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['documentChecks'][0]['status'], 'matched')
        self.assertEqual(response.json()['projectVersion'], 1)

    def test_missing_provider_safe(self):
        self.assertEqual(self.post().status_code, 503)

    def test_auth(self):
        self.assertEqual(self.post('wrong').status_code, 401)

    def test_no_config(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.post().status_code, 503)

    def test_bad_question(self):
        self.connect()
        self.request['project']['pan'] = 'wrong'
        self.assertEqual(self.post().status_code, 422)

    def test_provider_snapshot_mismatch(self):
        self.evaluation['projectId'] = 'other-project'
        self.connect()
        self.assertEqual(self.post().status_code, 503)


if __name__ == '__main__':
    unittest.main()
